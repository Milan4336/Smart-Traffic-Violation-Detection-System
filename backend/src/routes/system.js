"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
// GET /api/system
router.get('/', (req, res) => {
    res.json({
        status: 'ONLINE',
        version: '2.4.1',
        uptime: process.uptime(),
        clearanceLevel: 4
    });
});
exports.default = router;
//# sourceMappingURL=system.js.map