/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../utils/apiClient";
import {
  getAccessToken,
  setAccessToken,
  clearAccessToken,
  refreshAccessToken,
  revokeSessionOnServer,
  readTokenExpiryMs,
  installAuthInterceptors,
} from "../utils/authSession";
import { useToast } from "./ToastContext";
import { useLanguage } from "./LanguageContext";

/**
 * Xuất ra ngoài để WebSocketContext đọc được token mà không bắt buộc phải nằm trong
 * AuthProvider: nó dùng useContext trực tiếp và tự rơi về chế độ khách khi context rỗng,
 * nhờ vậy vẫn render và test độc lập được.
 */
export const AuthContext = createContext(null);

/**
 * Những khu vực chỉ xem được khi đã đăng nhập — mất phiên ở đây thì buộc phải rời trang.
 * Mọi nơi khác (nhất là luồng đặt vé) phải ở nguyên chỗ cũ.
 */
const AUTH_ONLY_PREFIXES = ["/admin", "/account", "/my-bookings", "/provider"];

/**
 * Chỉ là DẤU HIỆU "máy này từng đăng nhập", không phải chứng chỉ.
 *
 * Cookie refresh là HttpOnly nên JavaScript không có cách nào biết nó còn hay mất. Không có
 * dấu hiệu này thì mỗi khách vãng lai mở trang đều tốn một lượt gọi /refresh chỉ để nhận
 * 401 — trên Render free tier, đó là một request đánh thức container hoàn toàn vô ích.
 *
 * Sửa tay giá trị này KHÔNG cho ai thêm quyền gì: nó chỉ quyết định có thử gọi /refresh hay
 * không, còn câu trả lời vẫn do cookie và cơ sở dữ liệu định đoạt.
 */
const SESSION_HINT_KEY = "authUser";

