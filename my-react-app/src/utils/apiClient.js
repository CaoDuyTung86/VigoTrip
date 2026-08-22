/**
 * Gọi API có khả năng chịu được "cold start" của backend.
 *
 * Bối cảnh: backend chạy trên Render gói free — sau ~15 phút không có lưu lượng, container
 * bị ngủ. Request đầu tiên đánh thức nó và phải chờ 30–60 giây. Trong khoảng đó,
 * proxy rewrite của Vercel (/api/* -> Render) đã hết hạn chờ và trả về 502/504 kèm
 * một trang HTML — nên response.json() ném lỗi và người dùng thấy "Backend lỗi".
 *
 * Tệ hơn: backend VẪN đang xử lý request đó. Nếu người dùng bấm lại, hai request
 * đăng nhập Google chạy song song và có thể tạo ra hai tài khoản trùng email.
 * Vì vậy phần retry ở đây chỉ dành cho các lỗi hạ tầng nêu trên, và có khoảng chờ
 * đủ dài để lần thử sau rơi vào lúc backend đã thức.
 */

// Các mã lỗi phát ra từ tầng proxy/hạ tầng, không phải từ logic nghiệp vụ của backend.
const COLD_START_STATUS = new Set([408, 502, 503, 504, 522, 524]);

export const WAKING_UP_MESSAGE =
  "Máy chủ đang khởi động lại (dịch vụ miễn phí sẽ ngủ khi không có người dùng). " +
  "Vui lòng chờ khoảng 30 giây rồi thử lại.";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Lỗi có kèm ngữ cảnh để phía gọi hiển thị đúng thông báo. */
export class ApiError extends Error {
  constructor(message, { status = 0, isColdStart = false, payload = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.isColdStart = isColdStart;
    this.payload = payload;
  }
}

/**
 * Đọc body dưới dạng JSON một cách an toàn.
 * Khi proxy trả về trang lỗi HTML thì response.json() sẽ ném — trả null thay vì để vỡ.
 */
async function readJson(response) {
  const text = await response.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * fetch() có timeout + tự thử lại khi gặp lỗi cold start.
 *
 * @param {string} url
 * @param {RequestInit} options
 * @param {{ timeout?: number, retries?: number, retryDelay?: number, onRetry?: (attempt: number) => void }} config
 * @returns {Promise<{ ok: boolean, status: number, data: any }>}
 */
export async function apiFetch(url, options = {}, config = {}) {
  const {
    timeout = 45000,   // dài hơn thời gian đánh thức thường gặp của Render
    retries = 2,
    retryDelay = 4000,
    onRetry,
  } = config;

  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);

      if (COLD_START_STATUS.has(response.status)) {
        lastError = new ApiError(WAKING_UP_MESSAGE, { status: response.status, isColdStart: true });
        if (attempt < retries) {
          onRetry?.(attempt + 1);
          await sleep(retryDelay);
          continue;
        }
        throw lastError;
      }

      return { ok: response.ok, status: response.status, data: await readJson(response) };
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof ApiError) throw err;

      // AbortError (hết timeout) hoặc TypeError (mất mạng / DNS) — đều đáng thử lại.
      const isRetryable = err.name === "AbortError" || err instanceof TypeError;
      lastError = new ApiError(isRetryable ? WAKING_UP_MESSAGE : err.message, {
        isColdStart: isRetryable,
      });

      if (isRetryable && attempt < retries) {
        onRetry?.(attempt + 1);
        await sleep(retryDelay);
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new ApiError("Không thể kết nối tới máy chủ.");
}

/**
 * Đánh thức backend ngay khi người dùng mở trang, để lúc họ thực sự bấm đăng nhập
 * thì container đã sẵn sàng. Cố tình im lặng: đây chỉ là tối ưu, không phải chức năng.
 */
export function warmUpBackend() {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 60000);
  fetch("/actuator/health", { signal: controller.signal, cache: "no-store" }).catch(() => {});
}
