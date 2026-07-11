export const canSelectSeats = (isAuthenticated, user) => true;

export const getSeatUserId = (user) => {
  if (user?.email) return user.email;
  let anonId = sessionStorage.getItem("anonymous_seat_user_id");
  if (!anonId) {
    anonId = "anonymous_" + Math.random().toString(36).substring(2, 11);
    sessionStorage.setItem("anonymous_seat_user_id", anonId);
  }
  return anonId;
};

export const isSeatLockedByOthers = (seat, user) => {
  if (!seat.tempLockedBy) return false;
  const userId = getSeatUserId(user);
  return !userId || seat.tempLockedBy !== userId;
};

export const LOGIN_REQUIRED_SEAT_MSG = "Vui lòng đăng nhập để chọn và giữ ghế.";
export const WS_NOT_CONNECTED_MSG = "Không kết nối được máy chủ thời gian thực. Vui lòng thử lại.";
export const SEAT_CONFLICT_MSG = "Một hoặc nhiều ghế đã được người khác chọn. Vui lòng chọn ghế khác.";
