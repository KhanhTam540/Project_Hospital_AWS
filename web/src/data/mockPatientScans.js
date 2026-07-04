/**
 * Mock patient imaging records with fake S3 presigned GET URLs.
 * In production: GET /api/scans/:id/presign → short-lived signed URL.
 */

const hoursFromNow = (h) => new Date(Date.now() + h * 60 * 60 * 1000).toISOString();
const hoursAgo = (h) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

export const MOCK_PATIENT_SCANS = [
  {
    id: "scan-xray-001",
    maBN: "BN001",
    title: "X-quang ngực thẳng (PA)",
    scanType: "XRAY",
    bodyPart: "Ngực",
    capturedAt: "2026-06-14T09:30:00",
    objectKey: "scans/xray/BN001/chest-pa-20260614.dcm",
    presignedUrl: "https://picsum.photos/seed/xray-chest-pa/1200/900",
    expiresAt: hoursFromNow(1),
    mockStatus: "ready",
  },
  {
    id: "scan-mri-001",
    maBN: "BN001",
    title: "MRI não — axial T2",
    scanType: "MRI",
    bodyPart: "Não",
    capturedAt: "2026-06-13T14:15:00",
    objectKey: "scans/mri/BN001/brain-axial-t2.dcm",
    presignedUrl: "https://picsum.photos/seed/mri-brain-t2/1200/900",
    expiresAt: hoursFromNow(2),
    mockStatus: "ready",
  },
  {
    id: "scan-ct-001",
    maBN: "BN001",
    title: "CT bụng — contrast",
    scanType: "CT",
    bodyPart: "Bụng",
    capturedAt: "2026-06-12T11:00:00",
    objectKey: "scans/ct/BN001/abdomen-contrast.dcm",
    presignedUrl: "https://picsum.photos/seed/ct-abdomen/1200/900",
    expiresAt: hoursFromNow(0.5),
    mockStatus: "ready",
  },
  {
    id: "scan-xray-expired",
    maBN: "BN001",
    title: "X-quang cột sống (link hết hạn)",
    scanType: "XRAY",
    bodyPart: "Cột sống",
    capturedAt: "2026-05-01T08:00:00",
    objectKey: "scans/xray/BN001/spine-lateral.dcm",
    presignedUrl: "https://picsum.photos/seed/spine-expired/1200/900",
    expiresAt: hoursAgo(24),
    mockStatus: "expired",
  },
  {
    id: "scan-mri-error",
    maBN: "BN001",
    title: "MRI khớp gối (lỗi tải)",
    scanType: "MRI",
    bodyPart: "Gối",
    capturedAt: "2026-06-10T16:45:00",
    objectKey: "scans/mri/BN001/knee-corrupt.dcm",
    presignedUrl: "https://example.com/nonexistent-medical-scan-image.jpg",
    expiresAt: hoursFromNow(1),
    mockStatus: "ready",
  },
  {
    id: "scan-xray-002",
    maBN: "BN002",
    title: "X-quang tay trái",
    scanType: "XRAY",
    bodyPart: "Tay",
    capturedAt: "2026-06-15T07:20:00",
    objectKey: "scans/xray/BN002/hand-left.dcm",
    presignedUrl: "https://picsum.photos/seed/xray-hand/1200/900",
    expiresAt: hoursFromNow(3),
    mockStatus: "ready",
  },
];

export const SCAN_TYPE_LABELS = {
  XRAY: "X-quang",
  MRI: "MRI",
  CT: "CT Scan",
  OTHER: "Khác",
};

export const SCAN_TYPE_COLORS = {
  XRAY: "bg-sky-100 text-sky-800 border-sky-200",
  MRI: "bg-violet-100 text-violet-800 border-violet-200",
  CT: "bg-amber-100 text-amber-800 border-amber-200",
  OTHER: "bg-gray-100 text-gray-700 border-gray-200",
};

/**
 * Filter mock scans for a patient; falls back to BN001 demo set if none match.
 */
export const getMockScansForPatient = (maBN) => {
  const matched = MOCK_PATIENT_SCANS.filter((s) => s.maBN === maBN);
  if (matched.length) return matched;
  return MOCK_PATIENT_SCANS.filter((s) => s.maBN === "BN001");
};

/**
 * Simulates requesting a fresh presigned GET URL from the backend.
 * @returns {Promise<{ url: string, expiresAt: string }>}
 */
export const mockFetchPresignedGetUrl = (scan) =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      if (scan.mockStatus === "expired" || new Date(scan.expiresAt) < new Date()) {
        reject(new Error("PRESIGNED_EXPIRED"));
        return;
      }
      if (scan.mockStatus === "error") {
        reject(new Error("PRESIGNED_FETCH_FAILED"));
        return;
      }
      resolve({ url: scan.presignedUrl, expiresAt: scan.expiresAt });
    }, 600 + Math.random() * 400);
  });
