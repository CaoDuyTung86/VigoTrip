import { describe, it, expect, beforeEach } from 'vitest';
import {
  DRAFT_TTL_MS,
  clearDraft,
  readDraft,
  verifyHeldSeats,
  writeDraft,
} from './bookingDraft';

const MODE = 'bus';
const MY_TOKEN = 'ownertoken_cua_toi';
const NGUOI_KHAC = 'ownertoken_nguoi_khac';

const draftHopLe = (thayDoi = {}) => ({
  step: 'passenger',
  tripId: 7,
  selectedTrip: { id: 7, price: 250000 },
  selectedSeatIds: [1, 2],
  lockDeadline: Date.now() + 5 * 60 * 1000,
  ...thayDoi,
});

describe('readDraft / writeDraft', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('ghi rồi đọc lại được nguyên vẹn', () => {
    const draft = draftHopLe();
    writeDraft(MODE, draft);
    expect(readDraft(MODE)).toEqual(draft);
  });

  it('lưu vào sessionStorage chứ không phải localStorage', () => {
    // Bản nháp chụp cả CCCD và ngày sinh đang gõ dở, và chụp tự động chứ không do người
    // dùng bấm lưu. Thứ đó không được nằm lại trên máy sau khi người ta đóng tab — trên
    // máy dùng chung đây là khác biệt thật sự.
    writeDraft(MODE, draftHopLe());
    expect(sessionStorage.length).toBe(1);
    expect(localStorage.length).toBe(0);
  });

  it('mỗi luồng phương tiện có bản nháp riêng', () => {
    writeDraft('bus', draftHopLe({ tripId: 7 }));
    writeDraft('train', draftHopLe({ tripId: 9 }));
    expect(readDraft('bus').tripId).toBe(7);
    expect(readDraft('train').tripId).toBe(9);
  });

  it('không có bản nháp thì trả null', () => {
    expect(readDraft(MODE)).toBeNull();
  });

  it('clearDraft xoá hẳn', () => {
    writeDraft(MODE, draftHopLe());
    clearDraft(MODE);
    expect(readDraft(MODE)).toBeNull();
  });

  it('bỏ qua bản nháp quá hạn', () => {
    const luc = Date.now();
    writeDraft(MODE, draftHopLe(), luc);
    expect(readDraft(MODE, luc + DRAFT_TTL_MS - 1)).not.toBeNull();
    expect(readDraft(MODE, luc + DRAFT_TTL_MS + 1)).toBeNull();
  });

  it('bỏ qua nội dung hỏng thay vì ném lỗi', () => {
    // Chỉ là tiện nghi, không phải tính đúng đắn: nổ ở đây sẽ làm sập cả trang đặt vé.
    sessionStorage.setItem('vigo_booking_draft_bus', 'khong-phai-json');
    expect(readDraft(MODE)).toBeNull();
  });

  it('bỏ qua bản nháp của phiên bản cũ', () => {
    sessionStorage.setItem('vigo_booking_draft_bus', JSON.stringify({
      version: 0,
      savedAt: Date.now(),
      draft: draftHopLe(),
    }));
    expect(readDraft(MODE)).toBeNull();
  });

  it('bỏ qua bản nháp không có chuyến', () => {
    writeDraft(MODE, draftHopLe({ tripId: null, selectedTrip: null }));
    expect(readDraft(MODE)).toBeNull();
  });

  it('không khôi phục các bước sau khi đã tạo đơn', () => {
    // Đơn PENDING đã nằm trong CSDL và trang "Vé của tôi" có sẵn nút thanh toán lại cho
    // nó — đường đó chạy được cả từ máy khác, tốt hơn hẳn một màn thanh toán dựng lại từ
    // bản nháp và có thể đã hết hiệu lực.
    writeDraft(MODE, draftHopLe({ step: 'payment' }));
    expect(readDraft(MODE)).toBeNull();
  });
});

