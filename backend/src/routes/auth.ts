import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

router.post('/login', async (req, res): Promise<any> => {
    const { email, password } = req.body;

    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(400).json({ error: 'Invalid credentials.' });

        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) return res.status(400).json({ error: 'Invalid credentials.' });

        const token = jwt.sign(
            { id: user.id, role: user.role, clearanceLevel: user.clearanceLevel },
            JWT_SECRET,
            { expiresIn: '12h' }
        );

        // Update last login
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() }
        });

        res.json({ token, user: { id: user.id, name: user.name, role: user.role, clearanceLevel: user.clearanceLevel } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/register', async (req, res): Promise<any> => {
    const { name, email, password, role = 'officer', clearanceLevel = 1 } = req.body;

    try {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) return res.status(400).json({ error: 'User already exists.' });

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { name, email, passwordHash, role, clearanceLevel }
        });

        res.status(201).json({ message: 'User registered successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
