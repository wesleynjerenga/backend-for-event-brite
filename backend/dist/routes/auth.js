"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const prisma_1 = require("../generated/prisma");
const prisma = new prisma_1.PrismaClient();
const router = (0, express_1.Router)();
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8)
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1)
});
const registerHandler = async (req, res) => {
    const parse = registerSchema.safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({ error: 'Invalid input', details: parse.error.errors });
        return;
    }
    const { email, password } = parse.data;
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
    if (!passwordRegex.test(password)) {
        res.status(400).json({ error: 'Password must be at least 8 characters long, contain an uppercase letter, a number, and a special character.' });
        return;
    }
    try {
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const user = await prisma.user.create({ data: { email, password: hashedPassword } });
        res.status(201).json({ id: user.id, email: user.email });
    }
    catch (error) {
        if (error.code === 'P2002') {
            res.status(409).json({ error: 'Email already exists' });
            return;
        }
        res.status(500).json({ error: 'Failed to register user' });
    }
};
const loginHandler = async (req, res) => {
    const parse = loginSchema.safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({ error: 'Invalid input', details: parse.error.errors });
        return;
    }
    const { email, password } = parse.data;
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            res.status(401).json({ error: 'Invalid email or password' });
            return;
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.password);
        if (!isMatch) {
            res.status(401).json({ error: 'Invalid email or password' });
            return;
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ message: 'Login successful', token });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to login' });
    }
};
router.post('/register', registerHandler);
router.post('/login', loginHandler);
exports.default = router;
