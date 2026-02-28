"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const dotenv_1 = __importDefault(require("dotenv"));
const socket_1 = require("./socket");
const violations_1 = __importDefault(require("./routes/violations"));
const cameras_1 = __importDefault(require("./routes/cameras"));
const analytics_1 = __importDefault(require("./routes/analytics"));
const system_1 = __importDefault(require("./routes/system"));
const updates_1 = __importDefault(require("./routes/updates"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Routes
app.use('/api/violations', violations_1.default);
app.use('/api/cameras', cameras_1.default);
app.use('/api/analytics', analytics_1.default);
app.use('/api/system', system_1.default);
app.use('/api/updates', updates_1.default);
// Initialize Socket.IO & Redis
(0, socket_1.initSocket)(server);
(0, socket_1.initRedisSubscriber)().catch(console.error);
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
//# sourceMappingURL=index.js.map