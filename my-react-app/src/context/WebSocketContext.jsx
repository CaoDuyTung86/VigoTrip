/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useState, useMemo, useRef } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

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

const SEAT_STATUS_TOPIC = '/topic/seat-status';

const LOCK_RESPONSE_TIMEOUT_MS = 8000;

export const WebSocketProvider = ({ children }) => {
    const stompClientRef = React.useRef(null);
    const [isConnected, setIsConnected] = useState(false);

    // destination -> Set<callback>. Danh sách người nghe sống độc lập với vòng đời của
    // kết nối, nhờ vậy reconnect xong là đăng ký lại được y nguyên.
    const listenersRef = useRef(new Map());
    // destination -> StompSubscription của phiên hiện tại
    const subscriptionsRef = useRef(new Map());
    // Các hàm cần được đánh thức ngay khi kết nối rớt (xem lockSeats)
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

    useEffect(() => {
        const subscriptions = subscriptionsRef.current;
        const client = new Client({
            webSocketFactory: () => new SockJS(WS_ENDPOINT),
            connectHeaders: {},
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
        };

        const handleConnectionLost = () => {
            subscriptionsRef.current.clear();
            setIsConnected(false);
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
            console.error('Broker reported error: ' + frame.headers['message']);
            console.error('Additional details: ' + frame.body);
        };

        stompClientRef.current = client;
        client.activate();

        return () => {
            client.deactivate();
            stompClientRef.current = null;
            subscriptions.clear();
        };
    }, [ensureSubscription]);

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

    const lockSeats = useCallback(({ tripId, seatIds, userId }) => {
        const client = stompClientRef.current;
        if (!userId) {
            return Promise.resolve({ success: false, failed: seatIds, error: 'NOT_AUTHENTICATED' });
        }
        if (!client?.connected) {
            return Promise.resolve({ success: false, failed: seatIds, error: 'NOT_CONNECTED' });
        }
        if (!seatIds?.length) {
            return Promise.resolve({ success: true, failed: [] });
        }

        return new Promise((resolve) => {
            const results = new Map(seatIds.map((id) => [id, null]));
            const pendingIds = () => [...results.entries()].filter(([, ok]) => ok !== true).map(([id]) => id);

            let timer = null;
            let subscription = null;
            let settled = false;

            const settle = (payload) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                connectionLostRef.current.delete(onConnectionLost);
                subscription?.unsubscribe();
                resolve(payload);
            };

            // Mất kết nối giữa chừng: phản hồi cho những ghế còn lại sẽ không bao giờ về
            // nữa. Trả lỗi hạ tầng NGAY thay vì bắt người dùng chờ hết timeout rồi nhận
            // một thông báo sai bản chất ("ghế đã có người khác chọn").
            function onConnectionLost() {
                settle({ success: false, failed: pendingIds(), error: 'DISCONNECTED' });
            }

            subscription = subscribe(SEAT_STATUS_TOPIC, (update) => {
                if (update.tripId !== tripId) return;
                if (!seatIds.includes(update.seatId)) return;
                // So sánh case-insensitive để hỗ trợ tài khoản Google OAuth
                if ((update.userId || '').toLowerCase() !== (userId || '').toLowerCase()) return;

                if (update.status === 'SELECTED') {
                    results.set(update.seatId, true);
                } else if (update.status === 'LOCK_FAILED') {
                    results.set(update.seatId, false);
                }

                const pending = [...results.values()].includes(null);
                if (pending) return;

                const failed = [...results.entries()].filter(([, ok]) => !ok).map(([id]) => id);
                settle({ success: failed.length === 0, failed });
            });

            connectionLostRef.current.add(onConnectionLost);

            timer = setTimeout(() => {
                const failed = pendingIds();
                console.warn('[lockSeats] TIMEOUT - userId sent:', userId, '| pending seatIds:', failed);
                settle({ success: false, failed, error: 'TIMEOUT' });
            }, LOCK_RESPONSE_TIMEOUT_MS);

            seatIds.forEach((seatId) => {
                client.publish({
                    destination: '/app/seat-selection',
                    body: JSON.stringify({
                        tripId,
                        seatId,
                        status: 'SELECTED',
                        userId,
                    }),
                });
            });
        });
    }, [subscribe]);

    const unlockSeats = useCallback(({ tripId, seatIds, userId }) => {
        const client = stompClientRef.current;
        if (!userId || !client?.connected || !seatIds?.length) {
            return;
        }

        seatIds.forEach((seatId) => {
            client.publish({
                destination: '/app/seat-selection',
                body: JSON.stringify({
                    tripId,
                    seatId,
                    status: 'AVAILABLE',
                    userId,
                }),
            });
        });
    }, []);

    const value = useMemo(() => ({
        isConnected,
        sendMessage,
        subscribe,
        lockSeats,
        unlockSeats,
    }), [isConnected, sendMessage, subscribe, lockSeats, unlockSeats]);

    return (
        <WebSocketContext.Provider value={value}>
            {children}
        </WebSocketContext.Provider>
    );
};
