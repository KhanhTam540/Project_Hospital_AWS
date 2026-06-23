import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../auth/authService';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const result = await login(email.trim(), password);

      if (result.isSignedIn) {
        navigate('/dashboard');
        return;
      }

      if (result.nextStep?.signInStep === 'CONFIRM_SIGN_UP') {
        navigate(`/confirm?email=${encodeURIComponent(email.trim())}`);
        return;
      }

      setMessage(`Cần thực hiện bước: ${result.nextStep?.signInStep}`);
    } catch (error) {
      setMessage(error.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <form className="panel auth-panel" onSubmit={submit}>
        <p className="eyebrow">Hospital Cloud</p>
        <h1>Đăng nhập</h1>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          Mật khẩu
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
        {message && <p className="message error">{message}</p>}
        <p>
          Bệnh nhân chưa có tài khoản? <Link to="/register">Đăng ký</Link>
        </p>
      </form>
    </main>
  );
}
