import { useEffect, useRef } from "react";

/**
 * Nhận lại ghế đang giữ khi danh tính đổi giữa chừng luồng đặt vé.
 *
 * Ai chọn ghế lúc chưa đăng nhập rồi mới đăng nhập ở bước thanh toán sẽ giữ ghế dưới danh
 * tính `guest:<khoá thiết bị>`, nhưng tạo đơn dưới danh tính `user:<email>` — BookingService
 * so lock với danh tính tài khoản nên trả 400 "Ghế X đang được giữ bởi người khác", trong
 * khi người khác đó chính là họ vài phút trước.
 *
 * Hook bắt đúng thời điểm danh tính đổi (mã chủ sở hữu do máy chủ cấp đổi theo) và gọi
 * seat-handover.
 *
 * Trước đây việc chuyển chủ do frontend tự làm bằng hai lượt: nhả ghế theo danh tính cũ
 * rồi giữ lại bằng danh tính mới. Giữa hai lượt ghế thực sự trống vài chục mili giây, đủ
 * để người khác chen vào và khách mất ghế dù không làm gì sai. Giờ máy chủ chuyển chủ
 * trong một thao tác, khoảng trống đó không còn. Nếu vẫn hụt (ghế đã hết hạn giữ và bị
 * người khác lấy trước) thì `onFailure` được gọi để màn hình đưa người dùng về chọn lại,
 * thay vì để họ đi tiếp rồi vỡ ở bước tạo đơn.
 */
export default function useSeatLockRekey({
  ownerToken,
  tripId,
  seatIds,
  active,
  handoverSeats,
  onFailure,
}) {
  // Chỉ nhớ mã khác null: lúc nối lại (đăng nhập xong) mã tạm về null một nhịp, lấy nhịp
  // đó làm "danh tính trước" thì lần nào cũng tưởng là đã đổi danh tính.
  const previousOwnerRef = useRef(ownerToken ?? null);
  const runningRef = useRef(false);
  // Đọc qua ref để effect chỉ phụ thuộc ownerToken — đổi ghế hay đổi chuyến không được
  // kích hoạt việc chuyển khoá.
  const latestRef = useRef(null);
  latestRef.current = { tripId, seatIds, active, handoverSeats, onFailure };

  useEffect(() => {
    if (!ownerToken) return;

    const previousOwner = previousOwnerRef.current;
    previousOwnerRef.current = ownerToken;

    if (!previousOwner || previousOwner === ownerToken) return;

    const { tripId: trip, seatIds: seats, active: hasHold, handoverSeats: handover, onFailure: fail } =
      latestRef.current;

    if (!hasHold || !trip || !seats?.length || runningRef.current) return;

    runningRef.current = true;
    const held = [...seats];

    (async () => {
      try {
        const { success } = await handover({ tripId: trip, seatIds: held });
        if (!success) fail?.();
      } finally {
        runningRef.current = false;
      }
    })();
  }, [ownerToken]);
}
