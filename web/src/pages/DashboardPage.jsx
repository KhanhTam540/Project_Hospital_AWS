import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, publicFetch } from '../api/apiClient';
import { logout } from '../auth/authService';

const emptyPatient = {
  fullName: '',
  dateOfBirth: '',
  gender: 'NAM',
  phoneNumber: '',
  address: '',
  healthInsuranceNumber: '',
};

const emptyRecord = {
  patientId: '',
  diagnosis: '',
  symptoms: '',
  medicalHistory: '',
  note: '',
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [health, setHealth] = useState(null);
  const [patientForm, setPatientForm] = useState(emptyPatient);
  const [recordForm, setRecordForm] = useState(emptyRecord);
  const [lookupPatientId, setLookupPatientId] = useState('');
  const [patientResult, setPatientResult] = useState(null);
  const [records, setRecords] = useState([]);
  const [uploadPatientId, setUploadPatientId] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [documentId, setDocumentId] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([apiFetch('/api/me'), publicFetch('/api/health')])
      .then(([me, healthResult]) => {
        setProfile(me);
        setHealth(healthResult);
      })
      .catch((error) => setMessage(error.message));
  }, []);

  const groups = profile?.groups || [];
  const canCreatePatient = groups.some((group) =>
    ['ADMIN', 'NHANSU'].includes(group),
  );
  const canReadPatient = groups.some((group) =>
    ['ADMIN', 'BACSI', 'NHANSU'].includes(group),
  );
  const canCreateRecord = groups.includes('BACSI');
  const canUpload = groups.some((group) =>
    ['BACSI', 'NHANSU'].includes(group),
  );
  const isAdmin = groups.includes('ADMIN');

  const roleText = useMemo(
    () => (groups.length ? groups.join(', ') : 'Chưa được gán nhóm'),
    [groups],
  );

  const run = async (action) => {
    setLoading(true);
    setMessage('');
    try {
      await action();
    } catch (error) {
      setMessage(error.message || 'Thao tác thất bại');
    } finally {
      setLoading(false);
    }
  };

  const changePatient = (event) => {
    setPatientForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const changeRecord = (event) => {
    setRecordForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const createPatient = (event) => {
    event.preventDefault();
    run(async () => {
      const result = await apiFetch('/api/patients', {
        method: 'POST',
        body: JSON.stringify(patientForm),
      });
      setPatientResult(result);
      setLookupPatientId(result.patientId);
      setRecordForm((current) => ({ ...current, patientId: result.patientId }));
      setUploadPatientId(result.patientId);
      setPatientForm(emptyPatient);
      setMessage(`Đã tạo bệnh nhân ${result.patientId}`);
    });
  };

  const lookupPatient = (event) => {
    event.preventDefault();
    run(async () => {
      const result = await apiFetch(
        `/api/patients/${encodeURIComponent(lookupPatientId.trim())}`,
      );
      setPatientResult(result);
      setMessage('Đã tải thông tin bệnh nhân');
    });
  };

  const createRecord = (event) => {
    event.preventDefault();
    run(async () => {
      const patientId = recordForm.patientId.trim();
      const result = await apiFetch(
        `/api/patients/${encodeURIComponent(patientId)}/records`,
        {
          method: 'POST',
          body: JSON.stringify({
            diagnosis: recordForm.diagnosis,
            symptoms: recordForm.symptoms,
            medicalHistory: recordForm.medicalHistory,
            note: recordForm.note,
          }),
        },
      );
      setRecords((current) => [result, ...current]);
      setMessage(`Đã tạo hồ sơ ${result.recordId}`);
    });
  };

  const listRecords = () => {
    run(async () => {
      const patientId = recordForm.patientId.trim() || lookupPatientId.trim();
      if (!patientId) {
        throw new Error('Hãy nhập patientId');
      }
      const result = await apiFetch(
        `/api/patients/${encodeURIComponent(patientId)}/records`,
      );
      setRecords(result.items || []);
      setMessage(`Tìm thấy ${result.count || 0} hồ sơ`);
    });
  };

  const uploadDocument = (event) => {
    event.preventDefault();
    run(async () => {
      if (!uploadFile) {
        throw new Error('Hãy chọn một file PDF, JPEG hoặc PNG');
      }

      const result = await apiFetch('/api/medical/upload-url', {
        method: 'POST',
        body: JSON.stringify({
          patientId: uploadPatientId.trim(),
          fileName: uploadFile.name,
          contentType: uploadFile.type,
          fileSize: uploadFile.size,
        }),
      });

      const uploadResponse = await fetch(result.uploadUrl, {
        method: 'PUT',
        headers: result.requiredHeaders,
        body: uploadFile,
      });

      if (!uploadResponse.ok) {
        throw new Error(`S3 upload error ${uploadResponse.status}`);
      }

      await apiFetch('/api/medical/complete-upload', {
        method: 'POST',
        body: JSON.stringify({ documentId: result.documentId }),
      });

      setDocumentId(result.documentId);
      setMessage(`Upload thành công. Document ID: ${result.documentId}`);
    });
  };

  const downloadDocument = (event) => {
    event.preventDefault();
    run(async () => {
      const result = await apiFetch(
        `/api/medical/download-url?documentId=${encodeURIComponent(
          documentId.trim(),
        )}`,
      );
      window.open(result.downloadUrl, '_blank', 'noopener,noreferrer');
      setMessage('Đã tạo đường dẫn tải xuống tạm thời');
    });
  };

  const adminPing = () => {
    run(async () => {
      const result = await apiFetch('/api/admin/ping');
      setMessage(result.message);
    });
  };

  const signOut = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <main className="dashboard-page">
      <header className="topbar">
        <div>
          <p className="eyebrow">Hospital Cloud</p>
          <h1>Dashboard tuần 1</h1>
        </div>
        <button className="secondary" type="button" onClick={signOut}>
          Đăng xuất
        </button>
      </header>

      <section className="summary-grid">
        <article className="panel">
          <h2>Người dùng</h2>
          <p>{profile?.email || 'Đang tải...'}</p>
          <p>Nhóm: {roleText}</p>
        </article>
        <article className="panel">
          <h2>API</h2>
          <p>Trạng thái: {health?.status || 'Đang tải...'}</p>
          <p>Region: {health?.region || '-'}</p>
        </article>
        <article className="panel">
          <h2>Phân quyền</h2>
          <button type="button" onClick={adminPing} disabled={!isAdmin || loading}>
            Kiểm tra ADMIN
          </button>
          {!isAdmin && <small>Nút chỉ bật cho nhóm ADMIN.</small>}
        </article>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="workspace-grid">
        {canCreatePatient && (
          <form className="panel" onSubmit={createPatient}>
            <h2>Tạo bệnh nhân</h2>
            <input name="fullName" placeholder="Họ tên" value={patientForm.fullName} onChange={changePatient} required />
            <input name="dateOfBirth" type="date" value={patientForm.dateOfBirth} onChange={changePatient} required />
            <select name="gender" value={patientForm.gender} onChange={changePatient}>
              <option value="NAM">Nam</option>
              <option value="NU">Nữ</option>
              <option value="KHAC">Khác</option>
            </select>
            <input name="phoneNumber" placeholder="Số điện thoại" value={patientForm.phoneNumber} onChange={changePatient} />
            <input name="address" placeholder="Địa chỉ" value={patientForm.address} onChange={changePatient} />
            <input name="healthInsuranceNumber" placeholder="Mã BHYT" value={patientForm.healthInsuranceNumber} onChange={changePatient} />
            <button type="submit" disabled={loading}>Tạo bệnh nhân</button>
          </form>
        )}

        {canReadPatient && (
          <form className="panel" onSubmit={lookupPatient}>
            <h2>Xem bệnh nhân</h2>
            <input value={lookupPatientId} onChange={(event) => setLookupPatientId(event.target.value)} placeholder="patientId" required />
            <button type="submit" disabled={loading}>Tìm bệnh nhân</button>
            {patientResult && <pre>{JSON.stringify(patientResult, null, 2)}</pre>}
          </form>
        )}

        {canCreateRecord && (
          <form className="panel" onSubmit={createRecord}>
            <h2>Tạo hồ sơ bệnh án</h2>
            <input name="patientId" placeholder="patientId" value={recordForm.patientId} onChange={changeRecord} required />
            <textarea name="diagnosis" placeholder="Chẩn đoán" value={recordForm.diagnosis} onChange={changeRecord} required />
            <textarea name="symptoms" placeholder="Triệu chứng" value={recordForm.symptoms} onChange={changeRecord} />
            <textarea name="medicalHistory" placeholder="Tiền sử bệnh" value={recordForm.medicalHistory} onChange={changeRecord} />
            <textarea name="note" placeholder="Ghi chú" value={recordForm.note} onChange={changeRecord} />
            <button type="submit" disabled={loading}>Tạo hồ sơ</button>
          </form>
        )}

        {canReadPatient && (
          <section className="panel">
            <h2>Danh sách hồ sơ</h2>
            <button type="button" onClick={listRecords} disabled={loading}>Tải danh sách</button>
            <pre>{JSON.stringify(records, null, 2)}</pre>
          </section>
        )}

        {canUpload && (
          <form className="panel" onSubmit={uploadDocument}>
            <h2>Upload tài liệu y tế</h2>
            <input value={uploadPatientId} onChange={(event) => setUploadPatientId(event.target.value)} placeholder="patientId" required />
            <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setUploadFile(event.target.files?.[0] || null)} required />
            <button type="submit" disabled={loading}>Upload S3</button>
          </form>
        )}

        {canReadPatient && (
          <form className="panel" onSubmit={downloadDocument}>
            <h2>Tải tài liệu y tế</h2>
            <input value={documentId} onChange={(event) => setDocumentId(event.target.value)} placeholder="documentId" required />
            <button type="submit" disabled={loading}>Tạo link tải</button>
          </form>
        )}
      </section>
    </main>
  );
}
