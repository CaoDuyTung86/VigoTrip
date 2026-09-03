import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

// Client STOMP giả: đủ để mô phỏng đúng những tình huống đã làm hỏng việc giữ ghế trên
// production — echo về đủ, echo về thiếu (timeout), rớt kết nối giữa chừng — cộng thêm
// phần bắt tay danh tính mới thêm (server cấp mã chủ sở hữu sau khi CONNECT).
let fakeClient = null;

const IDENTITY_QUEUE = '/user/queue/identity';
const USER_SEAT_QUEUE = '/user/queue/seat-status';
const TRIP_ID = 42;
const tripTopic = (tripId) => `/topic/seat-status/${tripId}`;

const MY_TOKEN = 'ownertoken_me_01';
const OTHER_TOKEN = 'ownertoken_kh_02';

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
        /**
         * Kết nối lên và trả lời /app/whoami như máy chủ thật: client.activate() ở provider
         * chỉ khởi động, chưa phải đã nối được.
         */
        connect({ ownerToken = MY_TOKEN, authenticated = false } = {}) {
            this.connected = true;
            this.onConnect?.({});
            this.emit(IDENTITY_QUEUE, { ownerToken, authenticated });
        },
        /** Nối lên nhưng máy chủ chưa kịp cấp danh tính. */
        connectWithoutIdentity() {
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
        /** Máy chủ từ chối frame CONNECT (token hỏng/hết hạn/tài khoản bị khoá). */
        rejectAuth() {
            this.connected = false;
            this.onStompError?.({ headers: { message: 'WS_AUTH_INVALID_TOKEN' }, body: '' });
        },
        framesTo(destination) {
            return this.published.filter((f) => f.destination === destination);
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
const { AuthContext } = await import('./AuthContext');

const renderWs = ({ token = null } = {}) => {
    const wrapper = ({ children }) => (
        <AuthContext.Provider value={{ token }}>
            <WebSocketProvider>{children}</WebSocketProvider>
        </AuthContext.Provider>
    );
    return renderHook(() => useWebSocket(), { wrapper });
};

const selected = (seatId, ownerToken = MY_TOKEN, tripId = TRIP_ID) => ({
    tripId,
    seatId,
    status: 'SELECTED',
    ownerToken,
});

const lockFailed = (seatId, tripId = TRIP_ID) => ({
    tripId,
    seatId,
    status: 'LOCK_FAILED',
    ownerToken: null,
});

describe('WebSocketProvider', () => {
    beforeEach(() => {
        fakeClient = null;
        localStorage.clear();
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

    describe('xác thực ở frame CONNECT', () => {
        it('khách chưa đăng nhập chỉ gửi khoá thiết bị', () => {
            renderWs();
            expect(fakeClient.config.connectHeaders['X-Guest-Key']).toMatch(/^sess_/);
            expect(fakeClient.config.connectHeaders.Authorization).toBeUndefined();
        });

        it('đã đăng nhập thì gửi JWT — danh tính không còn nằm trong thân thông điệp', () => {
            renderWs({ token: 'jwt-abc' });
            expect(fakeClient.config.connectHeaders.Authorization).toBe('Bearer jwt-abc');
            // Vẫn gửi khoá thiết bị để máy chủ chuyển được ghế đã giữ lúc còn là khách.
            expect(fakeClient.config.connectHeaders['X-Guest-Key']).toMatch(/^sess_/);
        });

        it('token bị từ chối thì nối lại dưới dạng khách thay vì quay vòng vô tận', async () => {
            renderWs({ token: 'jwt-het-han' });
            expect(fakeClient.config.connectHeaders.Authorization).toBe('Bearer jwt-het-han');

            await act(async () => {
                fakeClient.rejectAuth();
            });

            // Client mới được dựng, lần này không mang token hỏng nữa.
            expect(fakeClient.config.connectHeaders.Authorization).toBeUndefined();
            expect(fakeClient.config.connectHeaders['X-Guest-Key']).toMatch(/^sess_/);
        });
    });

    describe('lockSeats', () => {
        it('thành công khi tất cả ghế đều có phản hồi SELECTED mang mã của mình', async () => {
            const { result } = renderWs();
            act(() => fakeClient.connect());

            let promise;
            await act(async () => {
                promise = result.current.lockSeats({ tripId: TRIP_ID, seatIds: [1, 2, 3] });
            });

            const frames = fakeClient.framesTo('/app/seat-selection');
            expect(frames).toHaveLength(3);
            // Không còn userId trong thân thông điệp — máy chủ tự suy ra danh tính.
            expect(JSON.parse(frames[0].body)).toEqual({ tripId: TRIP_ID, seatId: 1, status: 'SELECTED' });

            await act(async () => {
                [1, 2, 3].forEach((id) => fakeClient.emit(tripTopic(TRIP_ID), selected(id)));
            });

            await expect(promise).resolves.toEqual({ success: true, failed: [] });
        });

        it('bỏ qua echo mang mã chủ sở hữu của người khác', async () => {
            const { result } = renderWs();
            act(() => fakeClient.connect());

            let promise;
            await act(async () => {
                promise = result.current.lockSeats({ tripId: TRIP_ID, seatIds: [1] });
            });

            await act(async () => {
                fakeClient.emit(tripTopic(TRIP_ID), selected(1, OTHER_TOKEN));
            });

            // Chưa có echo hợp lệ nào -> vẫn phải chờ tới hết timeout
            await act(async () => {
                await vi.advanceTimersByTimeAsync(8000);
            });

            await expect(promise).resolves.toEqual({ success: false, failed: [1], error: 'TIMEOUT' });
        });

        it('nhận LOCK_FAILED trên hàng đợi riêng, không phải kênh chung của chuyến', async () => {
            const { result } = renderWs();
            act(() => fakeClient.connect());

            let promise;
            await act(async () => {
                promise = result.current.lockSeats({ tripId: TRIP_ID, seatIds: [1, 2] });
            });

            await act(async () => {
                fakeClient.emit(tripTopic(TRIP_ID), selected(1));
                fakeClient.emit(USER_SEAT_QUEUE, lockFailed(2));
            });

            await expect(promise).resolves.toEqual({ success: false, failed: [2] });
        });

        it('trả DISCONNECTED ngay khi rớt kết nối giữa chừng, không chờ hết timeout', async () => {
            const { result } = renderWs();
            act(() => fakeClient.connect());

            let promise;
            await act(async () => {
                promise = result.current.lockSeats({ tripId: TRIP_ID, seatIds: [1, 2] });
            });

            await act(async () => {
                fakeClient.emit(tripTopic(TRIP_ID), selected(1));
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

            const res = await result.current.lockSeats({ tripId: TRIP_ID, seatIds: [1] });
            expect(res).toEqual({ success: false, failed: [1], error: 'NOT_CONNECTED' });
        });

        it('trả NO_IDENTITY khi máy chủ không cấp mã chủ sở hữu', async () => {
            const { result } = renderWs();
            act(() => fakeClient.connectWithoutIdentity());

            let promise;
            await act(async () => {
                promise = result.current.lockSeats({ tripId: TRIP_ID, seatIds: [1] });
            });

            // Không có mã của chính mình thì không phân biệt nổi echo của ai; thà báo lỗi
            // còn hơn chấm nhầm ghế người khác thành ghế của mình.
            await act(async () => {
                await vi.advanceTimersByTimeAsync(8000);
            });

            await expect(promise).resolves.toEqual({ success: false, failed: [1], error: 'NO_IDENTITY' });
        });
    });

    it('handoverSeats gửi một frame duy nhất cho cả lô ghế', async () => {
        const { result } = renderWs({ token: 'jwt-abc' });
        act(() => fakeClient.connect({ authenticated: true }));

        let promise;
        await act(async () => {
            promise = result.current.handoverSeats({ tripId: TRIP_ID, seatIds: [1, 2] });
        });

        // Một thao tác cho cả lô: không còn khoảng ghế trống giữa nhả và giữ lại như cách
        // frontend tự xoay xở trước đây.
        const frames = fakeClient.framesTo('/app/seat-handover');
        expect(frames).toHaveLength(1);
        expect(JSON.parse(frames[0].body)).toEqual({ tripId: TRIP_ID, seatIds: [1, 2] });

        await act(async () => {
            [1, 2].forEach((id) => fakeClient.emit(tripTopic(TRIP_ID), selected(id)));
        });

        await expect(promise).resolves.toEqual({ success: true, failed: [] });
    });

    it('unlockSeats không gửi danh tính lên nữa', async () => {
        const { result } = renderWs();
        act(() => fakeClient.connect());

        act(() => result.current.unlockSeats({ tripId: TRIP_ID, seatIds: [3] }));

        const frames = fakeClient.framesTo('/app/seat-selection');
        expect(frames).toHaveLength(1);
        expect(JSON.parse(frames[0].body)).toEqual({ tripId: TRIP_ID, seatId: 3, status: 'AVAILABLE' });
    });

    it('đăng ký lại subscription sau khi reconnect', async () => {
        const { result } = renderWs();
        act(() => fakeClient.connect());

        const received = [];
        act(() => {
            result.current.subscribeToTrip(TRIP_ID, (update) => received.push(update.seatId));
        });

        act(() => fakeClient.emit(tripTopic(TRIP_ID), selected(1)));
        expect(received).toEqual([1]);

        // Rớt rồi nối lại: người nghe cũ phải được nối vào phiên STOMP mới, nếu không thì
        // mọi phản hồi giữ ghế sau đó đều rơi vào hư không.
        act(() => fakeClient.dropConnection());
        act(() => fakeClient.connect());

        act(() => fakeClient.emit(tripTopic(TRIP_ID), selected(2)));
        expect(received).toEqual([1, 2]);
    });

    it('mỗi chuyến một kênh riêng — không nhận sự kiện của chuyến khác', async () => {
        const { result } = renderWs();
        act(() => fakeClient.connect());

        const received = [];
        act(() => {
            result.current.subscribeToTrip(TRIP_ID, (update) => received.push(update.seatId));
        });

        act(() => fakeClient.emit(tripTopic(999), selected(9, MY_TOKEN, 999)));
        expect(received).toEqual([]);

        act(() => fakeClient.emit(tripTopic(TRIP_ID), selected(1)));
        expect(received).toEqual([1]);
    });

    it('nhiều người nghe dùng chung một subscription STOMP', async () => {
        const { result } = renderWs();
        act(() => fakeClient.connect());

        const a = [];
        const b = [];
        let handleA;
        let handleB;
        act(() => {
            handleA = result.current.subscribeToTrip(TRIP_ID, (u) => a.push(u.seatId));
            handleB = result.current.subscribeToTrip(TRIP_ID, (u) => b.push(u.seatId));
        });

        expect(fakeClient.subscriberCount(tripTopic(TRIP_ID))).toBe(1);

        act(() => fakeClient.emit(tripTopic(TRIP_ID), selected(5)));
        expect(a).toEqual([5]);
        expect(b).toEqual([5]);

        // Gỡ một người nghe không được làm điếc người còn lại
        act(() => handleA.unsubscribe());
        act(() => fakeClient.emit(tripTopic(TRIP_ID), selected(6)));
        expect(a).toEqual([5]);
        expect(b).toEqual([5, 6]);

        act(() => handleB.unsubscribe());
        expect(fakeClient.subscriberCount(tripTopic(TRIP_ID))).toBe(0);
    });
});
