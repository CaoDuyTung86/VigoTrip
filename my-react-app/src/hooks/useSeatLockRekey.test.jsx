import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import useSeatLockRekey from './useSeatLockRekey';

const DEVICE_KEY = 'sess_1786867631410_1hhgv221d13leu';
const EMAIL = 'nguoi.dung@gmail.com';

const setup = (overrides = {}) => {
  const lockSeats = vi.fn().mockResolvedValue({ success: true, failed: [] });
  const unlockSeats = vi.fn();
  const onFailure = vi.fn();

  const props = {
    ownerId: DEVICE_KEY,
    tripId: 42,
    seatIds: [1, 2],
    active: true,
    lockSeats,
    unlockSeats,
    onFailure,
    ...overrides,
  };

  const view = renderHook((p) => useSeatLockRekey(p), { initialProps: props });
  return { ...view, props, lockSeats, unlockSeats, onFailure };
};

describe('useSeatLockRekey', () => {
  it('không làm gì khi danh tính không đổi', async () => {
    const { rerender, props, lockSeats, unlockSeats } = setup();

    await act(async () => rerender({ ...props, seatIds: [1, 2, 3] }));

    expect(unlockSeats).not.toHaveBeenCalled();
    expect(lockSeats).not.toHaveBeenCalled();
  });

  it('chuyển lock từ khoá thiết bị sang email khi người dùng đăng nhập', async () => {
    const { rerender, props, lockSeats, unlockSeats, onFailure } = setup();

    await act(async () => rerender({ ...props, ownerId: EMAIL }));

    expect(unlockSeats).toHaveBeenCalledWith({ tripId: 42, seatIds: [1, 2], userId: DEVICE_KEY });
    expect(lockSeats).toHaveBeenCalledWith({ tripId: 42, seatIds: [1, 2], userId: EMAIL });
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('chuyển ngược lại khi người dùng đăng xuất giữa chừng', async () => {
    const { rerender, props, lockSeats, unlockSeats } = setup({ ownerId: EMAIL });

    await act(async () => rerender({ ...props, ownerId: DEVICE_KEY }));

    expect(unlockSeats).toHaveBeenCalledWith({ tripId: 42, seatIds: [1, 2], userId: EMAIL });
    expect(lockSeats).toHaveBeenCalledWith({ tripId: 42, seatIds: [1, 2], userId: DEVICE_KEY });
  });

  it('bỏ qua khi chưa có lock tạm nào ở backend (còn ở bước chọn ghế)', async () => {
    const { rerender, props, lockSeats, unlockSeats } = setup({ active: false });

    await act(async () => rerender({ ...props, active: false, ownerId: EMAIL }));

    expect(unlockSeats).not.toHaveBeenCalled();
    expect(lockSeats).not.toHaveBeenCalled();
  });

  it('bỏ qua khi không giữ ghế nào', async () => {
    const { rerender, props, lockSeats, unlockSeats } = setup({ seatIds: [] });

    await act(async () => rerender({ ...props, seatIds: [], ownerId: EMAIL }));

    expect(unlockSeats).not.toHaveBeenCalled();
    expect(lockSeats).not.toHaveBeenCalled();
  });

  it('báo onFailure khi giữ lại ghế không thành công', async () => {
    const lockSeats = vi.fn().mockResolvedValue({ success: false, failed: [2], error: 'TIMEOUT' });
    const { rerender, props, onFailure } = setup({ lockSeats });

    await act(async () => rerender({ ...props, lockSeats, ownerId: EMAIL }));

    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  it('giữ nguyên danh sách ghế tại thời điểm đổi danh tính', async () => {
    const { rerender, props, unlockSeats } = setup();

    await act(async () => rerender({ ...props, ownerId: EMAIL }));

    const sentSeats = unlockSeats.mock.calls[0][0].seatIds;
    props.seatIds.push(99); // mảng gốc bị sửa sau đó không được ảnh hưởng tới lệnh đã gửi
    expect(sentSeats).toEqual([1, 2]);
  });
});
