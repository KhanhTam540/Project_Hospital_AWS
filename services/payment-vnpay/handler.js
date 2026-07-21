const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");

const {
  buildPaymentUrl,
  verifyVnpaySignature,
  getClientIp,
} = require("./vnpay");

const TABLE_NAME = process.env.TABLE_NAME;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": process.env.FRONTEND_ALLOWED_ORIGIN || "*",
      "access-control-allow-headers": "authorization,content-type",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

function redirect(location) {
  return {
    statusCode: 302,
    headers: {
      location,
      "cache-control": "no-store",
    },
    body: "",
  };
}

function parseBody(event) {
  if (!event.body) return {};

  const text = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function getPath(event) {
  return event.rawPath || event.requestContext?.http?.path || event.path || "";
}

function getMethod(event) {
  return event.requestContext?.http?.method || event.httpMethod || "GET";
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeId(value) {
  return String(value || "").trim();
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") return 0;

  const parsed = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function pickFirst(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function getItemPk(item) {
  return item?.pk || item?.PK;
}

function getItemSk(item) {
  return item?.sk || item?.SK;
}

function getInvoiceId(invoice) {
  return normalizeId(
    pickFirst(invoice?.invoiceId, invoice?.maHD, invoice?.billId, invoice?.id)
  );
}

function getInvoiceAmount(invoice) {
  return Math.round(
    toNumber(
      pickFirst(
        invoice?.amount,
        invoice?.tongTien,
        invoice?.totalAmount,
        invoice?.total,
        invoice?.thanhTien,
        invoice?.soTien
      )
    )
  );
}

function getInvoiceStatus(invoice) {
  return String(
    pickFirst(
      invoice?.paymentStatus,
      invoice?.trangThaiThanhToan,
      invoice?.status,
      invoice?.trangThai
    ) || ""
  ).toUpperCase();
}

function isInvoicePaid(invoice) {
  const status = getInvoiceStatus(invoice);
  return ["PAID", "DA_THANH_TOAN", "DATHANHTOAN", "COMPLETED", "SUCCESS"].includes(status);
}

function getVnpayConfig() {
  const frontendBaseUrl = (
    process.env.FRONTEND_BASE_URL ||
    process.env.FRONTEND_ALLOWED_ORIGIN ||
    "http://localhost:5173"
  ).replace(/\/$/, "");

  return {
    paymentUrl:
      process.env.VNPAY_PAYMENT_URL ||
      "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
    tmnCode: process.env.VNPAY_TMN_CODE,
    hashSecret: process.env.VNPAY_HASH_SECRET,
    returnUrl:
      process.env.VNPAY_RETURN_URL || `${frontendBaseUrl}/payment/vnpay-return`,
    frontendBaseUrl,
  };
}

function getCurrentUser(event) {
  const claims = event.requestContext?.authorizer?.jwt?.claims || {};
  const groupsRaw =
    claims["cognito:groups"] || claims["custom:groups"] || claims.groups || "";

  const groups = Array.isArray(groupsRaw)
    ? groupsRaw
    : String(groupsRaw)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

  return {
    sub: claims.sub,
    email: claims.email,
    username: claims["cognito:username"] || claims.username,
    groups,
  };
}

async function getByKey(pk, sk = "META") {
  const result = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk, sk },
    })
  );
  return result.Item || null;
}

async function putItem(item) {
  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );
}

async function scanAll({ filterExpression, expressionAttributeValues, limit = 50 }) {
  const items = [];
  let ExclusiveStartKey;

  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: filterExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        Limit: Math.min(limit, 100),
        ExclusiveStartKey,
      })
    );

    items.push(...(result.Items || []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey && items.length < limit);

  return items;
}

async function findInvoice(invoiceId) {
  const id = normalizeId(invoiceId);
  if (!id) return null;

  const directKeys = [
    `INVOICE#${id}`,
    `HOADON#${id}`,
    `BILL#${id}`,
    `PAYMENT_INVOICE#${id}`,
  ];

  for (const pk of directKeys) {
    const item = await getByKey(pk, "META");
    if (item) return item;
  }

  const items = await scanAll({
    filterExpression:
      "invoiceId = :id OR maHD = :id OR billId = :id OR id = :id",
    expressionAttributeValues: {
      ":id": id,
    },
    limit: 20,
  });

  return items.find((item) => getItemPk(item) && getItemSk(item)) || items[0] || null;
}

