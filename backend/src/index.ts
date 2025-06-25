import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from './generated/prisma';

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

// CREATE event
app.post('/api/events', async (req: Request, res: Response): Promise<void> => {
  const { title, description, date, location } = req.body;
  if (!title || !date || !location) {
    res.status(400).json({ error: 'title, date, and location are required' });
    return;
  }
  try {
    const event = await prisma.event.create({
      data: {
        title,
        description,
        date: new Date(date),
        location,
      },
    });
    res.status(201).json(event);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create event' });
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

// DELETE event
app.delete('/api/events/:id', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    await prisma.event.delete({ where: { id: Number(id) } });
    res.status(204).end();
  } catch (error) {
    res.status(404).json({ error: 'Event not found or failed to delete' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 