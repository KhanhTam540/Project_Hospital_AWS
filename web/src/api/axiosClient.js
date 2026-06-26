import axios from "axios";

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

const axiosClient = axios.create({
  // Local: https://...execute-api...amazonaws.com/api
  // CloudFront: /api (same origin)
  baseURL: rawBaseUrl || "/api",
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

axiosClient.interceptors.request.use((config) => {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // A cart can legitimately be absent after an invoice is created.
    if (
      error.response?.status === 404 &&
      error.config?.url?.includes("/hoadon/giohang/")
    ) {
      return Promise.resolve({
        data: {
          message: "Không tìm thấy giỏ hàng",
          data: {
            gioHang: null,
            chiTiet: [],
          },
        },
        status: 200,
        statusText: "OK",
        headers: {},
        config: error.config,
      });
    }

    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("accessToken");
    }

    return Promise.reject(error);
  },
);

export default axiosClient;
