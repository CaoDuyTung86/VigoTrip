/**
 * Bản nháp của một lượt đặt vé đang dở, để tải lại trang không mất tiến trình.
 *
 * <h3>Vì sao sessionStorage chứ không phải localStorage</h3>
 *
 * Bản nháp này chụp lại MỌI thứ đang gõ dở trong form hành khách — trong đó có số
 * CCCD/hộ chiếu và ngày sinh — và nó chụp TỰ ĐỘNG, không ai bấm nút nào cả. Khác hẳn
 * `guestSavedPassengers` (xem SavedPassengersContext): sổ đó do người dùng chủ động tick
 * "Lưu thông tin", và nhánh khách vãng lai còn cố ý chỉ giữ tên/email/điện thoại.
 *
 * Thứ chụp âm thầm dữ liệu định danh thì không được nằm lại trên máy sau khi người ta rời
 * đi. `sessionStorage` chết theo tab nhưng sống qua F5 — mà F5 chính là tình huống cần cứu.
 * Vừa đủ, không hơn. Trên máy dùng chung (quán net, máy cơ quan) đây là khác biệt thật sự.
 *
 * <h3>Vì sao vẫn phải kiểm chứng lại với máy chủ</h3>
 *
 * Bản nháp chỉ là lời khai của trình duyệt. Ghế có còn được giữ hay không thì chỉ máy chủ
 * biết, và {@code SeatLockService} giữ bảng lock trong RAM: backend restart (Render gói
 * miễn phí ngủ khi vắng request) là mất sạch lock trong khi bản nháp vẫn nằm nguyên đó.
 * Tin bản nháp thì người dùng đi tiếp tới bước tạo đơn mới vỡ, mà lúc đó họ đã điền xong
 * hết — hỏng vào đúng lúc tệ nhất. Nên khôi phục xong là phải đối chiếu, xem verifyHeldSeats.
 */

const STORAGE_PREFIX = "vigo_booking_draft_";

/**
 * Đổi số này khi đổi hình dạng bản nháp. Bản nháp cũ sẽ bị bỏ qua thay vì được đọc bằng
 * mã mới — tránh cảnh khôi phục ra một trạng thái nửa cũ nửa mới rồi hỏng ở đâu đó xa.
 */
const DRAFT_VERSION = 1;

/**
 * Bản nháp quá hạn thì bỏ.
 *
 * Đặt 30 phút vì lock ghế chỉ sống 10 phút và đơn PENDING cũng chỉ giữ thêm ít phút nữa —
 * quá mốc này thì gần như chắc chắn không còn gì để khôi phục, khôi phục ra chỉ tổ dựng lên
 * một màn hình đã chết rồi lại đá người dùng về. sessionStorage tự dọn khi đóng tab, nên
 * mốc này chỉ để chặn trường hợp tab mở suốt nhiều giờ.
 */
export const DRAFT_TTL_MS = 30 * 60 * 1000;

/** Các bước được phép khôi phục — đều là bước TRƯỚC khi tạo đơn. */
export const RESTORABLE_STEPS = ["seatClass", "passenger", "extras", "review"];

const storageKey = (mode) => `${STORAGE_PREFIX}${mode}`;

/**
 * sessionStorage ném lỗi trong chế độ riêng tư của vài trình duyệt, và khi hết dung lượng.
 * Không lưu được bản nháp là mất tiện nghi, không phải mất tính đúng đắn — nuốt lỗi và để
 * luồng đặt vé chạy tiếp, đừng để nó làm sập cả trang.
 */
const safely = (action, fallback = null) => {
  try {
    return action();
  } catch {
    return fallback;
  }
};

export const writeDraft = (mode, draft, now = Date.now()) => safely(() => {
  sessionStorage.setItem(storageKey(mode), JSON.stringify({
    version: DRAFT_VERSION,
    savedAt: now,
    draft,
  }));
  return true;
}, false);

export const clearDraft = (mode) => safely(() => {
  sessionStorage.removeItem(storageKey(mode));
  return true;
}, false);

