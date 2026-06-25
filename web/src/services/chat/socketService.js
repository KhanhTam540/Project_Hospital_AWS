import { io } from "socket.io-client";

const SOCKET_ENABLED = import.meta.env.VITE_SOCKET_ENABLED === "true";
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL?.trim();

let socket = null;
let disabledNoticeShown = false;

const logDisabledOnce = () => {
  if (!disabledNoticeShown) {
    console.info(
      "Socket.IO đang tắt. Bật VITE_SOCKET_ENABLED=true và cấu hình VITE_SOCKET_URL khi backend realtime được triển khai.",
    );
    disabledNoticeShown = true;
  }
};

const canUseSocket = () => {
  if (!SOCKET_ENABLED || !SOCKET_URL) {
    logDisabledOnce();
    return false;
  }
  return true;
};

export const connectSocket = () => {
  if (!canUseSocket()) return null;

  const rawToken =
    localStorage.getItem("accessToken") || localStorage.getItem("token");

  if (!rawToken) return null;
  if (socket?.connected) return socket;

  const token = rawToken.startsWith("Bearer ")
    ? rawToken
    : `Bearer ${rawToken}`;

  socket = io(SOCKET_URL, {
    transports: ["websocket", "polling"],
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 3,
  });

  socket.on("connect", () => {
    console.info("Socket đã kết nối:", socket.id);
  });

  socket.on("connect_error", (error) => {
    console.error("Lỗi kết nối Socket:", error.message);
  });

  socket.on("chatError", (error) => {
    console.error("Lỗi chat từ server:", error?.message || error);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (!socket) return;
  socket.disconnect();
  socket = null;
};

const emit = (eventName, payload) => {
  if (!socket?.connected) return false;
  socket.emit(eventName, payload);
  return true;
};

const on = (eventName, callback) => {
  if (socket && typeof callback === "function") {
    socket.on(eventName, callback);
  }
};

const off = (eventName, callback) => {
  if (!socket) return;
  if (typeof callback === "function") socket.off(eventName, callback);
  else socket.off(eventName);
};

export const requestChat = (receiverId) => emit("requestChat", { receiverId });
export const openActiveRoom = (receiverId) => emit("openActiveRoom", { receiverId });
export const acceptChat = (requesterId) => emit("acceptChat", { requesterId });
export const rejectChat = (requesterId) => emit("rejectChat", { requesterId });
export const sendMessage = (receiverId, message) =>
  emit("sendMessage", { receiverId, message });

export const onChatRequest = (callback) => on("chatRequest", callback);
export const onRequestSent = (callback) => on("requestSent", callback);
export const onChatAccepted = (callback) => on("chatAccepted", callback);
export const onChatRejected = (callback) => on("chatRejected", callback);
export const onChatExpired = (callback) => on("chatExpired", callback);
export const onReceiveMessage = (callback) => on("receiveMessage", callback);
export const onRoomHistory = (callback) => on("roomHistory", callback);
export const onNewMessageNotification = (callback) =>
  on("newMessageNotification", callback);

export const offChatRequest = (callback) => off("chatRequest", callback);
export const offRequestSent = (callback) => off("requestSent", callback);
export const offChatAccepted = (callback) => off("chatAccepted", callback);
export const offChatRejected = (callback) => off("chatRejected", callback);
export const offChatExpired = (callback) => off("chatExpired", callback);
export const offReceiveMessage = (callback) => off("receiveMessage", callback);
export const offRoomHistory = (callback) => off("roomHistory", callback);
export const offNewMessageNotification = (callback) =>
  off("newMessageNotification", callback);
