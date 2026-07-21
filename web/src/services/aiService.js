const getBaseUrl = () => {
  const configuredUrl = import.meta.env.VITE_API_URL;

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '');
  }

  return window.location.origin.replace(/\/$/, '');
};

export async function sendAiMessage({ token, message, context = '' }) {
  if (!token) {
    throw new Error('Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.');
  }

  const response = await fetch(`${getBaseUrl()}/api/ai/chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      context,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      payload.message || `Không thể gọi trợ lý AI (${response.status}).`,
    );
  }

  return payload;
}
