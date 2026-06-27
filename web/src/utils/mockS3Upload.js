/**
 * Mock S3 Presigned PUT URL upload flow for medical imaging files.
 *
 * Real implementation outline:
 *   1. POST /api/uploads/presign  { fileName, contentType, scanType }
 *      → { uploadUrl, objectKey, headers? }
 *   2. PUT uploadUrl with file body (track xhr.upload.onprogress)
 *   3. POST /api/uploads/confirm   { objectKey, maBN?, maPK? }
 *
 * @param {File} file
 * @param {{ onProgress?: (percent: number) => void, scanType?: string }} [options]
 * @returns {Promise<{ objectKey: string, etag: string, scanType: string }>}
 */
export async function handleMockS3Upload(file, options = {}) {
  const { onProgress, scanType = "XRAY" } = options;

  // TODO: Replace with real presign request
  // const { data } = await axios.post('/uploads/presign', {
  //   fileName: file.name,
  //   contentType: file.type,
  //   scanType,
  // });
  // const { uploadUrl, objectKey } = data;

  const objectKey = `scans/${scanType.toLowerCase()}/${Date.now()}-${file.name}`;

  await mockPresignDelay();

  await mockPutWithProgress(file, onProgress);

  return {
    objectKey,
    etag: `"mock-etag-${Date.now()}"`,
    scanType,
  };
}

const mockPresignDelay = () =>
  new Promise((resolve) => setTimeout(resolve, 400));

const mockPutWithProgress = (file, onProgress) =>
  new Promise((resolve) => {
    const steps = 20;
    let step = 0;

    const tick = () => {
      step += 1;
      const percent = Math.min(100, Math.round((step / steps) * 100));
      onProgress?.(percent);

      if (step >= steps) {
        resolve();
        return;
      }
      setTimeout(tick, 80 + Math.random() * 60);
    };

    setTimeout(tick, 100);
  });

export default handleMockS3Upload;
