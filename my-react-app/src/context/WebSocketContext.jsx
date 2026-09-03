/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useState, useMemo, useRef } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import { AuthContext } from './AuthContext';
import { getDeviceKey } from '../utils/seatBookingHelpers';

const WebSocketContext = createContext(null);

export const useWebSocket = () => useContext(WebSocketContext);

/**
 * Điểm cuối SockJS.
 *
 * Production PHẢI trỏ thẳng vào origin của backend (VITE_WS_URL), KHÔNG đi qua rewrite
 * "/ws/:path*" của Vercel: rewrite chỉ chuyển tiếp HTTP thường, không nâng cấp được
 * WebSocket. Khi đó SockJS tụt dần xuống long-polling (websocket ✗ → xhr-streaming ✗ →
 * iframe-* ✗ → xhr), và kênh long-polling này đứt rồi reconnect nhiều lần trong 1–2 phút
 * đầu sau khi mở trang — đúng lúc người dùng đang chọn ghế, nên lockSeats hay bị TIMEOUT.
 * Đo trực tiếp trên production: wss qua Vercel fail sau ~240ms, wss thẳng tới backend mở
 * được sau ~520ms. CORS backend đã cho phép sẵn "https://*.vercel.app".
 *
 * Dev để trống -> '/ws' đi qua proxy của Vite (vite.config.js đã bật ws: true).
 */
const WS_ENDPOINT = import.meta.env.VITE_WS_URL || '/ws';

/**
 * Kênh riêng của từng chuyến, thay cho một kênh toàn cục '/topic/seat-status'.
 *
 * Bản cũ đẩy mọi sự kiện ghế của MỌI chuyến tới MỌI trình duyệt đang mở trang: người đang
 * xem chuyến Hà Nội–Sài Gòn vẫn nhận đủ các cú bấm ghế của chuyến Đà Nẵng–Huế, và cả những
 * người đang đứng ở trang chủ cũng nhận. Đăng ký theo chuyến đưa lượng tin mỗi client phải
 * xử lý về đúng phần liên quan tới mình.
 */
const tripTopic = (tripId) => `/topic/seat-status/${tripId}`;

/** Hàng đợi riêng của phiên: phản hồi giữ ghế hụt và mã chủ sở hữu của chính mình. */
const USER_SEAT_QUEUE = '/user/queue/seat-status';
const USER_IDENTITY_QUEUE = '/user/queue/identity';

/** Máy chủ trả đúng chuỗi này trong frame ERROR khi JWT không dùng được. */
const INVALID_TOKEN_ERROR = 'WS_AUTH_INVALID_TOKEN';

const LOCK_RESPONSE_TIMEOUT_MS = 8000;
const IDENTITY_TIMEOUT_MS = 8000;

