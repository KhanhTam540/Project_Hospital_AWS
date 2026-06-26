<<<<<<< HEAD
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
=======
import { io } from 'socket.io-client';

// URL của backend, Vite sẽ proxy qua /api, nhưng socket cần URL đầy đủ
// URL của backend: Ưu tiên biến môi trường, mặc định là localhost cho dev
const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'; 
let socket;

/**
 * Khởi tạo và kết nối socket với JWT
 */
export const connectSocket = () => {
  const rawToken = localStorage.getItem('token');
  if (rawToken && (!socket || !socket.connected)) {
    const token = rawToken.startsWith('Bearer ') ? rawToken : `Bearer ${rawToken}`;
    socket = io(BACKEND_URL, {
      // Gửi token qua handshake auth
      auth: {
        token
      }
    });

    socket.on('connect', () => {
      console.log('✅ Socket đã kết nối:', socket.id);
    });

    socket.on('connect_error', (err) => {
      console.error('❌ Lỗi kết nối Socket:', err.message);
      if (err.message.includes("Token không hợp lệ")) {
         // Xử lý logout...
      }
    });

    socket.on('chatError', (error) => {
      console.error('Lỗi từ server:', error.message);
    });
  }
};

/**
 * Ngắt kết nối socket
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('🔻 Socket đã ngắt kết nối.');
  }
};

// === HÀM GỬI SỰ KIỆN MỚI (REQUEST/ACCEPT/REJECT) ===

/**
 * Gửi yêu cầu bắt đầu chat (User A -> Server)
 * @param {string} receiverId - maTK của người nhận (User B)
 */
export const requestChat = (receiverId) => {
  if (socket && socket.connected) {
    socket.emit('requestChat', { receiverId });
  } else {
    console.error('❌ Socket không kết nối, không thể gửi requestChat.');
  }
};

/**
 * Mở lại phòng chat đã được chấp nhận/tạo (Gửi tín hiệu để server join phòng và load history)
 * @param {string} receiverId - maTK của người nhận (User B)
 */
export const openActiveRoom = (receiverId) => {
  if (socket && socket.connected) {
    socket.emit('openActiveRoom', { receiverId });
  } else {
     console.error('❌ Socket không kết nối, không thể gửi openActiveRoom.');
  }
};


/**
 * Chấp nhận yêu cầu chat (User B -> Server)
 * @param {string} requesterId - maTK của người gửi yêu cầu (User A)
 */
export const acceptChat = (requesterId) => {
  if (socket && socket.connected) {
    socket.emit('acceptChat', { requesterId });
  } else {
     console.error('❌ Socket không kết nối, không thể gửi acceptChat.');
  }
};

/**
 * Từ chối yêu cầu chat (User B -> Server)
 * @param {string} requesterId - maTK của người gửi yêu cầu (User A)
 */
export const rejectChat = (requesterId) => {
  if (socket && socket.connected) {
    socket.emit('rejectChat', { requesterId });
  } else {
     console.error('❌ Socket không kết nối, không thể gửi rejectChat.');
  }
};

/**
 * Gửi tin nhắn (Giữ nguyên)
 * @param {string} receiverId - maTK của người nhận
 * @param {string} message - Nội dung tin nhắn
 */
export const sendMessage = (receiverId, message) => {
  if (socket && socket.connected) {
    socket.emit('sendMessage', { receiverId, message });
  } else {
     console.error('❌ Socket không kết nối, không thể gửi tin nhắn.');
  }
};

// --- LẮNG NGHE CÁC SỰ KIỆN MỚI ---

/**
 * Lắng nghe yêu cầu chat mới (Server -> User B)
 */
export const onChatRequest = (callback) => {
  if (socket) {
    socket.on('chatRequest', (senderInfo) => {
      callback(senderInfo);
    });
  }
};

/**
 * Lắng nghe khi yêu cầu gửi thành công (Server -> User A)
 */
export const onRequestSent = (callback) => {
  if (socket) {
    socket.on('requestSent', (data) => {
      callback(data);
    });
  }
};

/**
 * Lắng nghe khi yêu cầu được chấp nhận (Server -> User A và B)
 */
export const onChatAccepted = (callback) => {
  if (socket) {
    socket.on('chatAccepted', (data) => {
      callback(data);
    });
  }
};

/**
 * Lắng nghe khi yêu cầu bị từ chối/hết hạn (Server -> User A)
 */
export const onChatRejected = (callback) => {
  if (socket) {
    socket.on('chatRejected', (data) => {
      callback(data);
    });
  }
};

/**
 * Lắng nghe khi chat hết hạn (15 phút) (Server -> User A và B)
 */
export const onChatExpired = (callback) => {
  if (socket) {
    socket.on('chatExpired', (data) => {
      callback(data);
    });
  }
};


// --- Lắng nghe các sự kiện chat thường ---

export const onReceiveMessage = (callback) => {
  if (socket) {
    socket.on('receiveMessage', (messageData) => {
      callback(messageData);
    });
  }
};

export const onRoomHistory = (callback) => {
  if (socket) {
    socket.on('roomHistory', (data) => {
      callback(data); 
    });
  }
};

export const onNewMessageNotification = (callback) => {
    if(socket) {
        socket.on('newMessageNotification', (notificationData) => {
            callback(notificationData);
        });
    }
};

// --- Hủy lắng nghe ---

export const offChatRequest = (callback) => { if (socket) { socket.off('chatRequest', callback); } };
export const offRequestSent = (callback) => { if (socket) { socket.off('requestSent', callback); } };
export const offChatAccepted = (callback) => { if (socket) { socket.off('chatAccepted', callback); } };
export const offChatRejected = (callback) => { if (socket) { socket.off('chatRejected', callback); } };
export const offChatExpired = (callback) => { if (socket) { socket.off('chatExpired', callback); } };

export const offReceiveMessage = (callback) => {
  if (socket) {
    socket.off('receiveMessage', callback);
  }
};

export const offRoomHistory = (callback) => {
  if (socket) {
    socket.off('roomHistory', callback);
  }
};

export const offNewMessageNotification = (callback) => {
    if(socket) {
        socket.off('newMessageNotification', callback);
    }
};
>>>>>>> 783fda1d827d49c69e82f3a6033e117577ee6a2c
