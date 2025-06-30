"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const prisma_1 = require("./generated/prisma");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
// Enable CORS for all routes to allow frontend requests
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const prisma = new prisma_1.PrismaClient();
// Health check
const healthHandler = (req, res) => {
    res.json({ status: 'ok' });
};
app.get('/api/health', healthHandler);
// Get all events
const getEventsHandler = async (req, res) => {
    try {
        const events = await prisma.event.findMany();
        res.json(events);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch events' });
    }
};
app.get('/api/events', getEventsHandler);
// Get single event
const getEventHandler = async (req, res) => {
    const { id } = req.params;
    try {
        const event = await prisma.event.findUnique({ where: { id: Number(id) } });
        if (!event) {
            res.status(404).json({ error: 'Event not found' });
            return;
        }
        res.json(event);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch event' });
    }
};
app.get('/api/events/:id', getEventHandler);
// Update event
const updateEventHandler = async (req, res) => {
    const { id } = req.params;
    const { title, description, date, location } = req.body;
    try {
        const event = await prisma.event.update({
            where: { id: Number(id) },
            data: { title, description, date: date ? new Date(date) : undefined, location },
        });
        res.json(event);
    }
    catch (error) {
        res.status(404).json({ error: 'Event not found or failed to update' });
    }
};
app.put('/api/events/:id', updateEventHandler);
// JWT authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        res.status(401).json({ error: 'No token provided' });
        return;
    }
    jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            res.status(403).json({ error: 'Invalid token' });
            return;
        }
        req.user = user;
        next();
    });
};
// Admin check middleware
const requireAdmin = (req, res, next) => {
    const user = req.user;
    if (!user || user.role !== 'ADMIN') {
        res.status(403).json({ error: 'Admin access required' });
        return;
    }
    next();
};
// CREATE event (admin only)
const createEvent = async (req, res) => {
    const { title, description, date, location, ticketsTotal, ticketDescription, imageUrl } = req.body;
    if (!title || !date || !location || !ticketsTotal) {
        res.status(400).json({ error: 'title, date, location, and ticketsTotal are required' });
        return;
    }
    try {
        const event = await prisma.event.create({
            data: {
                title,
                description,
                date: new Date(date),
                location,
                ticketsTotal,
                ticketsLeft: ticketsTotal,
                ticketDescription,
                imageUrl,
                createdById: req.user.userId
            },
        });
        res.status(201).json(event);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create event' });
    }
};
app.post('/api/events', authenticateToken, requireAdmin, createEvent);
// DELETE event (admin only)
const deleteEvent = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.event.delete({ where: { id: Number(id) } });
        res.status(204).end();
    }
    catch (error) {
        res.status(404).json({ error: 'Event not found or failed to delete' });
    }
};
app.delete('/api/events/:id', authenticateToken, requireAdmin, deleteEvent);
// User registration
const registerHandler = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
    }
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
    if (!passwordRegex.test(password)) {
        res.status(400).json({
            error: 'Password must be at least 8 characters long, contain an uppercase letter, a number, and a special character.'
        });
        return;
    }
    try {
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const user = await prisma.user.create({
            data: { email, password: hashedPassword }
        });
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
app.post('/api/register', registerHandler);
// Login
const loginHandler = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
    }
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
app.post('/api/login', loginHandler);
// Protected route
const protectedHandler = (req, res) => {
    res.json({ message: 'This is a protected route', user: req.user });
};
app.get('/api/protected', authenticateToken, protectedHandler);
// Test endpoint
const testHandler = (req, res) => {
    res.json({ message: 'Test endpoint working!' });
};
app.get('/api/test', testHandler);
// Promote user to admin (admin only)
const promoteUser = async (req, res) => {
    const { id } = req.params;
    try {
        const user = await prisma.user.update({
            where: { id: Number(id) },
            data: { role: 'ADMIN' }
        });
        res.json({ message: 'User promoted to admin', user: { id: user.id, email: user.email, role: user.role } });
    }
    catch (error) {
        res.status(404).json({ error: 'User not found or failed to promote' });
    }
};
app.post('/api/promote/:id', authenticateToken, requireAdmin, promoteUser);
// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
