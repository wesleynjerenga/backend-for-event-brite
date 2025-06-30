import { useState } from 'react';

function MpesaPaymentForm() {
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePay = async (e) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);
    try {
      const res = await fetch('http://localhost:4000/api/mpesa/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, amount: Number(amount) })
      });
      const data = await res.json();
      if (res.ok && data.CheckoutRequestID) {
        setMessage('Payment initiated! Check your phone to complete the payment.');
      } else {
        setMessage(data.error || 'Payment failed');
      }
    } catch (err) {
      setMessage('Network error');
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handlePay} style={{ maxWidth: 400, margin: '2rem auto', padding: 20, border: '1px solid #ccc', borderRadius: 8 }}>
      <h3>M-Pesa Payment</h3>
      <div>
        <label>Phone Number (e.g. 2547XXXXXXXX):</label><br />
        <input value={phone} onChange={e => setPhone(e.target.value)} required style={{ width: '100%' }} />
      </div>
      <div style={{ marginTop: 10 }}>
        <label>Amount:</label><br />
        <input value={amount} onChange={e => setAmount(e.target.value)} type="number" required style={{ width: '100%' }} />
      </div>
      <button type="submit" style={{ marginTop: 16, width: '100%' }} disabled={loading}>
        {loading ? 'Processing...' : 'Pay with M-Pesa'}
      </button>
      {message && <div style={{ marginTop: 16 }}>{message}</div>}
    </form>
  );
}

export default MpesaPaymentForm; 