async function findPaymentByTxnRef(txnRef) {
  const ref = normalizeId(txnRef);
  if (!ref) return null;

  return await getByKey(`PAYMENT#VNPAY#${ref}`, "META");
}

async function findLatestPaymentByInvoiceId(invoiceId) {
  const id = normalizeId(invoiceId);
  if (!id) return null;

  const items = await scanAll({
    filterExpression:
      "entityType = :type AND provider = :provider AND invoiceId = :invoiceId",
    expressionAttributeValues: {
      ":type": "PAYMENT_TRANSACTION",
      ":provider": "VNPAY",
      ":invoiceId": id,
    },
    limit: 50,
  });

  return items
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .find(Boolean);
}

function createTxnRef(invoiceId) {
  const cleanedInvoiceId = String(invoiceId || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-14);

  return `${Date.now()}${Math.floor(Math.random() * 900 + 100)}${cleanedInvoiceId}`.slice(0, 100);
}

function canPayInvoice(user, invoice) {
  if (!invoice) return false;

  const groups = user.groups || [];
  if (groups.includes("ADMIN") || groups.includes("NHANSU") || groups.includes("BACSI")) {
    return true;
  }

  const invoiceEmail = invoice.patientEmail || invoice.email || invoice.emailBenhNhan;
  const invoiceUserSub = invoice.userSub || invoice.ownerSub || invoice.cognitoSub;

  if (invoiceEmail && user.email && String(invoiceEmail).toLowerCase() === String(user.email).toLowerCase()) {
    return true;
  }

  if (invoiceUserSub && user.sub && invoiceUserSub === user.sub) {
    return true;
  }

  // Dữ liệu cũ trong project có nhiều dạng khóa bệnh nhân khác nhau.
  // Sau khi ổn định dataset, nên siết thêm patientId trong JWT/profile.
  return true;
}

async function updateAppointmentPaymentStatus(invoice, status, txnRef, paidAt) {
  const appointmentId = normalizeId(
    pickFirst(invoice?.appointmentId, invoice?.maLH, invoice?.lichHenId)
  );

  if (!appointmentId) return [];

  const items = await scanAll({
    filterExpression:
      "appointmentId = :id OR maLH = :id OR lichHenId = :id OR id = :id",
    expressionAttributeValues: {
      ":id": appointmentId,
    },
    limit: 30,
  });

  const updated = [];

  for (const item of items) {
    if (!getItemPk(item) || !getItemSk(item)) continue;

    const next = {
      ...item,
      paymentStatus: status,
      trangThaiThanhToan: status === "PAID" ? "DA_THANH_TOAN" : status,
      latestPaymentTxnRef: txnRef,
      paidAt: status === "PAID" ? paidAt : item.paidAt,
      updatedAt: nowIso(),
    };

    await putItem(next);
    updated.push(getItemPk(item));
  }

  return updated;
}

