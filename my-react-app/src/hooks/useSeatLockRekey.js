import { useEffect, useRef } from "react";

/**
 * Chuyển chủ sở hữu lock ghế khi danh tính người dùng đổi giữa chừng luồng đặt vé.
 *
 * getSeatUserId() trả về email khi đã đăng nhập, còn chưa đăng nhập thì trả khoá thiết bị
 * "sess_...". Nghĩa là ai chọn ghế lúc chưa đăng nhập rồi mới đăng nhập ở bước thanh toán
 * sẽ giữ ghế dưới một danh tính, nhưng tạo đơn dưới một danh tính khác — BookingService so
 * lock với email của tài khoản nên trả 400 "Ghế X đang được giữ bởi người khác", trong khi
 * người khác đó chính là họ vài phút trước.
 *
 * Hook này bắt đúng thời điểm danh tính đổi: nhả lock theo danh tính cũ rồi giữ lại ngay
 * bằng danh tính mới. Chỉ chạy khi đang thực sự có lock tạm ở backend (`active`), tức từ
 * bước 2 trở đi; ở bước chọn ghế thì ghế mới chỉ được chọn trên giao diện.
 *
 * Khoảng trống giữa nhả và giữ lại là vài chục mili giây trên cùng một kết nối, nhưng nếu
 * xui mà mất ghế thật thì `onFailure` được gọi để màn hình đưa người dùng về chọn lại,
 * thay vì để họ đi tiếp rồi vỡ ở bước tạo đơn.
 */
export default function useSeatLockRekey({
  ownerId,
  tripId,
  seatIds,
  active,
  lockSeats,
  unlockSeats,
  onFailure,
}) {
  const previousOwnerRef = useRef(ownerId);
  const runningRef = useRef(false);
  // Đọc qua ref để effect chỉ phụ thuộc ownerId — đổi ghế hay đổi chuyến không được
  // kích hoạt việc chuyển khoá.
  const latestRef = useRef(null);
  latestRef.current = { tripId, seatIds, active, lockSeats, unlockSeats, onFailure };

  useEffect(() => {
    const previousOwner = previousOwnerRef.current;
    previousOwnerRef.current = ownerId;

    if (!ownerId || !previousOwner || previousOwner === ownerId) return;

    const { tripId: trip, seatIds: seats, active: hasHold, lockSeats: lock, unlockSeats: unlock, onFailure: fail } =
      latestRef.current;

    if (!hasHold || !trip || !seats?.length || runningRef.current) return;

    runningRef.current = true;
    const held = [...seats];

    (async () => {
      try {
        unlock({ tripId: trip, seatIds: held, userId: previousOwner });
        const { success } = await lock({ tripId: trip, seatIds: held, userId: ownerId });
        if (!success) fail?.();
      } finally {
        runningRef.current = false;
      }
    })();
  }, [ownerId]);
}
