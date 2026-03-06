import { io, Socket } from 'socket.io-client';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const BACKEND_URL = import.meta.env.VITE_SOCKET_URL || apiUrl.replace('/api', '');

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
