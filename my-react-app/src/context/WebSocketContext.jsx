import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

const WebSocketContext = createContext(null);

export const useWebSocket = () => useContext(WebSocketContext);

const LOCK_RESPONSE_TIMEOUT_MS = 5000;

export const WebSocketProvider = ({ children }) => {
    const [stompClient, setStompClient] = useState(null);
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

        client.activate();
        setStompClient(client);

        return () => {
            if (client) client.deactivate();
        };
    }, []);

    const sendMessage = useCallback((destination, body) => {
        if (stompClient && stompClient.connected) {
            stompClient.publish({
                destination,
                body: JSON.stringify(body),
            });
            return true;
        }
        console.warn('WebSocket not connected, message not sent:', destination);
        return false;
    }, [stompClient]);

    const subscribe = useCallback((destination, callback) => {
        if (stompClient && isConnected) {
            return stompClient.subscribe(destination, (message) => {
                callback(JSON.parse(message.body));
            });
        }
        return null;
    }, [stompClient, isConnected]);

    const lockSeats = useCallback(({ tripId, seatIds, userId }) => {
        if (!userId) {
            return Promise.resolve({ success: false, failed: seatIds, error: 'NOT_AUTHENTICATED' });
        }
        if (!stompClient?.connected) {
            return Promise.resolve({ success: false, failed: seatIds, error: 'NOT_CONNECTED' });
        }
        if (!seatIds?.length) {
            return Promise.resolve({ success: true, failed: [] });
        }

        return new Promise((resolve) => {
            const results = new Map(seatIds.map((id) => [id, null]));

            const subscription = stompClient.subscribe('/topic/seat-status', (message) => {
                const update = JSON.parse(message.body);
                if (update.tripId !== tripId) return;
                if (!seatIds.includes(update.seatId)) return;
                if (update.userId !== userId) return;

                if (update.status === 'SELECTED') {
                    results.set(update.seatId, true);
                } else if (update.status === 'LOCK_FAILED') {
                    results.set(update.seatId, false);
                }

                const pending = [...results.values()].some((value) => value === null);
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
                resolve({ success: false, failed, error: 'TIMEOUT' });
            }, LOCK_RESPONSE_TIMEOUT_MS);

            seatIds.forEach((seatId) => {
                stompClient.publish({
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
    }, [stompClient]);

    const unlockSeats = useCallback(({ tripId, seatIds, userId }) => {
        if (!userId || !stompClient?.connected || !seatIds?.length) {
            return;
        }

        seatIds.forEach((seatId) => {
            stompClient.publish({
                destination: '/app/seat-selection',
                body: JSON.stringify({
                    tripId,
                    seatId,
                    status: 'AVAILABLE',
                    userId,
                }),
            });
        });
    }, [stompClient]);

    return (
        <WebSocketContext.Provider value={{
            stompClient,
            isConnected,
            sendMessage,
            subscribe,
            lockSeats,
            unlockSeats,
        }}>
            {children}
        </WebSocketContext.Provider>
    );
};