/**
 * Đọc bản nháp còn dùng được, hoặc null.
 *
 * <b>Phải gọi trong một lazy initializer của useState, không phải trong useEffect.</b> Đọc
 * trong effect thì nhịp render đầu tiên đã kịp chạy autosave với trạng thái rỗng và ghi đè
 * mất đúng bản nháp đang định đọc. Ngoài ra effect đọc tham số URL cũng cần biết ngay từ
 * nhịp render đầu là có bản nháp hay không, để nhường đường thay vì tự chạy tìm chuyến.
 *
 * Null khi: không có, hỏng, sai phiên bản, quá hạn, thiếu chuyến, hoặc bước đã lưu không
 * nằm trong danh sách được phép khôi phục. Trường hợp cuối đáng nói: bước sau khi tạo đơn
 * KHÔNG khôi phục ở đây — đơn PENDING đã nằm trong CSDL và trang "Vé của tôi" có sẵn nút
 * "Thanh toán ngay" cho nó, đường đó chạy được cả từ máy khác nên tốt hơn hẳn.
 */
export const readDraft = (mode, now = Date.now()) => safely(() => {
  const raw = sessionStorage.getItem(storageKey(mode));
  if (!raw) return null;

  const parsed = JSON.parse(raw);
  if (parsed?.version !== DRAFT_VERSION) return null;
  if (!Number.isFinite(parsed.savedAt) || now - parsed.savedAt > DRAFT_TTL_MS) return null;

  const draft = parsed.draft;
  if (!draft?.tripId || !draft.selectedTrip) return null;
  if (!RESTORABLE_STEPS.includes(draft.step)) return null;

  return draft;
});

/**
 * Đối chiếu ghế trong bản nháp với sơ đồ ghế máy chủ vừa trả về.
 *
 * `ownerToken` là mã ẩn danh của chính phiên này (do /app/whoami cấp), `seat.tempLockedBy`
 * là mã của người đang giữ ghế. Hai chuỗi bằng nhau nghĩa là ghế vẫn của mình. Xem
 * TripService.getSeatsForTrip — trước đây đường REST trả danh tính thô nên phép so này luôn
 * lệch và không ghế nào được nhận về.
 *
 * @returns {{ok: boolean, keptSeatIds: number[], lostSeatIds: number[]}}
 *   ok = giữ được nguyên vẹn cả chỗ ngồi lẫn hạn giữ, tức đi thẳng tiếp được.
 */
export const verifyHeldSeats = ({ seats, selectedSeatIds, ownerToken, lockDeadline, now = Date.now() }) => {
  // Chưa biết mã của chính mình thì không kết luận được ghế nào của ai. Trả "mất hết" ở
  // đây sẽ đá nhầm người dùng về bước chọn ghế chỉ vì WebSocket nối chậm hơn REST vài
  // trăm mili giây — nơi gọi phải chờ có mã rồi mới hỏi.
  if (!ownerToken || !selectedSeatIds?.length) {
    return { ok: false, keptSeatIds: [], lostSeatIds: selectedSeatIds ?? [] };
  }

  const byId = new Map((seats ?? []).map((seat) => [seat.id, seat]));
  const keptSeatIds = [];
  const lostSeatIds = [];

  selectedSeatIds.forEach((seatId) => {
    const seat = byId.get(seatId);
    const stillMine = seat && !seat.booked && seat.tempLockedBy === ownerToken;
    (stillMine ? keptSeatIds : lostSeatIds).push(seatId);
  });

  // Hạn giữ hết thì dù mã còn khớp cũng không đi tiếp được: lock đã tới lượt dọn, chỉ là
  // chưa tới nhịp quét (releaseExpiredLocks chạy mỗi 10 giây).
  const holdAlive = Number.isFinite(lockDeadline) && lockDeadline > now;

  return { ok: holdAlive && lostSeatIds.length === 0, keptSeatIds, lostSeatIds };
};
