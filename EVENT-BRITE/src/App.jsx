import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import MpesaPaymentForm from './MpesaPaymentForm'
import jwt_decode from 'jwt-decode'

function App() {
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('Admin123!');
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [message, setMessage] = useState('');
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [phone, setPhone] = useState('');
  const [buyMsg, setBuyMsg] = useState('');
  const [tickets, setTickets] = useState([]);
  const [eventForm, setEventForm] = useState({ title: '', description: '', date: '', location: '', ticketsTotal: '', ticketDescription: '', imageUrl: '' });
  const [eventMsg, setEventMsg] = useState('');

  // Decode JWT to get user role
  let userRole = '';
  try {
    if (token) {
      const decoded = jwt_decode(token);
      userRole = decoded.role;
    }
  } catch {}
  const isAdmin = userRole === 'ADMIN';

  // Fetch events
  useEffect(() => {
    fetch('http://localhost:4000/api/events')
      .then(res => res.json())
      .then(setEvents);
  }, [eventMsg]);

  // Fetch user's tickets
  useEffect(() => {
    if (token) {
      fetch('http://localhost:4000/api/events/tickets/my', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => Array.isArray(data) ? setTickets(data) : setTickets([]));
    }
  }, [token, buyMsg]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const res = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setToken(data.token);
        setMessage('Login successful!');
        localStorage.setItem('token', data.token);
      } else {
        setMessage(data.error || 'Login failed');
      }
    } catch (err) {
      setMessage('Network error');
    }
  };

  const handleBuyTicket = async (eventId) => {
    setBuyMsg('');
    if (!phone) {
      setBuyMsg('Enter your phone number');
      return;
    }
    try {
      const res = await fetch(`http://localhost:4000/api/events/${eventId}/tickets/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();
      if (res.ok) {
        setBuyMsg('Payment initiated! Check your phone to complete the payment.');
      } else {
        setBuyMsg(data.error || 'Payment failed');
      }
    } catch (err) {
      setBuyMsg('Network error');
    }
  };

  const handleEventFormChange = (e) => {
    setEventForm({ ...eventForm, [e.target.name]: e.target.value });
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    setEventMsg('');
    try {
      const res = await fetch('http://localhost:4000/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...eventForm,
          ticketsTotal: Number(eventForm.ticketsTotal)
        })
      });
      const data = await res.json();
      if (res.ok) {
        setEventMsg('Event created successfully!');
        setEventForm({ title: '', description: '', date: '', location: '', ticketsTotal: '', ticketDescription: '', imageUrl: '' });
      } else {
        setEventMsg(data.error || 'Failed to create event');
      }
    } catch (err) {
      setEventMsg('Network error');
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Delete this event?')) return;
    try {
      const res = await fetch(`http://localhost:4000/api/events/${eventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setEventMsg('Event deleted');
      } else {
        setEventMsg('Failed to delete event');
      }
    } catch {
      setEventMsg('Network error');
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: '2rem auto', padding: 20 }}>
      <h2>Admin Login</h2>
      {!token && (
        <form onSubmit={handleLogin}>
          <div>
            <label>Email:</label><br />
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" required style={{ width: '100%' }} />
          </div>
          <div style={{ marginTop: 10 }}>
            <label>Password:</label><br />
            <input value={password} onChange={e => setPassword(e.target.value)} type="password" required style={{ width: '100%' }} />
          </div>
          <button type="submit" style={{ marginTop: 16, width: '100%' }}>Login</button>
        </form>
      )}
      {message && <div style={{ marginTop: 16, color: message === 'Login successful!' ? 'green' : 'red' }}>{message}</div>}
      {token && <div style={{ marginTop: 16, wordBreak: 'break-all' }}><b>JWT:</b> {token}</div>}

      {isAdmin && token && (
        <div style={{ marginTop: 32, padding: 20, border: '1px solid #ccc', borderRadius: 8 }}>
          <h3>Create Event (Admin Only)</h3>
          <form onSubmit={handleCreateEvent}>
            <div><label>Title:</label><br /><input name="title" value={eventForm.title} onChange={handleEventFormChange} required style={{ width: '100%' }} /></div>
            <div><label>Description:</label><br /><input name="description" value={eventForm.description} onChange={handleEventFormChange} style={{ width: '100%' }} /></div>
            <div><label>Date:</label><br /><input name="date" value={eventForm.date} onChange={handleEventFormChange} type="datetime-local" required style={{ width: '100%' }} /></div>
            <div><label>Location:</label><br /><input name="location" value={eventForm.location} onChange={handleEventFormChange} required style={{ width: '100%' }} /></div>
            <div><label>Tickets Total:</label><br /><input name="ticketsTotal" value={eventForm.ticketsTotal} onChange={handleEventFormChange} type="number" required style={{ width: '100%' }} /></div>
            <div><label>Ticket Description:</label><br /><input name="ticketDescription" value={eventForm.ticketDescription} onChange={handleEventFormChange} style={{ width: '100%' }} /></div>
            <div><label>Image URL:</label><br /><input name="imageUrl" value={eventForm.imageUrl} onChange={handleEventFormChange} style={{ width: '100%' }} /></div>
            <button type="submit" style={{ marginTop: 16, width: '100%' }}>Create Event</button>
          </form>
          {eventMsg && <div style={{ marginTop: 16, color: eventMsg === 'Event created successfully!' ? 'green' : 'red' }}>{eventMsg}</div>}
        </div>
      )}

      <h2 style={{ marginTop: 32 }}>Events</h2>
      <ul>
        {events.map(ev => (
          <li key={ev.id} style={{ marginBottom: 16, border: '1px solid #ccc', borderRadius: 8, padding: 12 }}>
            <b>{ev.title}</b> <br />
            {ev.description && <span>{ev.description}<br /></span>}
            <span>Date: {new Date(ev.date).toLocaleString()}</span><br />
            <span>Location: {ev.location}</span><br />
            <span>Tickets Left: {ev.ticketsLeft}</span><br />
            <span>Ticket Description: {ev.ticketDescription}</span><br />
            {ev.imageUrl && <img src={ev.imageUrl} alt="event" style={{ maxWidth: 200, marginTop: 8 }} />}<br />
            {isAdmin && token && (
              <button style={{ marginTop: 8, background: 'red', color: 'white' }} onClick={() => handleDeleteEvent(ev.id)}>Delete</button>
            )}
            {token && (
              <div style={{ marginTop: 8 }}>
                <input
                  placeholder="Your phone (2547XXXXXXXX)"
                  value={selectedEvent === ev.id ? phone : ''}
                  onChange={e => {
                    setSelectedEvent(ev.id);
                    setPhone(e.target.value);
                  }}
                  style={{ width: 180 }}
                />
                <button onClick={() => handleBuyTicket(ev.id)} style={{ marginLeft: 8 }}>
                  Buy Ticket
                </button>
                {selectedEvent === ev.id && buyMsg && <div style={{ marginTop: 8 }}>{buyMsg}</div>}
              </div>
            )}
          </li>
        ))}
      </ul>

      {token && (
        <div style={{ marginTop: 32 }}>
          <h2>Your Tickets</h2>
          <ul>
            {tickets.length === 0 && <li>No tickets found.</li>}
            {tickets.map(tk => (
              <li key={tk.id} style={{ marginBottom: 12, border: '1px solid #eee', borderRadius: 6, padding: 8 }}>
                <b>{tk.event.title}</b> | {new Date(tk.event.date).toLocaleString()}<br />
                <span>Status: {tk.paid ? 'Paid' : 'Pending Payment'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default App
