import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerPatient } from '../auth/authService';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '',
    password: '',
    phoneNumber: '',
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const change = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const email = form.email.trim();
      const result = await registerPatient(
        email,
        form.password,
        form.phoneNumber.trim(),
      );

      if (result.isSignUpComplete) {
        navigate('/login');
      } else {
        navigate(`/confirm?email=${encodeURIComponent(email)}`);
      }
    } catch (error) {
      setMessage(error.message || 'Đăng ký thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <form className="panel auth-panel" onSubmit={submit}>
        <p className="eyebrow">Hospital Cloud</p>
        <h1>Đăng ký bệnh nhân</h1>
        <label>
          Email
          <input name="email" type="email" value={form.email} onChange={change} required />
        </label>
        <label>
          Số điện thoại quốc tế, ví dụ +84901234567
          <input name="phoneNumber" value={form.phoneNumber} onChange={change} />
        </label>
        <label>
          Mật khẩu
          <input name="password" type="password" value={form.password} onChange={change} required />
        </label>
        <small>Mật khẩu tối thiểu 10 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt.</small>
        <button type="submit" disabled={loading}>
          {loading ? 'Đang đăng ký...' : 'Đăng ký'}
        </button>
        {message && <p className="message error">{message}</p>}
        <p>
          Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
        </p>
      </form>
    </main>
  );
}