describe('verifyHeldSeats', () => {
  const ghe = (id, tempLockedBy, booked = false) => ({ id, tempLockedBy, booked });
  const con5Phut = Date.now() + 5 * 60 * 1000;

  it('ghế vẫn mang mã của mình và hạn giữ còn thì đi tiếp được', () => {
    const ketQua = verifyHeldSeats({
      seats: [ghe(1, MY_TOKEN), ghe(2, MY_TOKEN)],
      selectedSeatIds: [1, 2],
      ownerToken: MY_TOKEN,
      lockDeadline: con5Phut,
    });
    expect(ketQua).toEqual({ ok: true, keptSeatIds: [1, 2], lostSeatIds: [] });
  });

  it('ghế đã sang tay người khác thì không đi tiếp', () => {
    const ketQua = verifyHeldSeats({
      seats: [ghe(1, MY_TOKEN), ghe(2, NGUOI_KHAC)],
      selectedSeatIds: [1, 2],
      ownerToken: MY_TOKEN,
      lockDeadline: con5Phut,
    });
    expect(ketQua.ok).toBe(false);
    expect(ketQua.keptSeatIds).toEqual([1]);
    expect(ketQua.lostSeatIds).toEqual([2]);
  });

  it('ghế đã thành vé của người khác thì mất, dù mã còn khớp', () => {
    const ketQua = verifyHeldSeats({
      seats: [ghe(1, MY_TOKEN, true)],
      selectedSeatIds: [1],
      ownerToken: MY_TOKEN,
      lockDeadline: con5Phut,
    });
    expect(ketQua.ok).toBe(false);
    expect(ketQua.lostSeatIds).toEqual([1]);
  });

  it('ghế biến mất khỏi sơ đồ thì coi như mất', () => {
    const ketQua = verifyHeldSeats({
      seats: [ghe(1, MY_TOKEN)],
      selectedSeatIds: [1, 99],
      ownerToken: MY_TOKEN,
      lockDeadline: con5Phut,
    });
    expect(ketQua.ok).toBe(false);
    expect(ketQua.lostSeatIds).toEqual([99]);
  });

  it('lock chưa bị dọn nhưng đã quá hạn thì không đi tiếp', () => {
    // releaseExpiredLocks chỉ chạy mỗi 10 giây, nên máy chủ vẫn có thể trả về mã của mình
    // trong khoảng đó. Hạn giữ mới là thứ quyết định.
    const ketQua = verifyHeldSeats({
      seats: [ghe(1, MY_TOKEN)],
      selectedSeatIds: [1],
      ownerToken: MY_TOKEN,
      lockDeadline: Date.now() - 1000,
    });
    expect(ketQua.ok).toBe(false);
    expect(ketQua.keptSeatIds).toEqual([1]);
  });

  it('chưa có hạn giữ thì không đi tiếp', () => {
    const ketQua = verifyHeldSeats({
      seats: [ghe(1, MY_TOKEN)],
      selectedSeatIds: [1],
      ownerToken: MY_TOKEN,
      lockDeadline: null,
    });
    expect(ketQua.ok).toBe(false);
  });

  it('chưa biết mã của chính mình thì không kết luận gì', () => {
    // Nơi gọi phải chờ có mã rồi mới hỏi. Trả "mất hết" ở đây chính là để chỗ nào lỡ hỏi
    // sớm cũng không vô tình cho người dùng đi tiếp với ghế chưa xác minh.
    const ketQua = verifyHeldSeats({
      seats: [ghe(1, MY_TOKEN)],
      selectedSeatIds: [1],
      ownerToken: null,
      lockDeadline: con5Phut,
    });
    expect(ketQua).toEqual({ ok: false, keptSeatIds: [], lostSeatIds: [1] });
  });

  it('không chọn ghế nào thì không có gì để đi tiếp', () => {
    expect(verifyHeldSeats({
      seats: [],
      selectedSeatIds: [],
      ownerToken: MY_TOKEN,
      lockDeadline: con5Phut,
    }).ok).toBe(false);
  });
});
