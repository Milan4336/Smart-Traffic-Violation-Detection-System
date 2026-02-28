import { io, Socket } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export const socket: Socket = io(BACKEND_URL, {
    autoConnect: true,
    transports: ['websocket', 'polling'] // Allow switching protocols
});

// Optionally export a hook for React components to use
export const connectSocket = () => {
    if (!socket.connected) {
        socket.connect();
    }
};

export const disconnectSocket = () => {
    if (socket.connected) {
        socket.disconnect();
    }
};
