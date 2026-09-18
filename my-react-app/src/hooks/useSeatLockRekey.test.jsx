// @ts-check
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import useSeatLockRekey from './useSeatLockRekey';

// Mã chủ sở hữu do máy chủ cấp: đổi khi danh tính đổi (khách -> tài khoản và ngược lại).
const GUEST_TOKEN = 'ownertoken_khach1';
const USER_TOKEN = 'ownertoken_taikho';

const setup = (overrides = {}) => {
  const handoverSeats = vi.fn().mockResolvedValue({ success: true, failed: [] });
  const onFailure = vi.fn();

  const props = {
    ownerToken: GUEST_TOKEN,
    tripId: 42,
    seatIds: [1, 2],
    active: true,
    handoverSeats,
    onFailure,
    ...overrides,
  };

  const view = renderHook((p) => useSeatLockRekey(p), { initialProps: props });
  return { ...view, props, handoverSeats, onFailure };
};

describe('useSeatLockRekey', () => {
  it('không làm gì khi danh tính không đổi', async () => {
    const { rerender, props, handoverSeats } = setup();

    await act(async () => rerender({ ...props, seatIds: [1, 2, 3] }));

    expect(handoverSeats).not.toHaveBeenCalled();
  });

  it('nhận lại ghế bằng một thao tác khi người dùng đăng nhập', async () => {
    const { rerender, props, handoverSeats, onFailure } = setup();

    await act(async () => rerender({ ...props, ownerToken: USER_TOKEN }));

    // Một lời gọi cho cả lô, không còn cặp nhả-rồi-giữ-lại để hở ghế ở giữa.
    expect(handoverSeats).toHaveBeenCalledTimes(1);
    expect(handoverSeats).toHaveBeenCalledWith({ tripId: 42, seatIds: [1, 2] });
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('bỏ qua nhịp mã tạm về null lúc nối lại, không coi là đổi danh tính', async () => {
    const { rerender, props, handoverSeats } = setup();

    // Đăng nhập -> WebSocket dựng kết nối mới -> mã tạm null một nhịp rồi mới có mã mới.
    await act(async () => rerender({ ...props, ownerToken: null }));
    expect(handoverSeats).not.toHaveBeenCalled();

    await act(async () => rerender({ ...props, ownerToken: USER_TOKEN }));
    expect(handoverSeats).toHaveBeenCalledTimes(1);
    expect(handoverSeats).toHaveBeenCalledWith({ tripId: 42, seatIds: [1, 2] });
  });

  it('bỏ qua khi chưa có lock tạm nào ở backend (còn ở bước chọn ghế)', async () => {
    const { rerender, props, handoverSeats } = setup({ active: false });

    await act(async () => rerender({ ...props, active: false, ownerToken: USER_TOKEN }));

    expect(handoverSeats).not.toHaveBeenCalled();
  });

  it('bỏ qua khi không giữ ghế nào', async () => {
    const { rerender, props, handoverSeats } = setup({ seatIds: [] });

    await act(async () => rerender({ ...props, seatIds: [], ownerToken: USER_TOKEN }));

    expect(handoverSeats).not.toHaveBeenCalled();
  });

  it('báo onFailure khi nhận lại ghế không thành công', async () => {
    const handoverSeats = vi.fn().mockResolvedValue({ success: false, failed: [2] });
    const { rerender, props, onFailure } = setup({ handoverSeats });

    await act(async () => rerender({ ...props, handoverSeats, ownerToken: USER_TOKEN }));

    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  it('giữ nguyên danh sách ghế tại thời điểm đổi danh tính', async () => {
    const { rerender, props, handoverSeats } = setup();

    await act(async () => rerender({ ...props, ownerToken: USER_TOKEN }));

    const sentSeats = handoverSeats.mock.calls[0][0].seatIds;
    props.seatIds.push(99); // mảng gốc bị sửa sau đó không được ảnh hưởng tới lệnh đã gửi
    expect(sentSeats).toEqual([1, 2]);
  });
});