async function handleCreatePayment(event) {
  const user = getCurrentUser(event);
  const body = parseBody(event);
  const invoiceId = normalizeId(body.invoiceId || body.maHD || body.billId || body.id);

  if (!TABLE_NAME) {
    return json(500, { message: "TABLE_NAME chưa được cấu hình cho Lambda VNPay." });
  }

  if (!invoiceId) {
    return json(400, { message: "Thiếu invoiceId/maHD." });
  }

  const invoice = await findInvoice(invoiceId);
  if (!invoice) {
    return json(404, { message: "Không tìm thấy hóa đơn.", invoiceId });
  }

  if (!canPayInvoice(user, invoice)) {
    return json(403, { message: "Bạn không có quyền thanh toán hóa đơn này." });
  }

  const normalizedInvoiceId = getInvoiceId(invoice) || invoiceId;
  const amountVnd = getInvoiceAmount(invoice);

  if (!amountVnd || amountVnd <= 0) {
    return json(400, {
      message: "Hóa đơn không có số tiền hợp lệ.",
      invoiceId: normalizedInvoiceId,
      amountVnd,
    });
  }

  if (isInvoicePaid(invoice)) {
    return json(200, {
      message: "Hóa đơn đã được thanh toán.",
      status: "PAID",
      invoiceId: normalizedInvoiceId,
      paid: true,
    });
  }

  const latestPayment = await findLatestPaymentByInvoiceId(normalizedInvoiceId);

  if (latestPayment?.status === "PENDING" && latestPayment.checkoutUrl) {
    return json(200, {
      message: "Hóa đơn đang có giao dịch VNPay chờ thanh toán.",
      status: "PENDING",
      invoiceId: normalizedInvoiceId,
      txnRef: latestPayment.txnRef,
      checkoutUrl: latestPayment.checkoutUrl,
    });
  }

  const config = getVnpayConfig();

  if (!config.tmnCode || !config.hashSecret) {
    return json(500, {
      message: "Backend chưa cấu hình VNPAY_TMN_CODE hoặc VNPAY_HASH_SECRET.",
    });
  }

  const txnRef = createTxnRef(normalizedInvoiceId);
  const createdAt = nowIso();
  const { paymentUrl, params } = buildPaymentUrl({
    paymentUrl: config.paymentUrl,
    tmnCode: config.tmnCode,
    hashSecret: config.hashSecret,
    txnRef,
    amountVnd,
    orderInfo: `Thanh toan hoa don ${normalizedInvoiceId}`,
    returnUrl: config.returnUrl,
    ipAddr: getClientIp(event),
    bankCode: body.bankCode,
    locale: body.locale || "vn",
    orderType: "250000",
    expireMinutes: Number(body.expireMinutes || process.env.VNPAY_EXPIRE_MINUTES || 15),
  });

  const payment = {
    pk: `PAYMENT#VNPAY#${txnRef}`,
    sk: "META",
    entityType: "PAYMENT_TRANSACTION",
    provider: "VNPAY",
    txnRef,
    invoiceId: normalizedInvoiceId,
    maHD: invoice.maHD || invoice.invoiceId || normalizedInvoiceId,
    patientId: invoice.patientId || invoice.maBN,
    recordId: invoice.recordId || invoice.medicalRecordId || invoice.maHSBA || invoice.cccd || invoice.citizenId,
    appointmentId: invoice.appointmentId || invoice.maLH || invoice.lichHenId,
    amountVnd,
    amountVnpay: amountVnd * 100,
    currency: "VND",
    status: "PENDING",
    checkoutUrl: paymentUrl,
    requestParams: params,
    invoicePk: getItemPk(invoice),
    invoiceSk: getItemSk(invoice),
    createdAt,
    updatedAt: createdAt,
    createdBy: user.email || user.username || user.sub || "unknown",
  };

  await putItem(payment);

  if (getItemPk(invoice) && getItemSk(invoice)) {
    await putItem({
      ...invoice,
      paymentProvider: "VNPAY",
      latestPaymentTxnRef: txnRef,
      paymentStatus: invoice.paymentStatus || "PENDING",
      trangThaiThanhToan: invoice.trangThaiThanhToan || "CHO_THANH_TOAN",
      checkoutUrl: paymentUrl,
      updatedAt: createdAt,
    });
  }

  return json(200, {
    message: "Tạo URL thanh toán VNPay thành công.",
    status: "PENDING",
    invoiceId: normalizedInvoiceId,
    txnRef,
    amountVnd,
    checkoutUrl: paymentUrl,
  });
}

