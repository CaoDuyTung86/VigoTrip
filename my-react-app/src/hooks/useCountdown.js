import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

const nowInSeconds = () => Math.floor(Date.now() / 1000);

/**
 * Mốc thời gian hiện tại (đơn vị giây), tự cập nhật mỗi giây khi `active`.
 * Cắt về giây để mỗi giây chỉ render lại một lần, và snapshot được cache đúng
 * theo hợp đồng của useSyncExternalStore (chỉ đổi khi đồng hồ báo).
 */
function useClock(active) {
  const snapshotRef = useRef(nowInSeconds());

  const subscribe = useCallback(
    (onChange) => {
      if (!active) return () => {};

      // Đồng hồ có thể đã dừng từ lâu — đọc lại ngay để không hiện số cũ
      snapshotRef.current = nowInSeconds();
      onChange();

      const interval = setInterval(() => {
        snapshotRef.current = nowInSeconds();
        onChange();
      }, 1000);
      return () => clearInterval(interval);
    },
    [active]
  );

  return useSyncExternalStore(subscribe, () => snapshotRef.current);
}

/**
 * Đếm ngược tới một mốc thời gian (timestamp ms), trả về số giây còn lại
 * — hoặc null khi không có mốc nào đang chạy.
 *
 * `onExpire` được giữ trong ref nên đổi callback không làm chạy lại đồng hồ:
 * bộ đếm chỉ phụ thuộc vào `deadline`, không nhảy số mỗi lần component render.
 *
 * @param {number|null} deadline mốc hết hạn (Date.now() + ms), null để tắt
 * @param {() => void} onExpire chạy đúng một lần khi đếm về 0
 * @returns {number|null} số giây còn lại
 */
export default function useCountdown(deadline, onExpire) {
  const clock = useClock(Boolean(deadline));
  const onExpireRef = useRef(onExpire);

  // Luôn giữ callback mới nhất mà không đụng tới đồng hồ đang chạy
  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  const secondsLeft = deadline ? Math.max(0, Math.ceil(deadline / 1000 - clock)) : null;

  useEffect(() => {
    if (secondsLeft === 0) {
      onExpireRef.current?.();
    }
  }, [secondsLeft]);

  return secondsLeft;
}
