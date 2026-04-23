import React, { createContext, useContext, useEffect, useState } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

const WebSocketContext = createContext(null);

export const useWebSocket = () => useContext(WebSocketContext);

export const WebSocketProvider = ({ children }) => {
    const [stompClient, setStompClient] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const client = new Client({
            // Note: Use http/ws based on your environment. 
            // Since we use SockJS fallback, we point to the http endpoint.
            webSocketFactory: () => new SockJS('http://localhost:8081/ws'),
            connectHeaders: {},
            debug: (str) => {
                // console.log(str);
            },
            reconnectDelay: 5000,
            heartbeatIncoming: 4000,
            heartbeatOutgoing: 4000,
        });

        client.onConnect = (frame) => {
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

    const sendMessage = (destination, body) => {
        if (stompClient && stompClient.connected) {
            stompClient.publish({
                destination,
                body: JSON.stringify(body),
            });
        }
    };

    const subscribe = (destination, callback) => {
        if (stompClient && isConnected) {
            return stompClient.subscribe(destination, (message) => {
                callback(JSON.parse(message.body));
            });
        }
        return null;
    };

    return (
        <WebSocketContext.Provider value={{ stompClient, isConnected, sendMessage, subscribe }}>
            {children}
        </WebSocketContext.Provider>
    );
};
