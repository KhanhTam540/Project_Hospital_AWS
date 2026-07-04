import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  Clock3,
  Database,
  ExternalLink,
  FileHeart,
  FileText,
  FlaskConical,
  HeartPulse,
  LoaderCircle,
  Pill,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";
import {
  getHoSoTongHop,
  resolvePatientId,
} from "../../../services/hoso_BN/hsbaService";
import { verifyMedicalLedger } from "../../../services/medical/ledgerService";

const FILTERS = [
  {
    key: "PHIEU_KHAM",
    label: "Phiếu khám",
    icon: Stethoscope,
    active: "bg-blue-600 border-blue-600 text-white shadow-blue-200",
    idle: "bg-white border-blue-200 text-blue-700 hover:bg-blue-50",
  },
  {
    key: "DON_THUOC",
    label: "Đơn thuốc",
    icon: Pill,
    active: "bg-violet-600 border-violet-600 text-white shadow-violet-200",
    idle: "bg-white border-violet-200 text-violet-700 hover:bg-violet-50",
  },
  {
    key: "XET_NGHIEM",
    label: "Xét nghiệm",
    icon: FlaskConical,
    active: "bg-amber-500 border-amber-500 text-white shadow-amber-200",
    idle: "bg-white border-amber-200 text-amber-700 hover:bg-amber-50",
  },
  {
    key: "LICH_KHAM",
    label: "Lịch khám",
    icon: CalendarDays,
    active: "bg-emerald-600 border-emerald-600 text-white shadow-emerald-200",
    idle: "bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50",
  },
];

const EVENT_STYLE = {
  PHIEU_KHAM: {
    title: "Phiếu khám",
    icon: Stethoscope,
    header: "from-blue-600 to-blue-500",
    accent: "border-blue-200",
    badge: "bg-blue-50 text-blue-700",
  },
  DON_THUOC: {
    title: "Đơn thuốc",
    icon: Pill,
    header: "from-violet-600 to-fuchsia-500",
    accent: "border-violet-200",
    badge: "bg-violet-50 text-violet-700",
  },
  XET_NGHIEM: {
    title: "Kết quả xét nghiệm",
    icon: FlaskConical,
    header: "from-amber-500 to-orange-500",
    accent: "border-amber-200",
    badge: "bg-amber-50 text-amber-700",
  },
  LICH_KHAM: {
    title: "Lịch khám",
    icon: CalendarDays,
    header: "from-emerald-600 to-teal-500",
    accent: "border-emerald-200",
    badge: "bg-emerald-50 text-emerald-700",
  },
};

const STATUS_LABEL = {
  ACTIVE: "Đang hoạt động",
  OPEN: "Đang mở",
  CLOSED: "Đã đóng",
  COMPLETED: "Hoàn thành",
  CONFIRMED: "Đã xác nhận",
  PENDING: "Chờ xác nhận",
  CANCELLED: "Đã hủy",
  CANCELED: "Đã hủy",
  VITALS_RECORDED: "Đã ghi nhận sinh hiệu",
};

const cleanText = (value, fallback = "Chưa cập nhật") => {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
};

const shortHash = (value) => {
  if (!value) return "Chưa có";
  const text = String(value);
  return text.length > 18 ? `${text.slice(0, 10)}...${text.slice(-8)}` : text;
};

const visibleRecordId = (hoSo = {}) =>
  hoSo.displayRecordId ||
  hoSo.recordCode ||
  hoSo.citizenId ||
  hoSo.cccd ||
  hoSo.medicalRecordId ||
  hoSo.recordId ||
  hoSo.maHSBA ||
  "Chưa có";

const ledgerRecordId = (hoSo = {}) =>
  hoSo.citizenId ||
  hoSo.cccd ||
  hoSo.medicalRecordId ||
  hoSo.recordId ||
  hoSo.recordCode ||
  hoSo.maHSBA ||
  null;

