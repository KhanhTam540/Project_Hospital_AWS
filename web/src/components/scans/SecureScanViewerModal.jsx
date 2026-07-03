import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Maximize,
  Minimize,
  RefreshCw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { SCAN_TYPE_LABELS } from "../../data/mockPatientScans";
import usePresignedImage from "../../hooks/usePresignedImage";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

const SecureScanViewerModal = ({ scan, scans = [], onClose, onNavigate }) => {
  const containerRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);

  const { status, imageUrl, errorMessage, reload, onImageLoad, onImageError } = usePresignedImage(scan, {
    enabled: Boolean(scan),
  });

  const currentIndex = scans.findIndex((s) => s.id === scan?.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < scans.length - 1;

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [scan?.id]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          onClose?.();
        }
      }
      if (e.key === "ArrowLeft" && hasPrev) onNavigate?.(scans[currentIndex - 1]);
      if (e.key === "ArrowRight" && hasNext) onNavigate?.(scans[currentIndex + 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentIndex, hasPrev, hasNext, onClose, onNavigate, scans]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  };

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP))));
  }, []);

  const handlePointerDown = (e) => {
    if (zoom <= 1) return;
    dragRef.current = { startX: e.clientX - pan.x, startY: e.clientY - pan.y };
  };

  const handlePointerMove = (e) => {
    if (!dragRef.current) return;
    setPan({ x: e.clientX - dragRef.current.startX, y: e.clientY - dragRef.current.startY });
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  if (!scan) return null;

  const formatDate = (iso) =>
    new Date(iso).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const showImage = imageUrl && status !== "expired" && status !== "error";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Xem phim chẩn đoán"
    >
      <div
        ref={containerRef}
        className="relative w-full max-w-5xl max-h-[92vh] bg-gray-900 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-4 py-3 bg-gray-800 border-b border-gray-700 shrink-0">
          <div className="min-w-0">
            <h2 className="text-white font-semibold truncate">{scan.title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {SCAN_TYPE_LABELS[scan.scanType] || scan.scanType}
              {scan.bodyPart && ` · ${scan.bodyPart}`}
              {" · "}
              {formatDate(scan.capturedAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg shrink-0"
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-gray-800 border-b border-gray-700 shrink-0">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => onNavigate?.(scans[currentIndex - 1])}
            className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg disabled:opacity-30"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            disabled={!hasNext}
            onClick={() => onNavigate?.(scans[currentIndex + 1])}
            className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>

          <span className="text-xs text-gray-500 px-1">
            {currentIndex + 1} / {scans.length}
          </span>

          <div className="w-px h-5 bg-gray-600 mx-1 hidden sm:block" />

          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
            className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg"
            title="Phóng to"
          >
            <ZoomIn size={18} />
          </button>
          <span className="text-xs text-gray-400 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
            className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg"
            title="Thu nhỏ"
          >
            <ZoomOut size={18} />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-700"
          >
            Reset
          </button>

          <div className="flex-1" />

          {(status === "expired" || status === "error") && (
            <button
              type="button"
              onClick={reload}
              className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 px-2 py-1 rounded hover:bg-gray-700"
            >
              <RefreshCw size={14} /> Thử lại
            </button>
          )}

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg"
            title={isFullscreen ? "Thoát fullscreen" : "Toàn màn hình"}
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>

        <div
          className="relative flex-1 min-h-[280px] sm:min-h-[400px] overflow-hidden bg-black flex items-center justify-center select-none"
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {status === "loading" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-black/60">
              <Loader2 size={36} className="animate-spin text-blue-400" />
              <p className="text-sm text-gray-300">Loading…</p>
              <p className="text-xs text-gray-500">Đang lấy presigned GET URL…</p>
            </div>
          )}

          {(status === "expired" || status === "error") && (
            <div className="flex flex-col items-center justify-center gap-3 px-6 text-center max-w-md">
              <div
                className={`p-4 rounded-full ${
                  status === "expired" ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400"
                }`}
              >
                {status === "expired" ? <Clock size={32} /> : <AlertTriangle size={32} />}
              </div>
              <p className="text-white font-medium">
                {status === "expired" ? "Link Expired" : "Link Expired / Error"}
              </p>
              <p className="text-sm text-gray-400">{errorMessage}</p>
              <button
                type="button"
                onClick={reload}
                className="mt-2 flex items-center gap-2 text-sm bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
              >
                <RefreshCw size={16} /> Yêu cầu link mới
              </button>
            </div>
          )}

          {showImage && (
            <img
              src={imageUrl}
              alt={scan.title}
              draggable={false}
              onLoad={onImageLoad}
              onError={onImageError}
              className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${
                status === "ready" ? "opacity-100" : "opacity-0"
              }`}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                cursor: zoom > 1 ? "grab" : "default",
              }}
            />
          )}
        </div>

        <div className="px-4 py-2 bg-gray-800 border-t border-gray-700 text-[10px] text-gray-500 shrink-0 truncate">
          🔒 Secure view · {scan.objectKey} · Hết hạn: {formatDate(scan.expiresAt)}
        </div>
      </div>
    </div>
  );
};

export default SecureScanViewerModal;
