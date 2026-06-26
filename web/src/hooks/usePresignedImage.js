import { useCallback, useEffect, useState } from "react";
import { mockFetchPresignedGetUrl } from "../data/mockPatientScans";

/**
 * Loads a medical scan via mock presigned GET URL flow.
 * States: idle | loading | ready | expired | error
 */
export const usePresignedImage = (scan, { enabled = true } = {}) => {
  const [status, setStatus] = useState("idle");
  const [imageUrl, setImageUrl] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const load = useCallback(async () => {
    if (!scan) return;

    setStatus("loading");
    setImageUrl(null);
    setImageLoaded(false);
    setErrorMessage(null);

    try {
      const { url } = await mockFetchPresignedGetUrl(scan);
      setImageUrl(url);
      setStatus("loading");
    } catch (err) {
      if (err.message === "PRESIGNED_EXPIRED") {
        setStatus("expired");
        setErrorMessage("Link presigned đã hết hạn. Vui lòng yêu cầu link mới.");
      } else {
        setStatus("error");
        setErrorMessage("Không thể tải phim chẩn đoán. Link lỗi hoặc không có quyền truy cập.");
      }
    }
  }, [scan]);

  useEffect(() => {
    if (enabled && scan) {
      load();
    } else {
      setStatus("idle");
      setImageUrl(null);
      setImageLoaded(false);
    }
  }, [scan?.id, enabled, load]);

  const handleImageLoad = () => {
    setImageLoaded(true);
    setStatus("ready");
  };

  const handleImageError = () => {
    setStatus("error");
    setErrorMessage("Không thể hiển thị hình ảnh. Tệp có thể bị hỏng hoặc link không hợp lệ.");
  };

  const isLoading = status === "loading" && !imageLoaded;

  return {
    status: isLoading ? "loading" : status,
    imageUrl,
    imageLoaded,
    errorMessage,
    reload: load,
    onImageLoad: handleImageLoad,
    onImageError: handleImageError,
  };
};

export default usePresignedImage;
