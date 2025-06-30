"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../generated/prisma");
const axios_1 = __importDefault(require("axios"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma = new prisma_1.PrismaClient();
const router = (0, express_1.Router)();
const eventSchema = zod_1.z.object({
    title: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    date: zod_1.z.string().min(1),
    location: zod_1.z.string().min(1),
    ticketsTotal: zod_1.z.number().int().min(1),
    ticketDescription: zod_1.z.string().optional(),
    imageUrl: zod_1.z.string().optional()
});
const mpesaBaseUrl = 'https://sandbox.safaricom.co.ke';
const getMpesaToken = async () => {
    const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');
    const res = await axios_1.default.get(`${mpesaBaseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: { Authorization: `Basic ${auth}` }
    });
    return res.data.access_token;
};
const getEvents = async (req, res) => {
    try {
        const events = await prisma.event.findMany();
        res.json(events);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch events' });
    }
};
const getEvent = async (req, res) => {
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
const createEvent = async (req, res) => {
    const parse = eventSchema.safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({ error: 'Invalid input', details: parse.error.errors });
        return;
    }
    try {
        const userId = req.user?.userId;
        const event = await prisma.event.create({
            data: {
                ...parse.data,
                date: new Date(parse.data.date),
                ticketsLeft: parse.data.ticketsTotal,
                createdById: userId
            }
        });
        res.status(201).json(event);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create event' });
    }
};
const updateEvent = async (req, res) => {
    const { id } = req.params;
    const parse = eventSchema.partial().safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({ error: 'Invalid input', details: parse.error.errors });
        return;
    }
    try {
        const event = await prisma.event.update({
            where: { id: Number(id) },
            data: parse.data
        });
        res.json(event);
    }
    catch (error) {
        res.status(404).json({ error: 'Event not found or failed to update' });
    }
};
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
// POST /api/events/:eventId/tickets/pay - Initiate M-Pesa payment and create pending ticket
router.post('/:eventId/tickets/pay', authenticateToken, async (req, res) => {
    const { eventId } = req.params;
    const { phone } = req.body;
    const userId = req.user.userId;
    try {
        const event = await prisma.event.findUnique({ where: { id: Number(eventId) } });
        if (!event || event.ticketsLeft < 1) {
            res.status(400).json({ error: 'Event not found or sold out' });
            return;
        }
        const ticket = await prisma.ticket.create({
            data: { eventId: Number(eventId), userId, paid: false }
        });
        const token = await getMpesaToken();
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
        const password = Buffer.from(`${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`).toString('base64');
        const stkRes = await axios_1.default.post(`${mpesaBaseUrl}/mpesa/stkpush/v1/processrequest`, {
            BusinessShortCode: process.env.MPESA_SHORTCODE,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: event.ticketsTotal, // or event price if you have it
            PartyA: phone,
            PartyB: process.env.MPESA_SHORTCODE,
            PhoneNumber: phone,
            CallBackURL: process.env.MPESA_CALLBACK_URL,
            AccountReference: `Event${eventId}-Ticket${ticket.id}`,
            TransactionDesc: 'Event Ticket Payment'
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        res.status(201).json({ message: 'Ticket created, payment initiated', ticket, stkRes: stkRes.data });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to initiate ticket purchase', details: error.response?.data || error.message });
    }
});
// POST /api/events/mpesa/callback - Handle M-Pesa payment confirmation
router.post('/mpesa/callback', async (req, res) => {
    const body = req.body;
    try {
        // Extract AccountReference (format: Event{eventId}-Ticket{ticketId})
        const ref = body?.Body?.stkCallback?.CallbackMetadata?.Item?.find((item) => item.Name === 'AccountReference')?.Value;
        if (!ref) {
            res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
            return;
        }
        const match = ref.match(/Event(\d+)-Ticket(\d+)/);
        if (!match) {
            res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
            return;
        }
        const ticketId = Number(match[2]);
        await prisma.ticket.update({ where: { id: ticketId }, data: { paid: true } });
        const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
        if (ticket) {
            await prisma.event.update({ where: { id: ticket.eventId }, data: { ticketsLeft: { decrement: 1 } } });
        }
        res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }
    catch (error) {
        res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }
});
router.get('/', getEvents);
router.get('/:id', getEvent);
router.post('/', authenticateToken, createEvent);
router.put('/:id', updateEvent);
router.delete('/:id', deleteEvent);
exports.default = router;