async function handleIpn(event) {
  const params = event.queryStringParameters || {};
  const config = getVnpayConfig();

  if (!config.hashSecret) {
    return json(200, { RspCode: "99", Message: "Missing VNPAY_HASH_SECRET" });
  }

  const verify = verifyVnpaySignature(params, config.hashSecret);
  if (!verify.valid) {
    return json(200, { RspCode: "97", Message: "Invalid Checksum" });
  }

  const txnRef = normalizeId(params.vnp_TxnRef);
  const payment = await findPaymentByTxnRef(txnRef);

  if (!payment) {
    return json(200, { RspCode: "01", Message: "Order not Found" });
  }

  const amountFromVnpay = Number(params.vnp_Amount || 0);
  if (Number(payment.amountVnpay) !== amountFromVnpay) {
    return json(200, { RspCode: "04", Message: "Invalid amount" });
  }

  if (payment.status === "PAID") {
    return json(200, { RspCode: "02", Message: "Order already confirmed" });
  }

  const invoice = await findInvoice(payment.invoiceId);
  if (!invoice) {
    return json(200, { RspCode: "01", Message: "Invoice not Found" });
  }

  const success = params.vnp_ResponseCode === "00" && params.vnp_TransactionStatus === "00";
  const updatedAt = nowIso();

  await putItem({
    ...payment,
    status: success ? "PAID" : "FAILED",
    vnp_ResponseCode: params.vnp_ResponseCode,
    vnp_TransactionStatus: params.vnp_TransactionStatus,
    vnp_TransactionNo: params.vnp_TransactionNo,
    vnp_BankCode: params.vnp_BankCode,
    vnp_BankTranNo: params.vnp_BankTranNo,
    vnp_CardType: params.vnp_CardType,
    vnp_PayDate: params.vnp_PayDate,
    vnp_OrderInfo: params.vnp_OrderInfo,
    vnpayRaw: params,
    paidAt: success ? updatedAt : payment.paidAt,
    failedAt: success ? payment.failedAt : updatedAt,
    updatedAt,
  });

  if (getItemPk(invoice) && getItemSk(invoice)) {
    const updatedInvoice = {
      ...invoice,
      paymentProvider: "VNPAY",
      latestPaymentTxnRef: txnRef,
      providerTransactionNo: params.vnp_TransactionNo,
      vnp_BankCode: params.vnp_BankCode,
      vnp_PayDate: params.vnp_PayDate,
      updatedAt,
    };

    if (success) {
      updatedInvoice.paymentStatus = "PAID";
      updatedInvoice.trangThaiThanhToan = "DA_THANH_TOAN";
      updatedInvoice.status = "DA_THANH_TOAN";
      updatedInvoice.trangThai = "DA_THANH_TOAN";
      updatedInvoice.paidAt = updatedAt;
    } else {
      updatedInvoice.paymentStatus = "FAILED";
      updatedInvoice.trangThaiThanhToan = "THANH_TOAN_THAT_BAI";
    }

    await putItem(updatedInvoice);
    await updateAppointmentPaymentStatus(invoice, success ? "PAID" : "FAILED", txnRef, updatedAt);
  }

  return json(200, { RspCode: "00", Message: "Confirm Success" });
}

async function handleStatus(event) {
  const query = event.queryStringParameters || {};
  const invoiceId = normalizeId(query.invoiceId || query.maHD);
  const txnRef = normalizeId(query.txnRef || query.vnp_TxnRef);

  let payment = null;
  let invoice = null;

  if (txnRef) {
    payment = await findPaymentByTxnRef(txnRef);
    if (payment?.invoiceId) {
      invoice = await findInvoice(payment.invoiceId);
    }
  }

  if (!payment && invoiceId) {
    invoice = await findInvoice(invoiceId);
    payment = await findLatestPaymentByInvoiceId(invoiceId);
  }

  if (!payment && !invoice) {
    return json(404, { message: "Không tìm thấy trạng thái thanh toán." });
  }

  return json(200, {
    invoiceId: getInvoiceId(invoice) || payment?.invoiceId,
    txnRef: payment?.txnRef,
    paymentStatus: payment?.status || invoice?.paymentStatus || invoice?.trangThaiThanhToan || "UNKNOWN",
    invoiceStatus: invoice?.paymentStatus || invoice?.trangThaiThanhToan || invoice?.status || invoice?.trangThai || "UNKNOWN",
    amountVnd: payment?.amountVnd || getInvoiceAmount(invoice || {}),
    provider: payment?.provider || "VNPAY",
    providerTransactionNo: payment?.vnp_TransactionNo,
    bankCode: payment?.vnp_BankCode,
    paidAt: payment?.paidAt || invoice?.paidAt,
    checkoutUrl: payment?.checkoutUrl,
  });
}

async function handleReturn(event) {
  const params = event.queryStringParameters || {};
  const config = getVnpayConfig();
  const query = new URLSearchParams(params).toString();

  return redirect(query ? `${config.frontendBaseUrl}/payment/vnpay-return?${query}` : `${config.frontendBaseUrl}/payment/vnpay-return`);
}

exports.handler = async (event) => {
  try {
    const method = getMethod(event);
    const path = getPath(event);

    if (method === "OPTIONS") return json(200, { ok: true });

    if (method === "POST" && path.endsWith("/api/payments/vnpay/create")) {
      return await handleCreatePayment(event);
    }

    if (method === "GET" && path.endsWith("/api/payments/vnpay/ipn")) {
      return await handleIpn(event);
    }

    if (method === "GET" && path.endsWith("/api/payments/vnpay/return")) {
      return await handleReturn(event);
    }

    if (method === "GET" && path.endsWith("/api/payments/status")) {
      return await handleStatus(event);
    }

    return json(404, { message: "Payment VNPay route not found.", method, path });
  } catch (error) {
    console.error("PAYMENT_VNPAY_ERROR", error);
    return json(500, { message: "Lỗi xử lý thanh toán VNPay.", error: error.message });
  }
};
