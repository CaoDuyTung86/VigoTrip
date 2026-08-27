import { describe, it, expect, beforeEach } from 'vitest';
import { getSeatUserId, isSeatLockedByOthers } from './seatBookingHelpers';

const SESSION_KEY = 'vigo_device_session_key';

describe('getSeatUserId', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('ưu tiên email khi đã đăng nhập', () => {
    expect(getSeatUserId({ email: 'a@b.com' })).toBe('a@b.com');
    // Không được ghi session key rác khi user đã có email
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('sinh session key cho khách vãng lai và lưu lại', () => {
    const id = getSeatUserId(null);
    expect(id).toMatch(/^sess_\d+_/);
    expect(localStorage.getItem(SESSION_KEY)).toBe(id);
  });

  it('giữ nguyên session key giữa các lần gọi (không đổi danh tính giữa chừng)', () => {
    const first = getSeatUserId(null);
    const second = getSeatUserId(undefined);
    expect(second).toBe(first);
  });

  it('rơi về session key khi user không có email', () => {
    const id = getSeatUserId({ name: 'khách' });
    expect(id).toMatch(/^sess_/);
  });
});

describe('isSeatLockedByOthers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('ghế chưa ai giữ thì không bị khoá', () => {
    expect(isSeatLockedByOthers({ tempLockedBy: null }, { email: 'a@b.com' })).toBe(false);
    expect(isSeatLockedByOthers({}, null)).toBe(false);
  });

  it('ghế do chính mình giữ thì không bị coi là của người khác', () => {
    const user = { email: 'a@b.com' };
    expect(isSeatLockedByOthers({ tempLockedBy: 'a@b.com' }, user)).toBe(false);
  });

  it('ghế do người khác giữ thì bị khoá', () => {
    expect(isSeatLockedByOthers({ tempLockedBy: 'x@y.com' }, { email: 'a@b.com' })).toBe(true);
  });

  it('khách vãng lai vẫn nhận ra ghế mình đang giữ qua session key', () => {
    const sessionId = getSeatUserId(null);
    expect(isSeatLockedByOthers({ tempLockedBy: sessionId }, null)).toBe(false);
    expect(isSeatLockedByOthers({ tempLockedBy: 'ai-do-khac' }, null)).toBe(true);
  });
});
