import { describe, it, expect, beforeEach } from 'vitest';
import { getDeviceKey, isSeatLockedByOthers } from './seatBookingHelpers';

const SESSION_KEY = 'vigo_device_session_key';
const MY_TOKEN = 'ownertoken_cua_toi';

describe('getDeviceKey', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sinh khoá thiết bị và lưu lại', () => {
    const id = getDeviceKey();
    expect(id).toMatch(/^sess_\d+_/);
    expect(localStorage.getItem(SESSION_KEY)).toBe(id);
  });

  it('giữ nguyên khoá giữa các lần gọi (không đổi danh tính giữa chừng)', () => {
    const first = getDeviceKey();
    const second = getDeviceKey();
    expect(second).toBe(first);
  });

  it('khớp hình dạng mà máy chủ chấp nhận cho header X-Guest-Key', () => {
    // StompAuthChannelInterceptor.GUEST_KEY_PATTERN: sess_ + 4..96 ký tự [A-Za-z0-9_-]
    expect(getDeviceKey()).toMatch(/^sess_[A-Za-z0-9_-]{4,96}$/);
  });
});

describe('isSeatLockedByOthers', () => {
  it('ghế chưa ai giữ thì không bị khoá', () => {
    expect(isSeatLockedByOthers({ tempLockedBy: null }, MY_TOKEN)).toBe(false);
    expect(isSeatLockedByOthers({}, MY_TOKEN)).toBe(false);
  });

  it('ghế mang mã của chính mình thì không bị khoá', () => {
    expect(isSeatLockedByOthers({ tempLockedBy: MY_TOKEN }, MY_TOKEN)).toBe(false);
  });

  it('ghế mang mã người khác thì bị khoá', () => {
    expect(isSeatLockedByOthers({ tempLockedBy: 'ownertoken_ai_do' }, MY_TOKEN)).toBe(true);
  });

  it('chưa biết mã của mình thì coi ghế đang bị giữ là của người khác', () => {
    // Vừa nối, máy chủ chưa kịp cấp mã. Thà chặn nhầm một nhịp còn hơn cho bấm vào ghế
    // người khác rồi hỏng ở bước tạo đơn.
    expect(isSeatLockedByOthers({ tempLockedBy: 'ownertoken_ai_do' }, null)).toBe(true);
  });
});
