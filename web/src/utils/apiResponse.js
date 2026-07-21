export function unwrapApiResponse(response, fallback = null) {
  const body = response?.data;

  if (body?.success === false) {
    const error = new Error(
      body?.error?.message || "API trả về lỗi không xác định",
    );
    error.code = body?.error?.code;
    error.details = body?.error?.details;
    throw error;
  }

  if (
    body &&
    typeof body === "object" &&
    Object.prototype.hasOwnProperty.call(body, "data")
  ) {
    return body.data ?? fallback;
  }

  return body ?? fallback;
}

export function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

export function ensureObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

export function getApiErrorMessage(error, fallback) {
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}
