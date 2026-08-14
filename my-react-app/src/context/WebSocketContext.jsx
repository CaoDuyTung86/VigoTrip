/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useState, useMemo } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

const WebSocketContext = createContext(null);

export const useWebSocket = () => useContext(WebSocketContext);

const LOCK_RESPONSE_TIMEOUT_MS = 5000;

export const WebSocketProvider = ({ children }) => {
    const stompClientRef = React.useRef(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const client = new Client({
            webSocketFactory: () => new SockJS('/ws'),
            connectHeaders: {},
            debug: () => {},
            reconnectDelay: 5000,
            heartbeatIncoming: 4000,
            heartbeatOutgoing: 4000,
        });

        client.onConnect = () => {
            console.log('WebSocket Connected');
            setIsConnected(true);
        };

        client.onDisconnect = () => {
            console.log('WebSocket Disconnected');
            setIsConnected(false);
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
        };
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

    const subscribe = useCallback((destination, callback) => {
        const client = stompClientRef.current;
        if (client && isConnected) {
            return client.subscribe(destination, (message) => {
                callback(JSON.parse(message.body));
            });
        }
        return null;
    }, [isConnected]);

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

            const subscription = client.subscribe('/topic/seat-status', (message) => {
                const update = JSON.parse(message.body);
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
                if (!pending) {
                    clearTimeout(timer);
                    subscription.unsubscribe();
                    const failed = [...results.entries()].filter(([, ok]) => !ok).map(([id]) => id);
                    resolve({ success: failed.length === 0, failed });
                }
            });

            const timer = setTimeout(() => {
                subscription.unsubscribe();
                const failed = [...results.entries()].filter(([, ok]) => ok !== true).map(([id]) => id);
                console.warn('[lockSeats] TIMEOUT - userId sent:', userId, '| pending seatIds:', failed);
                resolve({ success: false, failed, error: 'TIMEOUT' });
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
    }, []);

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
