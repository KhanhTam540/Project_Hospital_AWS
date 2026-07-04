import React, { useCallback, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  CloudUpload,
  FileImage,
  Loader2,
  ScanLine,
  Trash2,
  X,
} from "lucide-react";
import { handleMockS3Upload } from "../../utils/mockS3Upload";

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/bmp",
  "image/tiff",
  "application/dicom",
  "application/octet-stream",
];

const ACCEPTED_EXT = [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff", ".dcm", ".dicom"];

const SCAN_TYPES = [
  { id: "XRAY", label: "X-quang (X-ray)" },
  { id: "MRI", label: "MRI" },
  { id: "CT", label: "CT Scan" },
  { id: "OTHER", label: "Khác" },
];

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const isAcceptedFile = (file) => {
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  return ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXT.includes(ext);
};

const inferScanType = (fileName) => {
  const lower = fileName.toLowerCase();
  if (lower.includes("mri")) return "MRI";
  if (lower.includes("xray") || lower.includes("x-ray") || lower.includes("xquang")) return "XRAY";
  if (lower.includes("ct")) return "CT";
  return "XRAY";
};

const makeFileEntry = (file) => ({
  id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
  file,
  scanType: inferScanType(file.name),
  progress: 0,
  status: "pending",
  objectKey: null,
  error: null,
});

/**
 * Drag-and-drop uploader for medical imaging (X-ray / MRI / CT).
 * Uses handleMockS3Upload to simulate presigned S3 PUT flow.
 */
const MedicalScanUploader = ({
  maxFiles = 10,
  maxSizeMb = 50,
  onUploadComplete,
  className = "",
}) => {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const maxBytes = maxSizeMb * 1024 * 1024;

  const addFiles = useCallback(
    (incoming) => {
      const list = Array.from(incoming);
      const valid = [];
      const errors = [];

      for (const file of list) {
        if (!isAcceptedFile(file)) {
          errors.push(`${file.name}: định dạng không hỗ trợ`);
          continue;
        }
        if (file.size > maxBytes) {
          errors.push(`${file.name}: vượt quá ${maxSizeMb} MB`);
          continue;
        }
        valid.push(makeFileEntry(file));
      }

      if (errors.length) {
        toast.error(errors[0]);
      }

      setFiles((prev) => {
        const next = [...prev, ...valid].slice(0, maxFiles);
        if (prev.length + valid.length > maxFiles) {
          toast.error(`Tối đa ${maxFiles} tệp`);
        }
        return next;
      });
    },
    [maxBytes, maxFiles, maxSizeMb]
  );

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleInputChange = (e) => {
    if (e.target.files?.length) {
      addFiles(e.target.files);
      e.target.value = "";
    }
  };

  const removeFile = (id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const updateFile = (id, patch) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const setScanType = (id, scanType) => {
    updateFile(id, { scanType });
  };

  const handleSubmit = async () => {
    const pending = files.filter((f) => f.status === "pending" || f.status === "error");
    if (!pending.length) {
      toast.error("Chưa có tệp nào để tải lên");
      return;
    }

    setIsSubmitting(true);

    const results = [];

    for (const entry of pending) {
      updateFile(entry.id, { status: "uploading", progress: 0, error: null });

      try {
        const result = await handleMockS3Upload(entry.file, {
          scanType: entry.scanType,
          onProgress: (percent) => updateFile(entry.id, { progress: percent }),
        });

        updateFile(entry.id, {
          status: "done",
          progress: 100,
          objectKey: result.objectKey,
        });
        results.push({ ...result, fileName: entry.file.name });
      } catch (err) {
        updateFile(entry.id, {
          status: "error",
          error: err.message || "Upload thất bại",
        });
      }
    }

    setIsSubmitting(false);

    const succeeded = results.length;
    const failed = pending.length - succeeded;

    if (succeeded) {
      toast.success(`Đã tải lên ${succeeded} phim chẩn đoán (mock S3)`);
      onUploadComplete?.(results);
    }
    if (failed) {
      toast.error(`${failed} tệp upload thất bại`);
    }
  };

  const pendingCount = files.filter((f) => f.status === "pending" || f.status === "error").length;
  const doneCount = files.filter((f) => f.status === "done").length;

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-md">
          <ScanLine size={22} />
        </div>
        <div>
          <h3 className="font-semibold text-gray-800">Tải phim chẩn đoán</h3>
          <p className="text-xs text-gray-500">
            X-quang, MRI, CT — kéo thả hoặc chọn tệp (mock S3 presigned upload)
          </p>
        </div>
      </div>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative rounded-xl border-2 border-dashed transition-all cursor-pointer ${
          isDragging
            ? "border-blue-500 bg-blue-50/80 scale-[1.01]"
            : "border-gray-300 bg-gray-50/50 hover:border-blue-400 hover:bg-blue-50/40"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXT.join(",")}
          onChange={handleInputChange}
          className="sr-only"
        />
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
          <div
            className={`mb-3 p-4 rounded-full transition-colors ${
              isDragging ? "bg-blue-100 text-blue-600" : "bg-white text-gray-400 shadow-sm"
            }`}
          >
            <CloudUpload size={32} />
          </div>
          <p className="text-sm font-medium text-gray-700">
            Kéo thả phim X-quang / MRI vào đây
          </p>
          <p className="text-xs text-gray-500 mt-1">
            hoặc <span className="text-blue-600 font-medium">bấm để chọn tệp</span>
          </p>
          <p className="text-[10px] text-gray-400 mt-3">
            JPG, PNG, TIFF, DICOM (.dcm) · tối đa {maxSizeMb} MB · {maxFiles} tệp
          </p>
        </div>
        {isDragging && (
          <div className="absolute inset-0 rounded-xl ring-2 ring-blue-400 ring-offset-2 pointer-events-none" />
        )}
      </div>

      {/* Selected file list */}
      {files.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              Danh sách đã chọn ({files.length})
            </span>
            {doneCount > 0 && (
              <span className="text-xs text-emerald-600 font-medium">{doneCount} đã tải</span>
            )}
          </div>

          <ul className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
            {files.map((entry) => (
              <li key={entry.id} className="px-4 py-3 space-y-2">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <FileImage size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{entry.file.name}</p>
                    <p className="text-xs text-gray-500">{formatBytes(entry.file.size)}</p>

                    {entry.status === "pending" && (
                      <select
                        value={entry.scanType}
                        onChange={(e) => setScanType(entry.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1.5 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-400"
                      >
                        {SCAN_TYPES.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    )}

                    {entry.status === "done" && entry.objectKey && (
                      <p className="text-[10px] text-emerald-600 mt-1 truncate" title={entry.objectKey}>
                        ✓ {entry.objectKey}
                      </p>
                    )}

                    {entry.status === "error" && (
                      <p className="text-[10px] text-red-600 mt-1">{entry.error}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {entry.status === "uploading" && (
                      <Loader2 size={16} className="animate-spin text-blue-600" />
                    )}
                    {entry.status !== "uploading" && (
                      <button
                        type="button"
                        onClick={() => removeFile(entry.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        aria-label="Xóa tệp"
                      >
                        {entry.status === "done" ? <X size={16} /> : <Trash2 size={16} />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Mock progress bar */}
                {(entry.status === "uploading" || entry.status === "done") && (
                  <div className="ml-[52px]">
                    <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                      <span>
                        {entry.status === "done" ? "Hoàn tất" : "Đang upload (mock S3 PUT)…"}
                      </span>
                      <span>{entry.progress}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          entry.status === "done"
                            ? "bg-emerald-500"
                            : "bg-gradient-to-r from-blue-500 to-indigo-500"
                        }`}
                        style={{ width: `${entry.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting || pendingCount === 0}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg shadow-sm transition-colors"
      >
        {isSubmitting ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Đang tải lên…
          </>
        ) : (
          <>
            <CloudUpload size={18} />
            Submit — Tải lên S3 ({pendingCount} tệp)
          </>
        )}
      </button>
    </div>
  );
};

export default MedicalScanUploader;
