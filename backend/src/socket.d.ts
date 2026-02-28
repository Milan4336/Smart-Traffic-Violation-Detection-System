import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
export declare const initSocket: (server: HttpServer) => Server<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
export declare const getIO: () => Server<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
export declare const initRedisSubscriber: () => Promise<void>;
//# sourceMappingURL=socket.d.ts.map