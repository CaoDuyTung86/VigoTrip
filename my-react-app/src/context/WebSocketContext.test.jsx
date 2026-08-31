import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

// Client STOMP giả: đủ để mô phỏng đúng ba tình huống đã làm hỏng việc giữ ghế trên
// production — echo về đủ, echo về thiếu (timeout), và rớt kết nối giữa chừng.
let fakeClient = null;

const createFakeClient = (config) => {
    const subscribers = new Map(); // destination -> Map<id, callback>
    let nextId = 0;

    return {
        config,
        connected: false,
        published: [],

        activate() {
            this.activated = true;
        },
        deactivate() {
            this.connected = false;
        },
        subscribe(destination, callback) {
            const id = `sub-${nextId++}`;
            if (!subscribers.has(destination)) subscribers.set(destination, new Map());
            subscribers.get(destination).set(id, callback);
            return {
                id,
                unsubscribe: () => subscribers.get(destination)?.delete(id),
            };
        },
        publish(frame) {
            this.published.push(frame);
        },

        // --- tiện ích cho test ---
        /** Kết nối lên: client.activate() ở provider chỉ khởi động, chưa phải đã nối được. */
        connect() {
            this.connected = true;
            this.onConnect?.({});
        },
        subscriberCount(destination) {
            return subscribers.get(destination)?.size ?? 0;
        },
        emit(destination, payload) {
            [...(subscribers.get(destination)?.values() ?? [])].forEach((cb) =>
                cb({ body: JSON.stringify(payload) }),
            );
        },
        /** Rớt kết nối đột ngột: không có frame DISCONNECT, chỉ socket đóng. */
        dropConnection() {
            this.connected = false;
            subscribers.clear();
            this.onWebSocketClose?.({});
        },
    };
};

// Cả hai đều được gọi bằng `new`, nên implementation phải là function thường
// (arrow function không dùng làm constructor được).
vi.mock('sockjs-client', () => ({
    default: vi.fn(function SockJS() {
        return {};
    }),
}));

vi.mock('@stomp/stompjs', () => ({
    Client: vi.fn(function Client(config) {
        fakeClient = createFakeClient(config);
        return fakeClient;
    }),
}));

const { WebSocketProvider, useWebSocket } = await import('./WebSocketContext');

const SEAT_STATUS_TOPIC = '/topic/seat-status';
const TRIP_ID = 42;
const USER_ID = 'sess_test_user';

const renderWs = () => {
    const wrapper = ({ children }) => <WebSocketProvider>{children}</WebSocketProvider>;
    return renderHook(() => useWebSocket(), { wrapper });
};

const selected = (seatId, userId = USER_ID) => ({
    tripId: TRIP_ID,
    seatId,
    status: 'SELECTED',
    userId,
});

