import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getSignedInUser } from '../auth/authService';

export default function ProtectedRoute({ children }) {
  const [state, setState] = useState('loading');

  useEffect(() => {
    let active = true;

    getSignedInUser()
      .then(() => active && setState('authenticated'))
      .catch(() => active && setState('anonymous'));

    return () => {
      active = false;
    };
  }, []);

  if (state === 'loading') {
    return <main className="center-page">Đang kiểm tra phiên đăng nhập...</main>;
  }

  if (state === 'anonymous') {
    return <Navigate to="/login" replace />;
  }

  return children;
}
