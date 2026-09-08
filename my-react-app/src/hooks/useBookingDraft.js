import { useCallback, useEffect, useMemo, useRef } from "react";
import { clearDraft, writeDraft } from "../utils/bookingDraft";

/**
 * Lưu tiến trình đặt vé để một lần tải lại trang không xoá sạch nó.
 *
 * Trước đây toàn bộ luồng nằm trong useState thuần, nên F5 giữa chừng là về thẳng bước tìm
 * chuyến: mất chuyến đã chọn, mất ghế đã chọn, mất sạch thông tin hành khách vừa gõ — trong
 * khi ghế thì vẫn đang bị chính họ giữ ở máy chủ thêm 10 phút nữa.
 *
 * Hook chỉ lo phần GHI. Phần đọc do trang tự làm bằng `readDraft` trong một lazy
 * initializer (lí do phải đọc đồng bộ nằm ở Javadoc của hàm đó), và phần áp bản nháp vào
 * trạng thái cũng vậy — mỗi bước cần một thứ khác nhau, ví dụ từ bước "extras" trở đi còn
 * phải nạp lại danh sách dịch vụ, thiếu nó thì tổng tiền hiện ra thiếu hẳn phần phụ trợ.
 *
 * @param mode    khoá lưu riêng cho từng luồng ("bus" | "train" | "air")
 * @param enabled đang thật sự ở trong luồng đặt vé và chưa tạo đơn
 * @param draft   dữ liệu cần lưu, do trang gom
 * @returns hàm xoá bản nháp, cho những chỗ cần xoá dứt khoát
 */
export default function useBookingDraft({ mode, enabled, draft }) {
  const forgetDraft = useCallback(() => clearDraft(mode), [mode]);

  // So bằng nội dung chứ không bằng tham chiếu: trang dựng object bản nháp mới ở mỗi lần
  // render, lấy thẳng nó làm dependency thì effect chạy lại mỗi render.
  const serialized = useMemo(() => (enabled ? JSON.stringify(draft) : null), [enabled, draft]);

  useEffect(() => {
    if (serialized === null) return;
    writeDraft(mode, JSON.parse(serialized));
  }, [mode, serialized]);

  // Rời khỏi luồng thì xoá. Gom về một quy tắc duy nhất ở đây thay vì rải lời gọi xoá ra
  // từng chỗ (tạo đơn xong, quay về tìm chuyến, đổi số hành khách...): rải ra thì chỉ cần
  // quên một nhánh là bản nháp chết vẫn nằm lại, và lần tải trang sau nó dựng người dùng
  // dậy giữa một luồng họ đã rời bỏ.
  //
  // Đáng chú ý nhất là nhánh tạo đơn xong: lúc đó ghế đã do đơn PENDING giữ chứ không còn
  // là lock tạm, và trang "Vé của tôi" đã có sẵn nút thanh toán lại cho đơn đó — khôi phục
  // bằng bản nháp vừa thừa, vừa dễ dựng ra một màn thanh toán đã hết hiệu lực.
  const wasEnabled = useRef(enabled);
  useEffect(() => {
    if (wasEnabled.current && !enabled) forgetDraft();
    wasEnabled.current = enabled;
  }, [enabled, forgetDraft]);

  return forgetDraft;
}