const blockchainPresentation = (ledgerStatus, loading) => {
  const summary = ledgerStatus?.summary || {};
  const status = ledgerStatus?.status || 'NOT_CHECKED';
  const amb = ledgerStatus?.amb || {};

  if (loading) {
    return {
      tone: 'border-blue-200 bg-blue-50',
      iconTone: 'bg-blue-100 text-blue-700',
      title: 'Đang kiểm tra bằng chứng hồ sơ...',
      subtitle: 'Hệ thống đang so sánh dữ liệu hiện tại với các dấu vết đã ghi nhận.',
      badge: 'Đang kiểm tra',
      badgeTone: 'bg-blue-100 text-blue-700',
      good: false,
    };
  }

  if (!ledgerStatus) {
    return {
      tone: 'border-slate-200 bg-white',
      iconTone: 'bg-slate-100 text-slate-600',
      title: 'Chưa kiểm tra bằng chứng blockchain',
      subtitle: 'Bấm nút kiểm tra để xác minh hồ sơ có bị sửa ngoài quy trình hay không.',
      badge: 'Chưa kiểm tra',
      badgeTone: 'bg-slate-100 text-slate-600',
      good: false,
    };
  }

  if (status === 'VALID') {
    return {
      tone: 'border-emerald-200 bg-emerald-50/70',
      iconTone: 'bg-emerald-100 text-emerald-700',
      title: summary.headline || 'Hồ sơ hợp lệ, chưa phát hiện sửa đổi trái phép',
      subtitle:
        summary.explain ||
        'Các dữ liệu trong hồ sơ khớp với chuỗi hash đã lưu. Nếu ai sửa dữ liệu trực tiếp, lần kiểm tra sau sẽ báo lỗi.',
      badge: amb.enabled ? 'Đã có AMB/Ethereum' : 'Hash-chain nội bộ',
      badgeTone: 'bg-emerald-100 text-emerald-700',
      good: true,
    };
  }

  if (status === 'NO_LEDGER_DATA') {
    return {
      tone: 'border-amber-200 bg-amber-50/80',
      iconTone: 'bg-amber-100 text-amber-700',
      title: 'Chưa có bằng chứng blockchain cho hồ sơ này',
      subtitle: 'Hồ sơ chưa có block. Hãy tạo phiếu khám/đơn thuốc/xét nghiệm mới hoặc chạy backfill ledger.',
      badge: 'Chưa có block',
      badgeTone: 'bg-amber-100 text-amber-700',
      good: false,
    };
  }

  return {
    tone: 'border-red-200 bg-red-50/80',
    iconTone: 'bg-red-100 text-red-700',
    title: summary.headline || 'Cần kiểm tra lại tính toàn vẹn hồ sơ',
    subtitle:
      summary.explain ||
      'Một dấu vết trong hồ sơ không còn khớp với dữ liệu hiện tại hoặc chuỗi hash bị đứt.',
    badge: 'Cần xử lý',
    badgeTone: 'bg-red-100 text-red-700',
    good: false,
  };
};

const statusLabel = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  return STATUS_LABEL[normalized] || cleanText(value);
};

const formatDate = (value, format = "DD/MM/YYYY") => {
  if (!value) return "Chưa cập nhật";
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format(format) : cleanText(value);
};

const eventDateKey = (event) => {
  const value = event?.thoiGian || event?.occurredAt;
  return value && dayjs(value).isValid() ? dayjs(value).format("YYYY-MM-DD") : "unknown";
};

const eventMonthKey = (event) => {
  const value = event?.thoiGian || event?.occurredAt;
  return value && dayjs(value).isValid() ? dayjs(value).format("YYYY-MM") : "unknown";
};

const SummaryCard = ({ icon: Icon, label, value, tone }) => (
  <div className={`rounded-2xl border p-4 shadow-sm ${tone}`}>
    <div className="flex items-center gap-3">
      <div className="rounded-xl bg-white/80 p-2.5 shadow-sm">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-black leading-none">{value ?? 0}</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide opacity-75">
          {label}
        </p>
      </div>
    </div>
  </div>
);

