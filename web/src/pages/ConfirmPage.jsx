import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { confirmPatient } from '../auth/authService';

export default function ConfirmPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      await confirmPatient(email.trim(), code.trim());
      navigate('/login');
    } catch (error) {
      setMessage(error.message || 'Xác nhận thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <form className="panel auth-panel" onSubmit={submit}>
        <p className="eyebrow">Hospital Cloud</p>
        <h1>Xác nhận email</h1>
        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          Mã xác nhận
          <input value={code} onChange={(event) => setCode(event.target.value)} required />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Đang xác nhận...' : 'Xác nhận'}
        </button>
        {message && <p className="message error">{message}</p>}
        <Link to="/login">Quay lại đăng nhập</Link>
      </form>
    </main>
  );
}