/** Làm mới trước khi access token hết hạn ngần này, để không có request nào rơi vào khe chết. */
const REFRESH_LEEWAY_MS = 60_000;

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t, syncLanguageFromProfile } = useLanguage();

  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem(SESSION_HINT_KEY);
    if (storedUser) {
      try {
        return JSON.parse(storedUser);
      } catch {
        localStorage.removeItem(SESSION_HINT_KEY);
      }
    }
    return null;
  });

  /**
   * Access token — trong state của React, tức là trong RAM của tab. KHÔNG đọc từ
   * localStorage như trước, và cũng không ghi vào đó nữa. Lý do đầy đủ nằm ở đầu file
   * utils/authSession.js.
   *
   * Hệ quả: tải lại trang là mất token, và ta lấy lại nó bằng một lượt /refresh (xem effect
   * khôi phục phiên bên dưới). Đó là cái giá phải trả, và nó rẻ.
   */
  const [token, setToken] = useState(null);

  /**
   * false cho tới khi lượt khôi phục phiên đầu tiên có kết quả.
   *
   * Cần cờ này vì giữa lúc mở trang và lúc /refresh trả lời, `token` là null trong khi
   * người dùng thật ra VẪN đang đăng nhập. Màn hình nào quyết định dựa trên isAuthenticated
   * mà không đợi cờ này sẽ chớp qua trạng thái "chưa đăng nhập" rồi tự sửa lại — hoặc tệ
   * hơn, đá người dùng về trang chủ.
   */
  const [authReady, setAuthReady] = useState(false);

  // Hồ sơ đầy đủ lấy từ /api/users/me — chứa điểm tích lũy, hạng và % giảm giá thành viên.
  // Backend LUÔN trừ % này trước khi áp voucher khi tạo booking, nên giao diện phải
  // biết con số này thì bảng "Chi tiết thanh toán" mới khớp số tiền thật lúc thanh toán.
  const [profile, setProfile] = useState(null);

  // ref để interceptor fetch luôn truy cập token mới nhất mà không re-subscribe
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  const refreshProfile = useCallback(async () => {
    if (!tokenRef.current) {
      setProfile(null);
      return null;
    }
    try {
      const { ok, data } = await apiFetch("/api/users/me");
      if (!ok || !data) return null;
      setProfile(data);
      syncLanguageFromProfile(data.language);
      return data;
    } catch {
      return null;
    }
  }, [syncLanguageFromProfile]);

  // Nạp hồ sơ mỗi khi đăng nhập lại. Khi đăng xuất, profile đã được xóa trong logout/forceLogout.
  //
  // Dùng apiFetch (có retry) thay vì fetch trần: nếu backend đang "thức dậy" và lần gọi này
  // thất bại, profile sẽ đứng ở null → membershipDiscountPercent = 0 → bảng "Chi tiết thanh toán"
  // hiển thị sai số tiền so với lúc backend thực sự tạo booking.
  //
  // Header Authorization không còn phải ghép tay ở đây: bộ chặn trong authSession.js gắn
  // token mới nhất vào mọi request tới /api. Ghép tay lại là mời gọi đúng lỗi mà bộ chặn
  // sinh ra để dập — một token chụp lúc render, đã cũ vào lúc request thật sự bay đi.
  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { ok, data } = await apiFetch("/api/users/me");
        if (!ok || !data || cancelled) return;
        setProfile(data);
        // Ngôn ngữ của tài khoản chỉ biết được sau khi hồ sơ về tới nơi. Đồng bộ ở đây thay
        // vì ngay trong loginSuccess: phản hồi đăng nhập chỉ có token, tên và vai trò.
        syncLanguageFromProfile(data.language);
      } catch {
        // giữ nguyên profile hiện tại, lần điều hướng sau sẽ thử lại
      }
    })();
    return () => { cancelled = true; };
  }, [token, syncLanguageFromProfile]);

  /** Ghi nhận một phiên mới hoặc vừa được làm mới (dùng chung cho login và refresh). */
  const applySession = useCallback((authData) => {
    if (!authData?.token) return;
    const authUser = {
      email: authData.email,
      fullName: authData.fullName,
      role: authData.role,
    };
    setAccessToken(authData.token);
    setToken(authData.token);
    setUser(authUser);
    localStorage.setItem(SESSION_HINT_KEY, JSON.stringify(authUser));
  }, []);

  const loginSuccess = useCallback((authData) => {
    if (!authData) return;
    applySession(authData);
  }, [applySession]);

  /** Dọn sạch phiên phía trình duyệt. Không gọi mạng — hai hàm bên dưới quyết định việc đó. */
  const clearLocalSession = useCallback(() => {
    clearAccessToken();
    setToken(null);
    setUser(null);
    setProfile(null);
    localStorage.removeItem(SESSION_HINT_KEY);
    // Email của phiên vừa rồi. Trước đây chỉ được xóa khi đăng nhập THÀNH CÔNG, nên sau khi
    // đăng xuất, form đăng nhập vẫn tự điền sẵn email của người trước — khó chịu trên máy dùng chung.
    sessionStorage.removeItem("tempEmail");
  }, []);

  /**
   * Đăng xuất do người dùng chủ động.
   *
   * Báo máy chủ TRƯỚC rồi mới dọn cục bộ. Chỉ xoá phía trình duyệt là "đăng xuất" kiểu
   * trang trí: refresh token vẫn sống trong cơ sở dữ liệu tới ngày hết hạn, nên bản sao mà
   * ai đó kịp lấy được vẫn mở lại phiên này bất cứ lúc nào.
   */
  const logout = useCallback(() => {
    revokeSessionOnServer();
    clearLocalSession();
  }, [clearLocalSession]);

  /**
   * Bắt buộc logout khi phiên không còn hiệu lực (tài khoản bị khóa, refresh token hết hạn
   * hoặc đã bị thu hồi).
   *
   * Trước đây hàm này làm `window.location.href = "/"`: tải lại cả trang, cuốn theo toàn bộ
   * form đặt vé đang dở (chuyến, ghế đã giữ, thông tin hành khách, dịch vụ, mã giảm giá) —
   * chỉ vì một request nền hết hạn phiên. Giờ chỉ xoá phiên tại chỗ và báo bằng toast;
   * điều hướng chỉ xảy ra khi đang đứng trong khu vực bắt buộc đăng nhập, và bằng router
   * chứ không tải lại trang.
   */
  const forceLogout = useCallback((reason) => {
    if (!tokenRef.current) return; // chỉ xử lý nếu đang đăng nhập
    clearLocalSession();
    revokeSessionOnServer();
    showToast(reason || t.authXSessionExpiredOrLocked, "error", 6000);

    if (AUTH_ONLY_PREFIXES.some((prefix) => window.location.pathname.startsWith(prefix))) {
      navigate("/", { replace: true });
    }
  }, [clearLocalSession, navigate, showToast, t]);

  /**
   * Bộ chặn chỉ được cài MỘT lần cho cả vòng đời ứng dụng.
   *
   * Các hàm xử lý đi qua ref chứ không nằm trong mảng phụ thuộc: forceLogout đổi danh tính
   * mỗi khi người dùng chuyển ngôn ngữ (nó phụ thuộc `t`), mà gỡ rồi cài lại bộ chặn giữa
   * chừng sẽ làm rơi mất những request đang bay.
   */
  const handlersRef = useRef({ onRefreshed: () => {}, onSessionLost: () => {} });
  useEffect(() => {
    handlersRef.current = {
      onRefreshed: applySession,
      onSessionLost: () => forceLogout(t.authXSessionExpired),
    };
  }, [applySession, forceLogout, t]);

  useEffect(() => installAuthInterceptors({
    onRefreshed: (data) => handlersRef.current?.onRefreshed(data),
    onSessionLost: () => handlersRef.current?.onSessionLost(),
  }), []);

  /**
   * Khôi phục phiên khi mở trang: đổi cookie refresh lấy access token mới.
   *
   * Đây là thứ thay thế cho việc đọc token từ localStorage. Khác biệt: quyết định "phiên
   * này còn hiệu lực không" chuyển từ trình duyệt sang máy chủ. Tài khoản vừa bị khóa, phiên
   * vừa bị thu hồi vì đổi mật khẩu, hay refresh token đã bị phát hiện dùng lại — tất cả đều
   * chặn được ngay tại đây, việc mà một token nằm sẵn trong localStorage không bao giờ làm
   * được.
   */
  useEffect(() => {
    // Token cũ còn sót từ các phiên bản trước. Xoá đi: nó là một bí mật còn hiệu lực đang
    // nằm ở nơi mà bất kỳ đoạn mã nào trong trang cũng đọc được, và giờ không ai dùng nữa.
    localStorage.removeItem("authToken");

    let cancelled = false;
    (async () => {
      if (!localStorage.getItem(SESSION_HINT_KEY)) {
        setAuthReady(true);
        return;
      }
      const data = await refreshAccessToken();
      if (cancelled) return;
      if (data) {
        applySession(data);
      } else {
        clearLocalSession();
      }
      setAuthReady(true);
    })();
    return () => { cancelled = true; };
  }, [applySession, clearLocalSession]);

  /**
   * Làm mới trước hạn.
   *
   * Không có nó thì mọi thứ vẫn chạy — bộ chặn 401 sẽ dọn dẹp. Nhưng "vẫn chạy" ở đây có
   * nghĩa là cứ 15 phút lại có một request phải đi hai vòng, mà trên Render free tier vòng
   * thứ hai rơi trúng lúc container ngủ là thêm 30-60 giây người dùng ngồi nhìn màn hình
   * chờ. Rẻ hơn nhiều nếu làm mới lúc rảnh.
   */
  useEffect(() => {
    if (!token) return undefined;
    const expiry = readTokenExpiryMs(token);
    if (!expiry) return undefined;

    // Sàn 5 giây: token gần hết hạn (hoặc đồng hồ máy lệch) không được biến thành vòng lặp
    // làm mới liên tục.
    const delay = Math.max(expiry - Date.now() - REFRESH_LEEWAY_MS, 5_000);
    const timer = setTimeout(async () => {
      const data = await refreshAccessToken();
      // Thất bại ở đây KHÔNG đăng xuất: có thể chỉ là mất mạng tạm thời. Request thật kế
      // tiếp sẽ nhận 401 và bộ chặn mới là nơi đưa ra kết luận cuối cùng.
      if (data) applySession(data);
    }, delay);

    return () => clearTimeout(timer);
  }, [token, applySession]);

  const value = useMemo(() => ({
    user: user && profile ? { ...user, ...profile } : user,
    profile,
    // % giảm giá theo hạng thành viên (0 nếu chưa đăng nhập / hạng Đồng)
    membershipDiscountPercent: Number(profile?.discountPercent) || 0,
    membershipLevel: profile?.membershipLevel || null,
    refreshProfile,
    token,
    isAuthenticated: !!token,
    // Đã biết chắc câu trả lời cho "người này có đang đăng nhập không" hay chưa.
    authReady,
    loginSuccess,
    logout,
    forceLogout,
  }), [user, profile, token, authReady, loginSuccess, logout, forceLogout, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};

/**
 * Cho phép mã nằm NGOÀI cây AuthProvider lấy access token hiện hành (LanguageContext bọc
 * bên ngoài AuthProvider nên không dùng useAuth được).
 *
 * Trước đây những chỗ đó đọc localStorage.getItem("authToken") — chính là cái đã bị bỏ.
 */
export { getAccessToken };
