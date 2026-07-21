import React, { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import {
  FileText,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import AdminPagination, {
  useAdminPagination,
} from "../../components/admin/AdminPagination";
import axios from "../../api/axiosClient";
import {
  ensureArray,
  getApiErrorMessage,
  unwrapApiResponse,
} from "../../utils/apiResponse";

function formatDate(value, fallback = "—") {
  if (!value) return fallback;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("DD/MM/YYYY") : fallback;
}

function normalizeStatus(value) {
  const normalized = String(value || "OPEN").trim().toUpperCase();

  if (["CLOSED", "DONG", "DA_DONG", "INACTIVE"].includes(normalized)) {
    return "CLOSED";
  }

  return "OPEN";
}

function normalizeRecord(item = {}) {
  const patient = item.BenhNhan || item.patient || {};
  const patientId =
    item.maBN || item.patientId || patient.maBN || patient.patientId || "";
  const recordId =
    item.recordId || item.medicalRecordId || item.maHSBA ||
    (patientId ? `HSBA-${patientId}` : "");
  const citizenId = patient.cccd || patient.citizenId || item.cccd || "";
  const displayRecordId =
    item.displayRecordId || item.maHSBAHienThi || citizenId || recordId;

  return {
    recordId,
    displayRecordId,
    citizenId,
    patientId,
    fullName:
      patient.hoTen || patient.fullName || item.hoTen || "Chưa cập nhật",
    dateOfBirth: patient.ngaySinh || patient.dateOfBirth || "",
    gender: patient.gioiTinh || patient.gender || "",
    phoneNumber: patient.soDienThoai || patient.phoneNumber || "",
    email: patient.email || item.email || "",
    healthInsurance:
      patient.bhyt ||
      patient.healthInsurance ||
      patient.healthInsuranceNumber ||
      item.bhyt ||
      "",
    createdAt: item.ngayLap || item.createdAt || patient.createdAt || "",
    updatedAt:
      item.ngayCapNhat ||
      item.updatedAt ||
      item.ngayLap ||
      item.createdAt ||
      patient.updatedAt ||
      patient.createdAt ||
      "",
    status: normalizeStatus(item.trangThai || item.status),
    hasStoredRecord: Boolean(
      item.coHoSoLuuTru ?? item.hasStoredRecord ?? true,
    ),
  };
}

function chooseCanonicalRecord(current, candidate) {
  if (!current) return candidate;

  if (!current.hasStoredRecord && candidate.hasStoredRecord) return candidate;
  if (current.hasStoredRecord && !candidate.hasStoredRecord) return current;

  const currentCreatedAt = String(current.createdAt || "");
  const candidateCreatedAt = String(candidate.createdAt || "");

  if (!currentCreatedAt) return candidate;
  if (!candidateCreatedAt) return current;

  return candidateCreatedAt.localeCompare(currentCreatedAt) < 0
    ? candidate
    : current;
}

function StatusBadge({ status }) {
  const isClosed = status === "CLOSED";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
        isClosed
          ? "bg-slate-100 text-slate-600"
          : "bg-emerald-100 text-emerald-700"
      }`}
    >
      {isClosed ? "Đã đóng" : "Đang quản lý"}
    </span>
  );
}

function ManageHoSoBenhAn() {
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  const fetchRecords = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);

    try {
      const response = await axios.get("/hsba");
      const source = ensureArray(unwrapApiResponse(response, []));
      const grouped = new Map();

      for (const rawItem of source) {
        const record = normalizeRecord(rawItem);
        const key = record.patientId || record.recordId;

        if (!key) continue;

        grouped.set(
          key,
          chooseCanonicalRecord(grouped.get(key), record),
        );
      }

      setRecords(
        [...grouped.values()].sort((left, right) =>
          left.fullName.localeCompare(right.fullName, "vi"),
        ),
      );
    } catch (error) {
      if (!silent) setRecords([]);
      toast.error(
        getApiErrorMessage(error, "Không thể tải danh sách hồ sơ bệnh án"),
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const filteredRecords = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return records.filter((record) => {
      const matchesStatus =
        statusFilter === "ALL" || record.status === statusFilter;

      const matchesKeyword =
        !keyword ||
        [
          record.recordId,
          record.displayRecordId,
          record.citizenId,
          record.patientId,
          record.fullName,
          record.phoneNumber,
          record.email,
          record.healthInsurance,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(keyword),
        );

      return matchesStatus && matchesKeyword;
    });
  }, [records, search, statusFilter]);

  const pagination = useAdminPagination(filteredRecords, {
    initialPageSize: 10,
    resetKey: `${search}|${statusFilter}`,
  });

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-purple-600">
            Quản lý hồ sơ
          </p>
          <h1 className="mt-1 text-3xl font-black text-slate-900">
            Hồ sơ bệnh án
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Mỗi bệnh nhân chỉ có một hồ sơ. Admin chỉ xem thông tin hành chính
            bên ngoài hồ sơ.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchRecords()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          Làm mới
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo mã hồ sơ, mã bệnh nhân, họ tên, số điện thoại hoặc BHYT..."
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="OPEN">Đang quản lý</option>
          <option value="CLOSED">Đã đóng</option>
        </select>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <div className="flex items-start gap-2">
          <ShieldCheck size={18} className="mt-0.5 shrink-0" />
          <p>
            Admin không có quyền mở nội dung lâm sàng, phiếu khám, đơn thuốc,
            kết quả xét nghiệm hoặc lịch sử điều trị.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw
              className="mx-auto mb-3 animate-spin text-purple-500"
              size={32}
            />
            Đang tải danh sách hồ sơ bệnh án...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <FileText className="mx-auto mb-3 text-slate-300" size={48} />
            Không tìm thấy hồ sơ bệnh án phù hợp.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="w-16 px-5 py-4">STT</th>
                    <th className="px-5 py-4">Mã hồ sơ</th>
                    <th className="px-5 py-4">Bệnh nhân</th>
                    <th className="px-5 py-4">Mã bệnh nhân</th>
                    <th className="px-5 py-4">Ngày lập</th>
                    <th className="px-5 py-4">Cập nhật</th>
                    <th className="px-5 py-4">CCCD</th>
                    <th className="px-5 py-4">BHYT</th>
                    <th className="px-5 py-4">Trạng thái</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {pagination.pageItems.map((record, index) => {
                    const sequence =
                      (pagination.currentPage - 1) * pagination.pageSize +
                      index +
                      1;

                    return (
                      <tr
                        key={`${record.patientId}-${record.recordId}`}
                        className="hover:bg-purple-50/40"
                      >
                        <td className="px-5 py-4 text-slate-500">
                          {sequence}
                        </td>
                        <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-700">
                          {record.displayRecordId || record.recordId || "—"}
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-900">
                            {record.fullName}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {record.gender || "Chưa cập nhật"}
                            {record.dateOfBirth
                              ? ` · ${formatDate(record.dateOfBirth)}`
                              : ""}
                          </p>
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-slate-600">
                          {record.patientId || "—"}
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {formatDate(record.createdAt)}
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {formatDate(record.updatedAt)}
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-slate-600">
                          {record.citizenId || "—"}
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {record.healthInsurance || "—"}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={record.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <AdminPagination
              pagination={pagination}
              itemLabel="hồ sơ"
              pageSizeOptions={[5, 10, 20, 50]}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default ManageHoSoBenhAn;
