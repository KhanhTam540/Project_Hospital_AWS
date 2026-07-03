import React, { useState } from "react";
import {
  AlertTriangle,
  Clock,
  Eye,
  Loader2,
  ScanLine,
} from "lucide-react";
import {
  getMockScansForPatient,
  SCAN_TYPE_COLORS,
  SCAN_TYPE_LABELS,
} from "../../data/mockPatientScans";
import usePresignedImage from "../../hooks/usePresignedImage";
import SecureScanViewerModal from "./SecureScanViewerModal";

const ScanThumbnail = ({ scan, onClick }) => {
  const { status, imageUrl, errorMessage, onImageLoad, onImageError } = usePresignedImage(scan);

  const typeClass = SCAN_TYPE_COLORS[scan.scanType] || SCAN_TYPE_COLORS.OTHER;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md hover:border-blue-300 transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 w-full"
    >
      <div className="relative aspect-[4/3] bg-gray-900 flex items-center justify-center overflow-hidden">
        {status === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-800 z-10">
            <Loader2 size={24} className="animate-spin text-blue-400" />
            <span className="text-[10px] text-gray-400">Loading…</span>
          </div>
        )}

        {(status === "expired" || status === "error") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-3 text-center bg-gray-800 z-10">
            {status === "expired" ? (
              <Clock size={22} className="text-amber-400" />
            ) : (
              <AlertTriangle size={22} className="text-red-400" />
            )}
            <span className="text-[10px] text-gray-300 font-medium">
              {status === "expired" ? "Link Expired" : "Error"}
            </span>
            <span className="text-[9px] text-gray-500 line-clamp-2">{errorMessage}</span>
          </div>
        )}

        {imageUrl && status !== "expired" && (
          <img
            src={imageUrl}
            alt={scan.title}
            onLoad={onImageLoad}
            onError={onImageError}
            className={`w-full h-full object-cover transition-opacity duration-300 group-hover:scale-105 ${
              status === "ready" ? "opacity-100" : "opacity-0"
            }`}
          />
        )}

        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <span className="flex items-center gap-1 text-white text-xs font-medium bg-black/50 px-2 py-1 rounded-full">
            <Eye size={14} /> Xem
          </span>
        </div>
      </div>

      <div className="p-3 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-gray-800 line-clamp-2">{scan.title}</p>
          <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border ${typeClass}`}>
            {SCAN_TYPE_LABELS[scan.scanType] || scan.scanType}
          </span>
        </div>
        <p className="text-[10px] text-gray-500">
          {scan.bodyPart && `${scan.bodyPart} · `}
          {new Date(scan.capturedAt).toLocaleDateString("vi-VN")}
        </p>
      </div>
    </button>
  );
};

const SecureScanGallery = ({ maBN, patientName, className = "" }) => {
  const scans = getMockScansForPatient(maBN);
  const [activeScan, setActiveScan] = useState(null);

  return (
    <div className={className}>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
          <ScanLine size={20} />
        </div>
        <div>
          <h3 className="font-semibold text-gray-800">Phim chẩn đoán bảo mật</h3>
          <p className="text-xs text-gray-500">
            {patientName ? `${patientName} · ` : ""}
            {scans.length} phim · presigned GET URL (mock)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {scans.map((scan) => (
          <ScanThumbnail key={scan.id} scan={scan} onClick={() => setActiveScan(scan)} />
        ))}
      </div>

      {activeScan && (
        <SecureScanViewerModal
          scan={activeScan}
          scans={scans}
          onClose={() => setActiveScan(null)}
          onNavigate={setActiveScan}
        />
      )}
    </div>
  );
};

export default SecureScanGallery;
