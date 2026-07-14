const API_BASE = "/api";

function getStoredToken() {
  const directKeys = [
    "idToken",
    "accessToken",
    "hospital.idToken",
    "hospital.accessToken",
    "cognitoIdToken",
  ];

  for (const key of directKeys) {
    const value = localStorage.getItem(key);
    if (value && value.split(".").length === 3) return value;
  }

  for (const key of Object.keys(localStorage)) {
    const value = localStorage.getItem(key);
    if (!value) continue;

    const normalizedKey = key.toLowerCase();
    if ((normalizedKey.includes("idtoken") || normalizedKey.includes("accesstoken")) && value.split(".").length === 3) {
      return value;
    }
  }

  return "";
}

async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function request(path, options = {}) {
  const token = getStoredToken();

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
  }

  return data;
}

export async function createVnpayPayment(invoiceId, options = {}) {
  if (!invoiceId) {
    throw new Error("Thiếu mã hóa đơn để thanh toán VNPay.");
  }

  return request("/payments/vnpay/create", {
    method: "POST",
    body: JSON.stringify({
      invoiceId,
      maHD: invoiceId,
      bankCode: options.bankCode,
      locale: options.locale || "vn",
    }),
  });
}

export async function getPaymentStatus(params = {}) {
  const query = new URLSearchParams();

  if (params.invoiceId) query.set("invoiceId", params.invoiceId);
  if (params.maHD) query.set("maHD", params.maHD);
  if (params.txnRef) query.set("txnRef", params.txnRef);

  const queryString = query.toString();
  return request(`/payments/status${queryString ? `?${queryString}` : ""}`, {
    method: "GET",
  });
}

export function redirectToVnpayCheckout(result) {
  if (result?.checkoutUrl) {
    window.location.href = result.checkoutUrl;
    return true;
  }

  return false;
}
