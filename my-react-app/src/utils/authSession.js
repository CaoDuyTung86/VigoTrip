import axios from "axios";

/**
 * Phiên đăng nhập phía trình duyệt.
 *
 * NGUYÊN TẮC TRUNG TÂM: access token KHÔNG bao giờ được chạm vào localStorage,
 * sessionStorage, cookie đọc được, hay bất cứ chỗ nào tồn tại qua một lần tải trang.
 * Nó sống đúng trong biến `accessToken` dưới đây, tức là trong bộ nhớ của tab, và chết
 * cùng tab.
 *
 * Vì sao chặt tới vậy: localStorage là kho dùng chung cho MỌI đoạn mã chạy trong trang.
 * Chỉ cần một dòng script lạ được nhét vào — qua một thư viện npm bị chiếm, một quảng cáo,
 * một trường dữ liệu do người dùng nhập mà đâu đó lỡ render bằng dangerouslySetInnerHTML —
 * là `localStorage.getItem("authToken")` trả về chìa khoá và nó gửi đi đâu tuỳ thích.
 * Biến trong module thì không có API nào đọc ngang được; muốn lấy phải chạy được mã TRONG
 * chính ngữ cảnh này, mà tới lúc đó kẻ tấn công vốn đã gọi API thay mặt nạn nhân được rồi.
 * Khác biệt thật nằm ở chỗ khác: token không bị mang RA KHỎI trình duyệt để dùng lại sau.
 *
 * Phần "giữ đăng nhập qua nhiều ngày" do refresh token đảm nhiệm, và nó nằm trong cookie
 * HttpOnly — file này không đọc được nó, không nhìn thấy nó, và đó là chủ ý. Xem
 * docs/BAO_MAT_XAC_THUC.md.
 */

/**
 * Bản fetch gốc, chụp lại NGAY lúc nạp module.
 *
 * AuthContext vá đè window.fetch để bắt 401. Nếu hàm làm mới phiên bên dưới cũng gọi
 * window.fetch thì một lần /refresh trả 401 sẽ kích hoạt chính bộ bắt lỗi đó và gọi lại
 * /refresh — đệ quy vô tận đúng vào lúc phiên hỏng. Module này luôn được import trước khi
 * React render nên biến dưới đây chắc chắn là bản chưa bị vá.
 */
const nativeFetch = window.fetch
  ? window.fetch.bind(window)
  // jsdom (môi trường test) không luôn gắn fetch lên window — lúc đó lùi về bản toàn cục.
  : (...args) => globalThis.fetch(...args);

const REFRESH_URL = "/api/auth/refresh";
const LOGOUT_URL = "/api/auth/logout";

let accessToken = null;

/** Một lần /refresh đang bay. Xem lý do ở refreshAccessToken(). */
let refreshInFlight = null;

export const getAccessToken = () => accessToken;

export const setAccessToken = (token) => {
  accessToken = token || null;
};

export const clearAccessToken = () => {
  accessToken = null;
};

/** Đường dẫn có phải API nội bộ của hệ thống không (bỏ qua Google, VNPay, CDN...). */
const isInternalApi = (url) => {
  if (!url) return false;
  if (url.startsWith("/api")) return true;
  try {
    return new URL(url, window.location.origin).origin === window.location.origin
      && new URL(url, window.location.origin).pathname.startsWith("/api");
  } catch {
    return false;
  }
};

/**
 * /api/auth/* là nhóm public. 401 ở đó là kết quả của chính thao tác đăng nhập hoặc là
 * tín hiệu "phiên dài hạn đã chết" — cả hai đều KHÔNG được kích hoạt vòng làm mới.
 */
const isAuthEndpoint = (url) => !!url && url.includes("/api/auth/");

/**
 * Đọc hạn của access token để biết khi nào cần làm mới trước.
 *
 * Phần payload của JWT chỉ là Base64, ai cũng đọc được — đọc nó ở đây KHÔNG phải là tin
 * tưởng nó. Con số lấy ra chỉ dùng để hẹn giờ; mọi quyết định về quyền hạn vẫn do máy chủ
 * đưa ra sau khi kiểm chữ ký. Token hỏng thì trả null và ta quay về cách cũ: đợi 401 rồi
 * mới làm mới.
 */
export const readTokenExpiryMs = (token) => {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
};

/**
 * Đổi cookie refresh lấy access token mới.
 *
 * GỘP CÁC LẦN GỌI TRÙNG là bắt buộc chứ không phải tối ưu. Refresh token xoay vòng: mỗi
 * lần dùng là bản cũ chết. Nếu ba request cùng nhận 401 một lúc và cùng gọi /refresh, ba
 * lần đó sẽ giẫm lên nhau — hai lần sau cầm token đã bị xoay, máy chủ coi là dấu hiệu bị
 * đánh cắp và thu hồi cả phiên. Người dùng bị đá ra ngoài chỉ vì mở ba tab.
 * (Máy chủ có cửa sổ tha thứ vài giây cho đúng tình huống này, nhưng dựa vào nó thay vì
 * tự gộp ở đây là tự bào mỏng lớp phòng thủ của chính mình.)
 *
 * @returns {Promise<object|null>} dữ liệu phiên mới, hoặc null nếu phiên đã hết hiệu lực
 */
