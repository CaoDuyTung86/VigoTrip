/* eslint-disable no-unused-vars */
export const canSelectSeats = (isAuthenticated, user) => true;

const DEVICE_KEY_STORAGE = "vigo_device_session_key";

/**
 * Khoá thiết bị của trình duyệt này.
 *
 * Gửi kèm frame CONNECT (header X-Guest-Key) để máy chủ dựng danh tính `guest:<khoá>` cho
 * khách chưa đăng nhập — luồng đặt vé cho phép chọn ghế trước rồi mới đăng nhập ở bước
 * thanh toán, nên khách vẫn phải giữ được ghế.
 *
 * Khác với hàm getSeatUserId cũ, khoá này KHÔNG còn là danh tính giữ ghế mà client tự khai
 * trong từng thông điệp. Máy chủ suy ra danh tính một lần lúc bắt tay và bỏ qua mọi thứ
 * client khai trong thân thông điệp — trước đây tin thẳng, nên ai cũng gửi được userId là
 * email người khác để nhả ghế họ đang giữ.
 *
 * Vẫn gửi cả khi đã đăng nhập: máy chủ cần nó để chuyển những ghế giữ lúc còn là khách
 * sang tài khoản vừa đăng nhập (xem handoverSeats).
 */
export const getDeviceKey = () => {
  let sessionKey = localStorage.getItem(DEVICE_KEY_STORAGE);
  if (!sessionKey) {
    const array = new Uint32Array(2);
    crypto.getRandomValues(array);
    sessionKey = "sess_" + Date.now() + "_" + array[0].toString(36) + array[1].toString(36);
    localStorage.setItem(DEVICE_KEY_STORAGE, sessionKey);
  }
  return sessionKey;
};

/**
 * Ghế có đang bị NGƯỜI KHÁC giữ tạm không.
 *
 * `seat.tempLockedBy` và `ownerToken` đều là mã ẩn danh do máy chủ cấp (HMAC của danh
 * tính), không phải email. Trước đây chỗ này so email lấy từ thông điệp phát chung, tức
 * mọi client đều đọc được email của những người đang chọn ghế cùng chuyến.
 *
 * Chưa biết mã của chính mình (vừa nối, chưa kịp nhận) thì coi mọi ghế đang bị giữ là của
 * người khác: thà chặn nhầm một nhịp còn hơn cho bấm vào ghế người khác rồi hỏng ở bước
 * tạo đơn.
 */
export const isSeatLockedByOthers = (seat, ownerToken) => {
  if (!seat.tempLockedBy) return false;
  return seat.tempLockedBy !== ownerToken;
};

export const LOGIN_REQUIRED_SEAT_MSG = "Vui lòng đăng nhập để chọn và giữ ghế.";
export const WS_NOT_CONNECTED_MSG = "Không kết nối được máy chủ thời gian thực. Vui lòng thử lại.";
export const SEAT_CONFLICT_MSG = "Một hoặc nhiều ghế đã được người khác chọn. Vui lòng chọn ghế khác.";