describe('WebSocketProvider', () => {
    beforeEach(() => {
        fakeClient = null;
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('nối SockJS tới VITE_WS_URL nếu có, ngược lại dùng /ws', async () => {
        const SockJS = (await import('sockjs-client')).default;
        SockJS.mockClear();

        const { unmount } = renderWs();
        act(() => fakeClient.config.webSocketFactory());

        // Test chạy không có VITE_WS_URL -> mặc định '/ws' (proxy của Vite lúc dev)
        expect(SockJS).toHaveBeenCalledWith(import.meta.env.VITE_WS_URL || '/ws');
        unmount();
    });

    it('lockSeats thành công khi tất cả ghế đều có phản hồi SELECTED', async () => {
        const { result } = renderWs();
        act(() => fakeClient.connect());

        let promise;
        act(() => {
            promise = result.current.lockSeats({ tripId: TRIP_ID, seatIds: [1, 2, 3], userId: USER_ID });
        });

        expect(fakeClient.published).toHaveLength(3);

        await act(async () => {
            [1, 2, 3].forEach((id) => fakeClient.emit(SEAT_STATUS_TOPIC, selected(id)));
        });

        await expect(promise).resolves.toEqual({ success: true, failed: [] });
    });

    it('bỏ qua echo của người khác và của chuyến khác', async () => {
        const { result } = renderWs();
        act(() => fakeClient.connect());

        let promise;
        act(() => {
            promise = result.current.lockSeats({ tripId: TRIP_ID, seatIds: [1], userId: USER_ID });
        });

        await act(async () => {
            fakeClient.emit(SEAT_STATUS_TOPIC, selected(1, 'nguoi-khac'));
            fakeClient.emit(SEAT_STATUS_TOPIC, { ...selected(1), tripId: 999 });
        });

        // Chưa có echo hợp lệ nào -> vẫn phải chờ tới hết timeout
        await act(async () => {
            await vi.advanceTimersByTimeAsync(8000);
        });

        await expect(promise).resolves.toEqual({ success: false, failed: [1], error: 'TIMEOUT' });
    });

    it('ghép email không phân biệt hoa thường (tài khoản Google)', async () => {
        const { result } = renderWs();
        act(() => fakeClient.connect());

        let promise;
        act(() => {
            promise = result.current.lockSeats({ tripId: TRIP_ID, seatIds: [7], userId: 'Nguoi.Dung@Gmail.com' });
        });

        await act(async () => {
            fakeClient.emit(SEAT_STATUS_TOPIC, selected(7, 'nguoi.dung@gmail.com'));
        });

        await expect(promise).resolves.toEqual({ success: true, failed: [] });
    });

    it('trả DISCONNECTED ngay khi rớt kết nối giữa chừng, không chờ hết timeout', async () => {
        const { result } = renderWs();
        act(() => fakeClient.connect());

        let promise;
        act(() => {
            promise = result.current.lockSeats({ tripId: TRIP_ID, seatIds: [1, 2], userId: USER_ID });
        });

        await act(async () => {
            fakeClient.emit(SEAT_STATUS_TOPIC, selected(1));
        });

        // Đứt kết nối khi ghế 2 chưa có phản hồi. Trước đây promise treo tới lúc timeout
        // rồi trả error TIMEOUT kèm failed=[2] -> giao diện báo nhầm "ghế đã có người khác
        // chọn" và xoá ghế đang chọn.
        await act(async () => {
            fakeClient.dropConnection();
        });

        await expect(promise).resolves.toEqual({ success: false, failed: [2], error: 'DISCONNECTED' });
    });

    it('trả NOT_CONNECTED khi chưa có kết nối', async () => {
        const { result } = renderWs();

        const res = await result.current.lockSeats({ tripId: TRIP_ID, seatIds: [1], userId: USER_ID });
        expect(res).toEqual({ success: false, failed: [1], error: 'NOT_CONNECTED' });
    });

    it('đăng ký lại subscription sau khi reconnect', async () => {
        const { result } = renderWs();
        act(() => fakeClient.connect());

        const received = [];
        act(() => {
            result.current.subscribe(SEAT_STATUS_TOPIC, (update) => received.push(update.seatId));
        });

        act(() => fakeClient.emit(SEAT_STATUS_TOPIC, selected(1)));
        expect(received).toEqual([1]);

        // Rớt rồi nối lại: người nghe cũ phải được nối vào phiên STOMP mới, nếu không thì
        // mọi phản hồi giữ ghế sau đó đều rơi vào hư không.
        act(() => fakeClient.dropConnection());
        act(() => fakeClient.connect());

        act(() => fakeClient.emit(SEAT_STATUS_TOPIC, selected(2)));
        expect(received).toEqual([1, 2]);
    });

    it('nhiều người nghe dùng chung một subscription STOMP', async () => {
        const { result } = renderWs();
        act(() => fakeClient.connect());

        const a = [];
        const b = [];
        let handleA;
        let handleB;
        act(() => {
            handleA = result.current.subscribe(SEAT_STATUS_TOPIC, (u) => a.push(u.seatId));
            handleB = result.current.subscribe(SEAT_STATUS_TOPIC, (u) => b.push(u.seatId));
        });

        expect(fakeClient.subscriberCount(SEAT_STATUS_TOPIC)).toBe(1);

        act(() => fakeClient.emit(SEAT_STATUS_TOPIC, selected(5)));
        expect(a).toEqual([5]);
        expect(b).toEqual([5]);

        // Gỡ một người nghe không được làm điếc người còn lại
        act(() => handleA.unsubscribe());
        act(() => fakeClient.emit(SEAT_STATUS_TOPIC, selected(6)));
        expect(a).toEqual([5]);
        expect(b).toEqual([5, 6]);

        act(() => handleB.unsubscribe());
        expect(fakeClient.subscriberCount(SEAT_STATUS_TOPIC)).toBe(0);
    });
});