export const WebSocketProvider = ({ children }) => {
    // useContext trực tiếp thay vì useAuth(): provider này phải render được cả khi nằm
    // ngoài AuthProvider (test dựng riêng), khi đó coi như phiên khách.
    const auth = useContext(AuthContext);
    const token = auth?.token ?? null;

    /**
     * Token bị máy chủ từ chối (hết hạn, hoặc tài khoản đã bị khoá).
     *
     * Máy chủ TỪ CHỐI hẳn frame CONNECT thay vì âm thầm hạ xuống phiên khách — hạ ngầm sẽ
     * khiến người dùng tưởng đang giữ ghế dưới tài khoản của mình, tới bước tạo đơn mới vỡ
     * ra là không phải. Nhưng client thì không được chết theo: với reconnectDelay 5s nó sẽ
     * quay vòng thử lại mãi bằng đúng cái token hỏng đó. Nên nhận diện lỗi này rồi nối lại
     * dưới dạng khách, để phần xem sơ đồ ghế thời gian thực vẫn chạy.
     */
    // Nhớ chính token bị từ chối, không phải một cờ bật/tắt: đăng nhập lại sinh token
    // mới, token mới khác token bị từ chối nên tự động được thử lại, khỏi cần effect nào
    // đi dọn cờ.
    const [rejectedToken, setRejectedToken] = useState(null);
    const effectiveToken = token && token === rejectedToken ? null : token;

    const stompClientRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);

    /**
     * Danh tính của chính phiên này, do máy chủ cấp sau khi CONNECT.
     *
     * `ownerToken` là mã ẩn danh (HMAC của danh tính) — thứ duy nhất còn đại diện cho chủ
     * ghế trong các thông điệp phát ra. Trước đây máy chủ phát thẳng email của người đang
     * giữ ghế cho mọi client; mở DevTools là đọc được email của tất cả những ai đang chọn
     * ghế cùng chuyến. Giao diện chỉ cần so bằng để biết "ghế này của tôi không", nên một
     * mã không hoàn nguyên được là đủ.
     */
    const [identity, setIdentity] = useState(null);
    const identityRef = useRef(null);
    const identityWaitersRef = useRef(new Set());

    // destination -> Set<callback>. Danh sách người nghe sống độc lập với vòng đời của
    // kết nối, nhờ vậy reconnect xong là đăng ký lại được y nguyên.
    const listenersRef = useRef(new Map());
    // destination -> StompSubscription của phiên hiện tại
    const subscriptionsRef = useRef(new Map());
    // Các hàm cần được đánh thức ngay khi kết nối rớt (xem awaitSeatOutcome)
    const connectionLostRef = useRef(new Set());

    /**
     * Mỗi destination chỉ giữ ĐÚNG MỘT subscription STOMP dùng chung cho mọi người nghe.
     * Trước đây lockSeats tự tạo subscription riêng cho mỗi lần bấm; @stomp/stompjs không
     * khôi phục subscription sau reconnect nên chỉ cần kết nối chớp nháy một nhịp là
     * subscription đó mất vĩnh viễn và phản hồi giữ ghế không bao giờ về.
     */
    const ensureSubscription = useCallback((destination) => {
        const client = stompClientRef.current;
        if (!client?.connected) return;
        if (subscriptionsRef.current.has(destination)) return;

        const subscription = client.subscribe(destination, (message) => {
            let payload;
            try {
                payload = JSON.parse(message.body);
            } catch {
                return;
            }
            const listeners = listenersRef.current.get(destination);
            if (!listeners) return;
            [...listeners].forEach((callback) => {
                try {
                    callback(payload);
                } catch (err) {
                    console.error('WebSocket listener error:', err);
                }
            });
        });

        subscriptionsRef.current.set(destination, subscription);
    }, []);

    /**
     * Đăng ký người nghe cho một destination. Trả về handle có unsubscribe() giống
     * StompSubscription, nhưng chỉ gỡ đúng callback này; subscription STOMP thật chỉ bị
     * huỷ khi destination không còn ai nghe. Gọi lúc chưa kết nối vẫn hợp lệ — callback
     * sẽ được nối vào ngay khi kết nối lên.
     */
    const subscribe = useCallback((destination, callback) => {
        let listeners = listenersRef.current.get(destination);
        if (!listeners) {
            listeners = new Set();
            listenersRef.current.set(destination, listeners);
        }
        listeners.add(callback);
        ensureSubscription(destination);

        return {
            unsubscribe: () => {
                const current = listenersRef.current.get(destination);
                if (!current) return;
                current.delete(callback);
                if (current.size > 0) return;

                listenersRef.current.delete(destination);
                const subscription = subscriptionsRef.current.get(destination);
                subscriptionsRef.current.delete(destination);
                try {
                    subscription?.unsubscribe();
                } catch {
                    // kết nối đã đóng, không còn gì để huỷ
                }
            },
        };
    }, [ensureSubscription]);

    useEffect(() => {
        const subscriptions = subscriptionsRef.current;

        /**
         * Danh tính đi kèm frame CONNECT, không nằm trong từng thông điệp nữa.
         *
         * Đây là chỗ vá lỗ hổng lớn nhất của kênh này: trước đây mỗi thông điệp tự khai
         * trường `userId`, máy chủ tin thẳng, nên ai cũng gửi được userId là email người
         * khác để nhả ghế họ đang giữ. Giờ máy chủ suy ra danh tính đúng một lần lúc bắt
         * tay và bỏ qua mọi thứ client khai trong thân thông điệp.
         *
         * X-Guest-Key vẫn gửi kể cả khi đã đăng nhập: máy chủ cần nó để chuyển ghế mà
         * khách đã giữ trước lúc đăng nhập sang tài khoản vừa đăng nhập (seat-handover).
         */
        const connectHeaders = { 'X-Guest-Key': getDeviceKey() };
        if (effectiveToken) {
            connectHeaders.Authorization = `Bearer ${effectiveToken}`;
        }

        const client = new Client({
            webSocketFactory: () => new SockJS(WS_ENDPOINT),
            connectHeaders,
            debug: () => {},
            reconnectDelay: 5000,
            heartbeatIncoming: 4000,
            heartbeatOutgoing: 4000,
        });

        client.onConnect = () => {
            console.log('WebSocket Connected');
            // Phiên STOMP mới -> subscription cũ không còn giá trị, đăng ký lại từ đầu.
            subscriptionsRef.current.clear();
            listenersRef.current.forEach((_, destination) => ensureSubscription(destination));
            setIsConnected(true);
            // Hỏi mã chủ sở hữu của chính mình. Phải hỏi lại sau MỖI lần nối vì đăng nhập
            // hay đăng xuất giữa chừng làm đổi danh tính, kéo theo đổi mã.
            ensureSubscription(USER_IDENTITY_QUEUE);
            client.publish({ destination: '/app/whoami', body: '{}' });
        };

        const forgetIdentity = () => {
            identityRef.current = null;
            setIdentity(null);
        };

        const handleConnectionLost = () => {
            subscriptionsRef.current.clear();
            setIsConnected(false);
            // Danh tính thuộc về kết nối vừa mất. Giữ lại sẽ khiến giao diện chấm nhầm ghế
            // của người khác thành ghế của mình trong khoảng giữa hai lần nối.
            forgetIdentity();
            [...connectionLostRef.current].forEach((callback) => {
                try {
                    callback();
                } catch (err) {
                    console.error('WebSocket connection-lost handler error:', err);
                }
            });
        };

        client.onDisconnect = () => {
            console.log('WebSocket Disconnected');
            handleConnectionLost();
        };

        // onWebSocketClose bắt cả trường hợp rớt kết nối đột ngột (long-polling hết hạn,
        // proxy cắt ngang), thứ mà onDisconnect không nhận được vì không hề có frame
        // DISCONNECT nào được gửi.
        client.onWebSocketClose = () => {
            handleConnectionLost();
        };

        client.onStompError = (frame) => {
            const detail = `${frame.headers?.message ?? ''} ${frame.body ?? ''}`;
            if (detail.includes(INVALID_TOKEN_ERROR)) {
                console.warn('WebSocket: token không dùng được, nối lại dưới dạng khách.');
                setRejectedToken(effectiveToken);
                return;
            }
            console.error('Broker reported error: ' + frame.headers?.message);
            console.error('Additional details: ' + frame.body);
        };

        stompClientRef.current = client;

        const identityListener = (payload) => {
            identityRef.current = payload;
            setIdentity(payload);
            [...identityWaitersRef.current].forEach((resolve) => resolve(payload));
            identityWaitersRef.current.clear();
        };
        const identitySubscription = subscribe(USER_IDENTITY_QUEUE, identityListener);

        client.activate();

        return () => {
            identitySubscription.unsubscribe();
            client.deactivate();
            stompClientRef.current = null;
            subscriptions.clear();
            forgetIdentity();
        };
    }, [ensureSubscription, subscribe, effectiveToken]);

    /** Chờ máy chủ cấp mã chủ sở hữu. Trả null nếu quá hạn (kết nối có vấn đề). */
    const awaitIdentity = useCallback(() => {
        if (identityRef.current) return Promise.resolve(identityRef.current);
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                identityWaitersRef.current.delete(resolve);
                resolve(null);
            }, IDENTITY_TIMEOUT_MS);
            const wrapped = (payload) => {
                clearTimeout(timer);
                resolve(payload);
            };
            identityWaitersRef.current.add(wrapped);
        });
    }, []);

    const sendMessage = useCallback((destination, body) => {
        const client = stompClientRef.current;
        if (client?.connected) {
            client.publish({
                destination,
                body: JSON.stringify(body),
            });
            return true;
        }
        console.warn('WebSocket not connected, message not sent:', destination);
        return false;
    }, []);

    /** Nghe trạng thái ghế của đúng một chuyến. */
    const subscribeToTrip = useCallback(
        (tripId, callback) => subscribe(tripTopic(tripId), callback),
        [subscribe],
    );

    /**
     * Gửi một yêu cầu giữ/nhận ghế rồi chờ máy chủ trả lời cho từng ghế.
     *
     * Thành công về trên kênh chung của chuyến (ghế đổi sang SELECTED mang mã chủ sở hữu
     * của mình), còn thất bại về trên hàng đợi riêng — LOCK_FAILED chỉ liên quan tới người
     * vừa bấm, phát cho cả phòng thì giao diện của người khác nhấp nháy vô cớ.
     */
    const awaitSeatOutcome = useCallback(async ({ tripId, seatIds, publish }) => {
        const client = stompClientRef.current;
        if (!client?.connected) {
            return { success: false, failed: seatIds, error: 'NOT_CONNECTED' };
        }
        if (!seatIds?.length) {
            return { success: true, failed: [] };
        }

        const self = await awaitIdentity();
        if (!self?.ownerToken) {
            return { success: false, failed: seatIds, error: 'NO_IDENTITY' };
        }

        return new Promise((resolve) => {
            const results = new Map(seatIds.map((id) => [id, null]));
            const pendingIds = () => [...results.entries()].filter(([, ok]) => ok !== true).map(([id]) => id);

            let timer = null;
            let topicSub = null;
            let queueSub = null;
            let settled = false;

            const settle = (payload) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                connectionLostRef.current.delete(onConnectionLost);
                topicSub?.unsubscribe();
                queueSub?.unsubscribe();
                resolve(payload);
            };

            // Mất kết nối giữa chừng: phản hồi cho những ghế còn lại sẽ không bao giờ về
            // nữa. Trả lỗi hạ tầng NGAY thay vì bắt người dùng chờ hết timeout rồi nhận
            // một thông báo sai bản chất ("ghế đã có người khác chọn").
            function onConnectionLost() {
                settle({ success: false, failed: pendingIds(), error: 'DISCONNECTED' });
            }

            const record = (seatId, ok) => {
                if (!results.has(seatId)) return;
                results.set(seatId, ok);
                if ([...results.values()].includes(null)) return;
                const failed = [...results.entries()].filter(([, value]) => !value).map(([id]) => id);
                settle({ success: failed.length === 0, failed });
            };

            topicSub = subscribe(tripTopic(tripId), (update) => {
                if (update.status !== 'SELECTED') return;
                if (update.ownerToken !== self.ownerToken) return;
                record(update.seatId, true);
            });

            queueSub = subscribe(USER_SEAT_QUEUE, (update) => {
                if (update.status !== 'LOCK_FAILED') return;
                if (update.tripId !== tripId) return;
                record(update.seatId, false);
            });

            connectionLostRef.current.add(onConnectionLost);

            timer = setTimeout(() => {
                const failed = pendingIds();
                console.warn('[seat] TIMEOUT | pending seatIds:', failed);
                settle({ success: false, failed, error: 'TIMEOUT' });
            }, LOCK_RESPONSE_TIMEOUT_MS);

            publish(client);
        });
    }, [awaitIdentity, subscribe]);

    /**
     * Giữ ghế. Không còn tham số userId: danh tính do máy chủ suy ra từ frame CONNECT,
     * client có gửi lên cũng bị bỏ qua.
     */
    const lockSeats = useCallback(({ tripId, seatIds }) => awaitSeatOutcome({
        tripId,
        seatIds,
        publish: (client) => seatIds.forEach((seatId) => client.publish({
            destination: '/app/seat-selection',
            body: JSON.stringify({ tripId, seatId, status: 'SELECTED' }),
        })),
    }), [awaitSeatOutcome]);

    const unlockSeats = useCallback(({ tripId, seatIds }) => {
        const client = stompClientRef.current;
        if (!client?.connected || !seatIds?.length) return;

        seatIds.forEach((seatId) => {
            client.publish({
                destination: '/app/seat-selection',
                body: JSON.stringify({ tripId, seatId, status: 'AVAILABLE' }),
            });
        });
    }, []);

    /**
     * Nhận lại những ghế đã giữ lúc chưa đăng nhập, sau khi đăng nhập xong.
     *
     * Trước đây frontend tự xoay xở bằng hai lượt: nhả ghế theo danh tính cũ rồi giữ lại
     * bằng danh tính mới. Giữa hai lượt có một khoảng ghế thực sự trống, đủ để người khác
     * chen vào và khách mất ghế dù không làm gì sai. Giờ máy chủ chuyển chủ trong một
     * thao tác, không còn khoảng trống nào.
     */
    const handoverSeats = useCallback(({ tripId, seatIds }) => awaitSeatOutcome({
        tripId,
        seatIds,
        publish: (client) => client.publish({
            destination: '/app/seat-handover',
            body: JSON.stringify({ tripId, seatIds }),
        }),
    }), [awaitSeatOutcome]);

    const value = useMemo(() => ({
        isConnected,
        ownerToken: identity?.ownerToken ?? null,
        isAuthenticatedSession: identity?.authenticated ?? false,
        sendMessage,
        subscribe,
        subscribeToTrip,
        lockSeats,
        unlockSeats,
        handoverSeats,
    }), [isConnected, identity, sendMessage, subscribe, subscribeToTrip, lockSeats, unlockSeats, handoverSeats]);

    return (
        <WebSocketContext.Provider value={value}>
            {children}
        </WebSocketContext.Provider>
    );
};
