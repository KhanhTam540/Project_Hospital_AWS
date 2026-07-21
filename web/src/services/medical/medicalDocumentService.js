import axios from "../../api/axiosClient";

export const uploadMedicalDocument = async ({
  patientId,
  recordId,
  file,
}) => {
  if (!file) return null;

  const request = await axios.post("/medical/upload-url", {
    patientId,
    recordId,
    medicalRecordId: recordId,
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
    fileSize: file.size,
  });

  const upload = request?.data?.data ?? request?.data;
  if (!upload?.uploadUrl || !upload?.documentId) {
    throw new Error("Backend không trả về Presigned Upload URL");
  }

  const uploadResponse = await fetch(upload.uploadUrl, {
    method: "PUT",
    headers: upload.requiredHeaders || {
      "Content-Type": file.type,
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Tải file lên S3 thất bại: HTTP ${uploadResponse.status}`);
  }

  const completed = await axios.post("/medical/complete-upload", {
    documentId: upload.documentId,
  });

  return completed?.data?.data ?? completed?.data ?? null;
};
