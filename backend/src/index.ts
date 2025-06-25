import express, { Request, Response, NextFunction } from 'express';
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

app.get('/api/health', async (req: Request, res: Response): Promise<void> => {
  res.json({ status: 'ok' });
});

app.get('/api/events', async (req: Request, res: Response): Promise<void> => {
  try {
    const events = await prisma.event.findMany();
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Admin check middleware
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  if (!user || user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

// CREATE event (admin only)
app.post('/api/events', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
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
    return;
  } catch (error) {
    res.status(500).json({ error: 'Failed to create event' });
    return;
  }
});

// GET single event
app.get('/api/events/:id', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
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
});

// UPDATE event
app.put('/api/events/:id', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
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
});

// DELETE event (admin only)
app.delete('/api/events/:id', authenticateToken, requireAdmin, async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    await prisma.event.delete({ where: { id: Number(id) } });
    res.status(204).end();
    return;
  } catch (error) {
    res.status(404).json({ error: 'Event not found or failed to delete' });
    return;
  }
});

// User registration endpoint
app.post('/api/register', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  // Password validation
  const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters long, contain an uppercase letter, a number, and a special character.'
    });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword }
    });
    res.status(201).json({ id: user.id, email: user.email });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// JWT authentication middleware
function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  jwt.verify(token, process.env.JWT_SECRET as string, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    (req as any).user = user;
    next();
  });
}

// Update login endpoint to return JWT with role
app.post('/api/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
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
});

// Example protected route
app.get('/api/protected', authenticateToken, (req: Request, res: Response) => {
  res.json({ message: 'This is a protected route', user: (req as any).user });
});

// Sample test endpoint for demonstration
app.get('/api/test', (req: Request, res: Response) => {
  res.json({ message: 'Test endpoint working!' });
});

// Promote user to admin (admin only)
app.post('/api/promote/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
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
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 