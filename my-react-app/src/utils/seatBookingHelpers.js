/* eslint-disable no-unused-vars */
export const canSelectSeats = (isAuthenticated, user) => true;

export const getSeatUserId = (user) => {
  if (user && user.email) {
    return user.email;
  }
  let sessionKey = localStorage.getItem("vigo_device_session_key");
  if (!sessionKey) {
    const array = new Uint32Array(2);
    crypto.getRandomValues(array);
    sessionKey = "sess_" + Date.now() + "_" + array[0].toString(36) + array[1].toString(36);
    localStorage.setItem("vigo_device_session_key", sessionKey);
  }
  return sessionKey;
};

export const isSeatLockedByOthers = (seat, user) => {
  if (!seat.tempLockedBy) return false;
  const userId = getSeatUserId(user);
  return !userId || seat.tempLockedBy !== userId;
};

export const LOGIN_REQUIRED_SEAT_MSG = "Vui lòng đăng nhập để chọn và giữ ghế.";
export const WS_NOT_CONNECTED_MSG = "Không kết nối được máy chủ thời gian thực. Vui lòng thử lại.";
export const SEAT_CONFLICT_MSG = "Một hoặc nhiều ghế đã được người khác chọn. Vui lòng chọn ghế khác.";
