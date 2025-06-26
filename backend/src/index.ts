import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from './generated/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Enable CORS for all routes to allow frontend requests
app.use(cors());
app.use(express.json());

const prisma = new PrismaClient();

// Health check
const healthHandler: RequestHandler = (req, res) => {
  res.json({ status: 'ok' });
};
app.get('/api/health', healthHandler);

// Get all events
const getEventsHandler: RequestHandler = async (req, res) => {
  try {
    const events = await prisma.event.findMany();
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
};
app.get('/api/events', getEventsHandler);

// Get single event
const getEventHandler: RequestHandler = async (req, res) => {
  const { id } = req.params;
  try {
    const event = await prisma.event.findUnique({ where: { id: Number(id) } });
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch event' });
  }
};
app.get('/api/events/:id', getEventHandler);

// Update event
const updateEventHandler: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const { title, description, date, location } = req.body;
  try {
    const event = await prisma.event.update({
      where: { id: Number(id) },
      data: { title, description, date: date ? new Date(date) : undefined, location },
    });
    res.json(event);
  } catch (error) {
    res.status(404).json({ error: 'Event not found or failed to update' });
  }
};
app.put('/api/events/:id', updateEventHandler);

// JWT authentication middleware
const authenticateToken: RequestHandler = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  jwt.verify(token, process.env.JWT_SECRET as string, (err, user) => {
    if (err) {
      res.status(403).json({ error: 'Invalid token' });
      return;
    }
    (req as any).user = user;
    next();
  });
};

// Admin check middleware
const requireAdmin: RequestHandler = (req, res, next) => {
  const user = (req as any).user;
  if (!user || user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
};

// CREATE event (admin only)
const createEvent: RequestHandler = async (req, res) => {
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
        createdById: (req as any).user.userId
      },
    });
    res.status(201).json(event);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create event' });
  }
};
app.post('/api/events', authenticateToken, requireAdmin, createEvent);

// DELETE event (admin only)
const deleteEvent: RequestHandler = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.event.delete({ where: { id: Number(id) } });
    res.status(204).end();
  } catch (error) {
    res.status(404).json({ error: 'Event not found or failed to delete' });
  }
};
app.delete('/api/events/:id', authenticateToken, requireAdmin, deleteEvent);

// User registration
const registerHandler: RequestHandler = async (req, res) => {
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
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword }
    });
    res.status(201).json({ id: user.id, email: user.email });
  } catch (error) {
    if ((error as any).code === 'P2002') {
      res.status(409).json({ error: 'Email already exists' });
      return;
    }
    res.status(500).json({ error: 'Failed to register user' });
  }
};
app.post('/api/register', registerHandler);

// Login
const loginHandler: RequestHandler = async (req, res) => {
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
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: '1h' }
    );
    res.json({ message: 'Login successful', token });
  } catch (error) {
    res.status(500).json({ error: 'Failed to login' });
  }
};
app.post('/api/login', loginHandler);

// Protected route
const protectedHandler: RequestHandler = (req, res) => {
  res.json({ message: 'This is a protected route', user: (req as any).user });
};
app.get('/api/protected', authenticateToken, protectedHandler);

// Test endpoint
const testHandler: RequestHandler = (req, res) => {
  res.json({ message: 'Test endpoint working!' });
};
app.get('/api/test', testHandler);

// Promote user to admin (admin only)
const promoteUser: RequestHandler = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await prisma.user.update({
      where: { id: Number(id) },
      data: { role: 'ADMIN' }
    });
    res.json({ message: 'User promoted to admin', user: { id: user.id, email: user.email, role: user.role } });
  } catch (error) {
    res.status(404).json({ error: 'User not found or failed to promote' });
  }
};
app.post('/api/promote/:id', authenticateToken, requireAdmin, promoteUser);

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 