export const refreshAccessToken = () => {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const res = await nativeFetch(REFRESH_URL, {
        method: "POST",
        // Cookie refresh là HttpOnly; "include" là cách duy nhất bảo trình duyệt đính nó
        // vào request, và cũng là tất cả những gì mã JavaScript được phép làm với nó.
        credentials: "include",
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data?.token) return null;
      setAccessToken(data.token);
      return data;
    } catch {
      // Mất mạng hay backend đang ngủ dậy: KHÔNG coi là phiên hỏng. Trả null để phía gọi
      // báo lỗi request, nhưng cookie vẫn còn nguyên nên lần thử sau vẫn khôi phục được.
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
};

/** Báo máy chủ thu hồi phiên. Nuốt lỗi: đăng xuất phía giao diện phải xảy ra dù sao đi nữa. */
export const revokeSessionOnServer = async () => {
  try {
    await nativeFetch(LOGOUT_URL, { method: "POST", credentials: "include" });
  } catch {
    // Mạng hỏng — phiên sẽ tự hết hạn theo jwt.refresh.idle-days.
  }
};

/** Gắn/ghi đè header Authorization, chấp nhận cả object thường lẫn Headers. */
const withAuthHeader = (init, token) => {
  const next = { ...(init || {}) };
  if (next.headers instanceof Headers) {
    const headers = new Headers(next.headers);
    headers.set("Authorization", `Bearer ${token}`);
    next.headers = headers;
  } else {
    next.headers = { ...(next.headers || {}), Authorization: `Bearer ${token}` };
  }
  return next;
};

/**
 * Cài bộ chặn cho CẢ fetch lẫn axios.
 *
 * Phải là cả hai: dự án gọi API bằng cả hai thư viện (axios ở AccountPage, MyBookings,
 * ProviderCheckIn...; fetch ở phần còn lại), mà axios chạy trên XMLHttpRequest nên bản vá
 * window.fetch không nhìn thấy nó. Trước đây chỉ có nhánh fetch, và đó là lý do một 401 từ
 * lệnh gọi axios không bao giờ dẫn tới việc đăng xuất.
 *
 * Mỗi bộ chặn làm đúng hai việc:
 *
 *  1. GẮN TOKEN MỚI NHẤT vào mọi request tới API nội bộ, ghi đè lên header mà nơi gọi tự
 *     đặt. Nhờ vậy 68 chỗ gọi đang tự ghép `Bearer ${token}` từ một biến chụp lúc render
 *     không còn là nguồn lỗi: sau một vòng làm mới, biến đó đã cũ nhưng request vẫn đi kèm
 *     token đúng.
 *
 *  2. TỰ LÀM MỚI KHI GẶP 401 rồi gửi lại đúng một lần. Người dùng không nhìn thấy gì cả —
 *     đây là thứ khiến access token 15 phút không trở thành "cứ 15 phút lại văng ra màn
 *     hình đăng nhập".
 *
 * @param {{ onRefreshed: (authData: object) => void, onSessionLost: () => void }} handlers
 * @returns {() => void} hàm gỡ bộ chặn
 */
export const installAuthInterceptors = ({ onRefreshed, onSessionLost }) => {
  const originalFetch = window.fetch;

  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input?.url || "";
    const internal = isInternalApi(url) && !isAuthEndpoint(url);

    /**
     * Chỉ can thiệp khi nơi gọi truyền vào dạng (url, init) — dạng duy nhất dự án đang dùng.
     *
     * Với một đối tượng Request đã dựng sẵn thì không được đụng vào: theo đặc tả fetch, hễ
     * `init.headers` có mặt là nó THAY THẾ toàn bộ header của Request, nên việc thêm một
     * dòng Authorization sẽ âm thầm xoá Content-Type và mọi header khác mà nơi gọi đã đặt.
     * Thân request của nó cũng có thể đã bị đọc một lần và không phát lại được.
     */
    const canRewrite = typeof input === "string" || input instanceof URL;

    let effectiveInit = init;
    if (internal && accessToken && canRewrite) {
      effectiveInit = withAuthHeader(init, accessToken);
    }

    const response = await originalFetch(input, effectiveInit);
    if (response.status !== 401 || !internal || !accessToken) {
      return response;
    }

    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      onSessionLost?.();
      return response;
    }
    onRefreshed?.(refreshed);
    // Phiên đã được cứu, nhưng request này thì không gửi lại được — trả nguyên 401 để nơi
    // gọi tự xử lý, lần gọi sau đã có token mới.
    if (!canRewrite) return response;

    return originalFetch(input, withAuthHeader(init, refreshed.token));
  };

  const axiosRequestId = axios.interceptors.request.use((config) => {
    if (accessToken && isInternalApi(config.url) && !isAuthEndpoint(config.url)) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  });

  const axiosResponseId = axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      const config = error?.config;
      const status = error?.response?.status;
      const internal = isInternalApi(config?.url) && !isAuthEndpoint(config?.url);

      // Cờ _retried chống lặp: nếu lần gửi lại cũng 401 thì phiên thật sự hỏng.
      if (status !== 401 || !internal || !accessToken || config?._retried) {
        return Promise.reject(error);
      }

      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        onSessionLost?.();
        return Promise.reject(error);
      }
      onRefreshed?.(refreshed);

      config._retried = true;
      config.headers = { ...(config.headers || {}), Authorization: `Bearer ${refreshed.token}` };
      return axios(config);
    },
  );

  return () => {
    window.fetch = originalFetch;
    axios.interceptors.request.eject(axiosRequestId);
    axios.interceptors.response.eject(axiosResponseId);
  };
};