const InfoRow = ({ label, value, multiline = false }) => (
  <div className="grid gap-1 border-b border-slate-100 py-2.5 last:border-b-0 md:grid-cols-[170px_1fr] md:gap-4">
    <span className="text-sm font-semibold text-slate-500">{label}</span>
    <span className={`text-sm text-slate-800 ${multiline ? "whitespace-pre-wrap" : ""}`}>
      {cleanText(value)}
    </span>
  </div>
);

const VitalsGrid = ({ vitals = {} }) => {
  const items = [
    ["Nhiệt độ", vitals.temperature, "°C"],
    ["Mạch", vitals.heartRate, "lần/phút"],
    [
      "Huyết áp",
      vitals.systolicBloodPressure && vitals.diastolicBloodPressure
        ? `${vitals.systolicBloodPressure}/${vitals.diastolicBloodPressure}`
        : null,
      "mmHg",
    ],
    ["SpO₂", vitals.oxygenSaturation, "%"],
    ["Cân nặng", vitals.weightKg, "kg"],
    ["Chiều cao", vitals.heightCm, "cm"],
  ].filter(([, value]) => value !== null && value !== undefined && value !== "");

  if (items.length === 0) return null;

  return (
    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {items.map(([label, value, unit]) => (
        <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-sm font-bold text-slate-800">
            {value} {unit}
          </p>
        </div>
      ))}
    </div>
  );
};

const ExaminationContent = ({ data = {} }) => (
  <div>
    <InfoRow label="Mã phiếu khám" value={data.maPK || data.examinationId} />
    <InfoRow label="Bác sĩ" value={data.tenBacSi || data.BacSi?.hoTen || data.maBS} />
    <InfoRow label="Triệu chứng" value={data.trieuChung || data.symptoms} multiline />
    <InfoRow label="Chẩn đoán" value={data.chuanDoan || data.diagnosis} multiline />
    <InfoRow label="Điều trị" value={data.dieuTri || data.treatment} multiline />
    <InfoRow label="Lời dặn" value={data.loiDan || data.advice} multiline />
    <InfoRow label="Trạng thái" value={statusLabel(data.trangThai || data.status)} />
    <VitalsGrid vitals={data.sinhHieu || data.vitals || {}} />
  </div>
);

