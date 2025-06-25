# Backend for Event Brite

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the development server:
   ```bash
   npm run dev
   ```

## Endpoints

- `GET /api/health` - Health check
- `GET /api/events` - List all events
- `POST /api/events` - Create a new event
- `GET /api/events/:id` - Get a single event
- `PUT /api/events/:id` - Update an event
- `DELETE /api/events/:id` - Delete an event

## Development

```bash
npm run dev
```

## Production

```bash
npm run build
npm start
```

## Environment Variables

Copy `.env.example` to `.env` and update the values as needed:

```
PORT=4000
DATABASE_URL="file:./dev.db"
```

## Testing

You can test the sample endpoint with:

```bash
curl http://localhost:4000/api/test
``` 