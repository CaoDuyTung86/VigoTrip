import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import useCountdown from './useCountdown';

// Đồng hồ giả: không phải chờ thật 10 phút để test bộ giữ ghế hết hạn.
const START = new Date('2026-06-01T10:00:00.000Z').getTime();

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Đẩy đồng hồ giả đi n giây, bọc trong act() để React kịp render lại
  const tick = async (seconds) => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(seconds * 1000);
    });
  };

  it('trả null khi không có deadline', () => {
    const { result } = renderHook(() => useCountdown(null, vi.fn()));
    expect(result.current).toBeNull();
  });

  it('trả số giây còn lại ngay lần render đầu', () => {
    const { result } = renderHook(() => useCountdown(START + 600_000, vi.fn()));
    expect(result.current).toBe(600);
  });

  it('đếm lùi mỗi giây', async () => {
    const { result } = renderHook(() => useCountdown(START + 10_000, vi.fn()));
    expect(result.current).toBe(10);

    await tick(1);
    expect(result.current).toBe(9);

    await tick(4);
    expect(result.current).toBe(5);
  });

  it('gọi onExpire đúng một lần khi về 0 và không âm', async () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() => useCountdown(START + 3_000, onExpire));

    await tick(2);
    expect(onExpire).not.toHaveBeenCalled();

    await tick(1);
    expect(result.current).toBe(0);
    expect(onExpire).toHaveBeenCalledTimes(1);

    // Chạy tiếp: không được gọi lại, không được xuống số âm
    await tick(5);
    expect(result.current).toBe(0);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('deadline đã qua thì về 0 và báo hết hạn ngay', () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() => useCountdown(START - 60_000, onExpire));
    expect(result.current).toBe(0);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('đổi onExpire không làm nhảy đồng hồ đang chạy', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(
      ({ cb }) => useCountdown(START + 3_000, cb),
      { initialProps: { cb: first } }
    );

    await tick(1);
    expect(result.current).toBe(2);

    rerender({ cb: second });
    expect(result.current).toBe(2); // không reset về 3

    await tick(2);
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled(); // luôn dùng callback mới nhất
  });

  it('dọn interval khi unmount', async () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    const { unmount } = renderHook(() => useCountdown(START + 60_000, vi.fn()));
    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });
});