const PrescriptionContent = ({ data = {} }) => {
  const items = data.chiTiet || data.medicineItems || [];

  return (
    <div>
      <InfoRow label="Mã đơn thuốc" value={data.maDT || data.prescriptionId} />
      <InfoRow label="Bác sĩ kê đơn" value={data.tenBacSi || data.maBS} />
      <InfoRow label="Lời dặn chung" value={data.loiDan || data.generalInstructions} multiline />
      <InfoRow label="Trạng thái" value={statusLabel(data.trangThai || data.status)} />

      <div className="mt-4 overflow-hidden rounded-xl border border-violet-100">
        <div className="bg-violet-50 px-4 py-3 text-sm font-bold text-violet-800">
          Chi tiết thuốc ({items.length})
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-5 text-sm italic text-slate-500">Chưa có chi tiết thuốc.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-white text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Tên thuốc</th>
                  <th className="px-4 py-3">Số lượng</th>
                  <th className="px-4 py-3">Liều dùng</th>
                  <th className="px-4 py-3">Tần suất</th>
                  <th className="px-4 py-3">Hướng dẫn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, index) => (
                  <tr key={`${item.maThuoc || item.medicineId || "medicine"}-${index}`}>
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {cleanText(item.tenThuoc || item.medicineName)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {cleanText(item.soLuong ?? item.quantity, "-")} {item.donVi || item.unit || ""}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {cleanText(item.lieuDung || item.dosage, "-")}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {cleanText(item.tanSuat || item.frequency, "-")}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {cleanText(item.huongDan || item.instructions, "-")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const LabResultContent = ({ data = {} }) => (
  <div>
    <InfoRow label="Mã phiếu xét nghiệm" value={data.maPhieuXN || data.labResultId} />
    <InfoRow label="Xét nghiệm" value={data.XetNghiem?.tenXN || data.testName} />
    <InfoRow label="Loại xét nghiệm" value={data.XetNghiem?.LoaiXetNghiem?.tenLoai || data.categoryName} />
    <InfoRow label="Kỹ thuật viên" value={data.tenNhanSu || data.NhanSuYTe?.hoTen || data.maNS} />
    <InfoRow label="Kết quả" value={data.ketQua || data.resultText} multiline />
    <InfoRow label="Khoảng tham chiếu" value={data.khoangThamChieu || data.referenceRange} />
    <InfoRow label="Đơn vị" value={data.donVi || data.unit} />
    <InfoRow label="Trạng thái" value={statusLabel(data.trangThai || data.status)} />
  </div>
);

const AppointmentContent = ({ data = {} }) => (
  <div>
    <InfoRow label="Mã lịch khám" value={data.maLich || data.appointmentId} />
    <InfoRow label="Bác sĩ" value={data.tenBacSi || data.BacSi?.hoTen || data.maBS} />
    <InfoRow label="Ngày khám" value={formatDate(data.ngayKham || data.appointmentDate)} />
    <InfoRow label="Giờ khám" value={data.gioKham || data.appointmentTime} />
    <InfoRow label="Khoa" value={data.maKhoa || data.departmentId} />
    <InfoRow label="Phòng" value={data.maPhong || data.roomId} />
    <InfoRow label="Trạng thái" value={statusLabel(data.trangThai || data.status)} />
  </div>
);

const EventContent = ({ event }) => {
  switch (event.loai) {
    case "PHIEU_KHAM":
      return <ExaminationContent data={event.data} />;
    case "DON_THUOC":
      return <PrescriptionContent data={event.data} />;
    case "XET_NGHIEM":
      return <LabResultContent data={event.data} />;
    case "LICH_KHAM":
      return <AppointmentContent data={event.data} />;
    default:
      return <pre className="overflow-auto text-xs">{JSON.stringify(event.data, null, 2)}</pre>;
  }
};

const EventCard = ({ event }) => {
  const [expanded, setExpanded] = useState(true);
  const style = EVENT_STYLE[event.loai] || EVENT_STYLE.PHIEU_KHAM;
  const Icon = style.icon;
  const occurredAt = event.thoiGian || event.occurredAt;

  return (
    <article className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md ${style.accent}`}>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className={`flex w-full items-center justify-between gap-4 bg-gradient-to-r px-4 py-3 text-left text-white ${style.header}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="rounded-lg bg-white/20 p-2 backdrop-blur-sm">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h4 className="truncate text-sm font-bold md:text-base">{style.title}</h4>
            {event.maHSBA && (
              <p className="truncate text-xs text-white/80">Hồ sơ: {event.maHSBA}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden rounded-lg bg-white/20 px-3 py-1.5 text-xs font-semibold sm:inline-flex">
            {formatDate(occurredAt, "DD/MM/YYYY HH:mm")}
          </span>
          <ChevronDown className={`h-5 w-5 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {expanded && (
        <div className="p-4 md:p-5">
          <div className={`mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${style.badge}`}>
            <Clock3 className="h-3.5 w-3.5" />
            {formatDate(occurredAt, "DD/MM/YYYY HH:mm")}
          </div>
          <EventContent event={event} />
        </div>
      )}
    </article>
  );
};

const EmptyState = ({ title, description }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
    <FileHeart className="mx-auto h-12 w-12 text-slate-300" />
    <h3 className="mt-4 text-lg font-bold text-slate-700">{title}</h3>
    <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">{description}</p>
  </div>
);

const HoSoBenhAnPage = () => {
  const [patientId, setPatientId] = useState(null);
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [ledgerStatus, setLedgerStatus] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [filters, setFilters] = useState(() =>
    Object.fromEntries(FILTERS.map((item) => [item.key, true])),
  );

  const loadMedicalRecord = async () => {
    setLoading(true);
    setError("");

    try {
      const resolvedPatientId = patientId || (await resolvePatientId());
      if (!resolvedPatientId) {
        throw new Error("Tài khoản chưa được liên kết với hồ sơ bệnh nhân.");
      }

      setPatientId(resolvedPatientId);
      const response = await getHoSoTongHop(resolvedPatientId);
      const payload = response?.data?.data ?? response?.data ?? null;
      setRecord(payload);

      const currentRecordId = ledgerRecordId(payload?.hoSo || {});

      if (currentRecordId) {
        await loadLedgerStatus(currentRecordId);
      } else {
        setLedgerStatus(null);
      }
    } catch (requestError) {
      const message =
        requestError?.response?.data?.message ||
        requestError?.response?.data?.error?.message ||
        requestError?.message ||
        "Không thể tải hồ sơ bệnh án.";
      setError(message);
      setRecord(null);
    } finally {
      setLoading(false);
    }
  };


  const loadLedgerStatus = async (recordId) => {
    if (!recordId) return;
    setLedgerLoading(true);
    try {
      const response = await verifyMedicalLedger(recordId);
      setLedgerStatus(response?.data?.data ?? response?.data ?? null);
    } catch (requestError) {
      setLedgerStatus({
        valid: false,
        status: "VERIFY_FAILED",
        message:
          requestError?.response?.data?.message ||
          requestError?.message ||
          "Không thể kiểm tra blockchain.",
      });
    } finally {
      setLedgerLoading(false);
    }
  };

  useEffect(() => {
    loadMedicalRecord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleEvents = useMemo(() => {
    const events = Array.isArray(record?.suKien) ? record.suKien : [];
    return events.filter((event) => {
      const typeMatched = filters[event.loai] !== false;
      const dateMatched = !filterDate || eventDateKey(event) === filterDate;
      return typeMatched && dateMatched;
    });
  }, [record, filters, filterDate]);

  const groupedTimeline = useMemo(() => {
    const monthMap = new Map();

    for (const event of visibleEvents) {
      const monthKey = eventMonthKey(event);
      const dayKey = eventDateKey(event);
      const month = monthMap.get(monthKey) || {
        key: monthKey,
        label: monthKey === "unknown" ? "Không xác định" : dayjs(`${monthKey}-01`).format("MM/YYYY"),
        days: new Map(),
        total: 0,
      };
      const day = month.days.get(dayKey) || {
        key: dayKey,
        label: dayKey === "unknown" ? "Không xác định" : dayjs(dayKey).format("DD/MM/YYYY"),
        events: [],
      };

      day.events.push(event);
      month.days.set(dayKey, day);
      month.total += 1;
      monthMap.set(monthKey, month);
    }

    return [...monthMap.values()]
      .sort((left, right) => right.key.localeCompare(left.key))
      .map((month) => ({
        ...month,
        days: [...month.days.values()].sort((left, right) => right.key.localeCompare(left.key)),
      }));
  }, [visibleEvents]);

  const toggleFilter = (key) => {
    setFilters((current) => ({ ...current, [key]: !current[key] }));
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-6">
        <div className="text-center">
          <LoaderCircle className="mx-auto h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 font-semibold text-slate-600">Đang tổng hợp hồ sơ bệnh án...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <FileHeart className="mx-auto h-12 w-12 text-red-400" />
          <h2 className="mt-4 text-xl font-bold text-red-700">Không thể tải hồ sơ bệnh án</h2>
          <p className="mt-2 text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={loadMedicalRecord}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 font-semibold text-white hover:bg-red-700"
          >
            <RefreshCw className="h-4 w-4" />
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  if (!record?.hoSo) {
    return (
      <div className="p-4 md:p-6">
        <EmptyState
          title="Chưa có hồ sơ bệnh án"
          description="Hồ sơ bệnh án sẽ được tạo một lần cho tài khoản bệnh nhân và tự động bổ sung các lần khám, đơn thuốc cùng kết quả xét nghiệm về sau."
        />
      </div>
    );
  }

  const { hoSo, thongKe = {} } = record;
  const patient = hoSo.benhNhan || {};
  const displayRecord = visibleRecordId(hoSo);
  const integrityRecordId = ledgerRecordId(hoSo);
  const blockchainView = blockchainPresentation(ledgerStatus, ledgerLoading);
  const amb = ledgerStatus?.amb || {};
  const summary = ledgerStatus?.summary || {};

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between md:p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 p-3 text-white shadow-lg shadow-blue-200">
                <FileHeart className="h-7 w-7" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
                  Hồ sơ bệnh án duy nhất
                </p>
                <h1 className="mt-1 text-2xl font-black text-slate-900 md:text-3xl">
                  Chi tiết hồ sơ: <span className="text-blue-600">{displayRecord}</span>
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-blue-500" />
                    Ngày thành lập: <strong className="text-slate-700">{formatDate(hoSo.ngayLap)}</strong>
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-blue-500" />
                    Bệnh nhân: <strong className="text-slate-700">{patient.hoTen || patient.fullName || hoSo.maBN}</strong>
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    {statusLabel(hoSo.trangThai || hoSo.status)}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={loadMedicalRecord}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-700"
            >
              <RefreshCw className="h-4 w-4" />
              Làm mới dữ liệu
            </button>
          </div>

          {hoSo.lichSuBenh && (
            <div className="border-t border-slate-100 bg-blue-50/50 px-5 py-4 md:px-6">
              <div className="flex items-start gap-3">
                <HeartPulse className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Tóm tắt lịch sử bệnh</p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{hoSo.lichSuBenh}</p>
                </div>
              </div>
            </div>
          )}
        </section>


        <section className={`rounded-2xl border p-4 shadow-sm transition-all md:p-5 ${blockchainView.tone}`}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className={`rounded-2xl p-3 ${blockchainView.iconTone}`}>
                {blockchainView.good ? <ShieldCheck className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Bằng chứng toàn vẹn hồ sơ
                  </p>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${blockchainView.badgeTone}`}>
                    {blockchainView.badge}
                  </span>
                </div>

                <h2 className="mt-2 text-xl font-black text-slate-900">
                  {blockchainView.title}
                </h2>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-700">
                  {blockchainView.subtitle}
                </p>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-white/70 bg-white/80 p-3">
                    <p className="text-xs font-bold uppercase text-slate-400">Kết quả kiểm tra</p>
                    <p className="mt-1 text-sm font-black text-slate-800">
                      {ledgerStatus?.status || "Chưa kiểm tra"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/70 bg-white/80 p-3">
                    <p className="text-xs font-bold uppercase text-slate-400">Số dấu vết</p>
                    <p className="mt-1 text-sm font-black text-slate-800">
                      {ledgerStatus?.blockCount ?? 0} block
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/70 bg-white/80 p-3">
                    <p className="text-xs font-bold uppercase text-slate-400">Hash cuối</p>
                    <p className="mt-1 font-mono text-sm font-black text-slate-800">
                      {shortHash(ledgerStatus?.latestBlockHash)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/70 bg-white/80 p-3">
                    <p className="text-xs font-bold uppercase text-slate-400">AMB/Ethereum</p>
                    <p className="mt-1 text-sm font-black text-slate-800">
                      {amb.enabled
                        ? `${amb.confirmed || 0} xác nhận, ${amb.submitted || 0} đang chờ`
                        : "Chưa bật"}
                    </p>
                  </div>
                </div>

                {ledgerStatus?.brokenAt && (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-white/90 p-3 text-sm text-red-700">
                    <strong>Vị trí cần kiểm tra:</strong> {ledgerStatus.brokenAt}
                  </div>
                )}

                {summary.recommendedAction && ledgerStatus?.status !== "VALID" && (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-white/90 p-3 text-sm text-amber-800">
                    <strong>Gợi ý xử lý:</strong> {summary.recommendedAction}
                  </div>
                )}

                {amb.latestTransactionId && (
                  <div className="mt-4 rounded-2xl border border-indigo-200 bg-white/90 p-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase text-indigo-500">
                          Giao dịch blockchain AMB mới nhất
                        </p>
                        <p className="mt-1 font-mono text-sm font-black text-slate-800">
                          {shortHash(amb.latestTransactionId)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Mạng: {amb.latestNetwork || "Ethereum"} · Trạng thái: {amb.latestStatus || "Không rõ"}
                        </p>
                      </div>
                      {amb.latestTransactionUrl && (
                        <a
                          href={amb.latestTransactionUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-700"
                        >
                          Xem biên nhận
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-4 flex items-start gap-2 rounded-2xl border border-slate-200 bg-white/70 p-3 text-xs leading-5 text-slate-600">
                  <Database className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <p>
                    Dữ liệu bệnh án thật vẫn lưu trong hệ thống bệnh viện. Blockchain chỉ lưu dấu vân tay số
                    của dữ liệu để chứng minh hồ sơ không bị sửa âm thầm.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => loadLedgerStatus(integrityRecordId)}
              disabled={ledgerLoading}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-60"
            >
              {ledgerLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Kiểm tra bằng chứng
            </button>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <SummaryCard icon={CalendarDays} label="Đợt khám" value={thongKe.soDotKham} tone="border-emerald-200 bg-emerald-50 text-emerald-800" />
          <SummaryCard icon={Stethoscope} label="Phiếu khám" value={thongKe.soPhieuKham} tone="border-blue-200 bg-blue-50 text-blue-800" />
          <SummaryCard icon={Pill} label="Đơn thuốc" value={thongKe.soDonThuoc} tone="border-violet-200 bg-violet-50 text-violet-800" />
          <SummaryCard icon={FlaskConical} label="Xét nghiệm" value={thongKe.soXetNghiem} tone="border-amber-200 bg-amber-50 text-amber-800" />
          <SummaryCard icon={ClipboardList} label="Tổng sự kiện" value={thongKe.tongSuKien} tone="col-span-2 border-slate-200 bg-white text-slate-800 md:col-span-1" />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-black text-slate-900">Bộ lọc hiển thị</h2>
              <p className="text-xs text-slate-500">Bật hoặc tắt từng loại thông tin trong hồ sơ.</p>
            </div>
          </div>

          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex flex-wrap gap-2.5">
              {FILTERS.map((filter) => {
                const Icon = filter.icon;
                const active = filters[filter.key];
                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => toggleFilter(filter.key)}
                    className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold shadow-sm transition ${active ? filter.active : filter.idle}`}
                  >
                    {active && <Check className="h-4 w-4" />}
                    <Icon className="h-4 w-4" />
                    {filter.label}
                  </button>
                );
              })}
            </div>

            <label className="block w-full xl:w-64">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Lọc theo ngày
              </span>
              <input
                type="date"
                value={filterDate}
                onChange={(event) => setFilterDate(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>
        </section>

        {groupedTimeline.length === 0 ? (
          <EmptyState
            title="Không có dữ liệu phù hợp"
            description="Không có sự kiện nào khớp với bộ lọc hiện tại. Hãy bật thêm loại dữ liệu hoặc xóa ngày đang lọc."
          />
        ) : (
          <section className="space-y-7">
            {groupedTimeline.map((month) => (
              <div key={month.key} className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-xl bg-blue-600 p-2.5 text-white shadow-md shadow-blue-200">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-black text-slate-900 md:text-xl">
                    Đợt khám bệnh: Tháng {month.label}
                  </h2>
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                    {month.total} sự kiện
                  </span>
                </div>

                <div className="space-y-4">
                  {month.days.map((day) => (
                    <div key={day.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                      <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-slate-100 pb-3">
                        <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
                          <FileText className="h-4 w-4" />
                        </div>
                        <h3 className="font-black text-slate-800">Ngày {day.label}</h3>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                          {day.events.length} sự kiện
                        </span>
                      </div>

                      <div className="space-y-4">
                        {day.events.map((event) => (
                          <EventCard key={event.id} event={event} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
};

export default HoSoBenhAnPage;
