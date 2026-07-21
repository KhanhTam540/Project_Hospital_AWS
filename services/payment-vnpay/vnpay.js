const crypto = require("crypto");

function pad2(value) {
  return String(value).padStart(2, "0");
}

function toVietnamDate(date = new Date()) {
  return new Date(date.getTime() + 7 * 60 * 60 * 1000);
}

function formatVnpDate(date = new Date()) {
  const vnDate = toVietnamDate(date);

  return (
    vnDate.getUTCFullYear().toString() +
    pad2(vnDate.getUTCMonth() + 1) +
    pad2(vnDate.getUTCDate()) +
    pad2(vnDate.getUTCHours()) +
    pad2(vnDate.getUTCMinutes()) +
    pad2(vnDate.getUTCSeconds())
  );
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + Number(minutes || 0) * 60 * 1000);
}

function normalizeValue(value) {
  if (value === undefined || value === null) return "";
  return String(value);
}

function encodeVnpayValue(value) {
  return encodeURIComponent(normalizeValue(value))
    .replace(/%20/g, "+")
    .replace(/[!'()*]/g, (char) =>
      `%${char.charCodeAt(0).toString(16).toUpperCase()}`
    );
}

function sortObject(input) {
  const sorted = {};

  Object.keys(input || {})
    .filter((key) => input[key] !== undefined && input[key] !== null && input[key] !== "")
    .sort()
    .forEach((key) => {
      sorted[key] = input[key];
    });

  return sorted;
}

function buildSignData(params) {
  const sorted = sortObject(params);

  return Object.keys(sorted)
    .map((key) => `${encodeVnpayValue(key)}=${encodeVnpayValue(sorted[key])}`)
    .join("&");
}

function createSecureHash(params, hashSecret) {
  const signData = buildSignData(params);

  return crypto
    .createHmac("sha512", hashSecret)
    .update(Buffer.from(signData, "utf-8"))
    .digest("hex");
}

function buildQueryString(params) {
  const sorted = sortObject(params);

  return Object.keys(sorted)
    .map((key) => `${encodeVnpayValue(key)}=${encodeVnpayValue(sorted[key])}`)
    .join("&");
}

function sanitizeOrderInfo(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9 .:_-]/g, "")
    .slice(0, 250);
}

function buildPaymentUrl({
  paymentUrl,
  tmnCode,
  hashSecret,
  txnRef,
  amountVnd,
  orderInfo,
  returnUrl,
  ipAddr,
  bankCode,
  locale = "vn",
  orderType = "other",
  expireMinutes = 15,
}) {
  if (!paymentUrl) throw new Error("VNPAY_PAYMENT_URL is required.");
  if (!tmnCode) throw new Error("VNPAY_TMN_CODE is required.");
  if (!hashSecret) throw new Error("VNPAY_HASH_SECRET is required.");
  if (!txnRef) throw new Error("txnRef is required.");
  if (!returnUrl) throw new Error("VNPAY_RETURN_URL is required.");

  const amount = Math.round(Number(amountVnd || 0));

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("amountVnd must be greater than 0.");
  }

  const now = new Date();
  const params = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: tmnCode,
    vnp_Amount: String(amount * 100),
    vnp_CurrCode: "VND",
    vnp_TxnRef: String(txnRef),
    vnp_OrderInfo: sanitizeOrderInfo(orderInfo || `Thanh toan hoa don ${txnRef}`),
    vnp_OrderType: orderType,
    vnp_Locale: locale || "vn",
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: ipAddr || "127.0.0.1",
    vnp_CreateDate: formatVnpDate(now),
    vnp_ExpireDate: formatVnpDate(addMinutes(now, expireMinutes)),
  };

  if (bankCode) {
    params.vnp_BankCode = bankCode;
  }

  const secureHash = createSecureHash(params, hashSecret);
  const query = buildQueryString(params);

  return {
    paymentUrl: `${paymentUrl}?${query}&vnp_SecureHash=${secureHash}`,
    params,
    secureHash,
  };
}

function verifyVnpaySignature(queryParams, hashSecret) {
  const params = { ...(queryParams || {}) };
  const receivedHash = params.vnp_SecureHash;

  delete params.vnp_SecureHash;
  delete params.vnp_SecureHashType;

  if (!receivedHash) {
    return {
      valid: false,
      expectedHash: null,
      receivedHash: null,
    };
  }

  const expectedHash = createSecureHash(params, hashSecret);

  return {
    valid: expectedHash.toLowerCase() === String(receivedHash).toLowerCase(),
    expectedHash,
    receivedHash,
  };
}

function getClientIp(event) {
  const headers = event.headers || {};

  const xForwardedFor =
    headers["x-forwarded-for"] ||
    headers["X-Forwarded-For"] ||
    headers["cf-connecting-ip"] ||
    headers["CloudFront-Viewer-Address"];

  if (xForwardedFor) {
    return String(xForwardedFor).split(",")[0].trim().split(":")[0];
  }

  return event.requestContext?.http?.sourceIp || event.requestContext?.identity?.sourceIp || "127.0.0.1";
}

module.exports = {
  buildPaymentUrl,
  verifyVnpaySignature,
  formatVnpDate,
  getClientIp,
  sanitizeOrderInfo,
  buildSignData,
  createSecureHash,
};
