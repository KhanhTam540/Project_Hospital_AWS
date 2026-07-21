import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import {
  createHoSo,
  deleteHoSo,
  getAllHoSo,
} from "../../../services/nhansu/tiepnhan/hsbaService";
import axios from "../../../api/axiosClient";
import {
  ensureArray,
  getApiErrorMessage,
  unwrapApiResponse,
} from "../../../utils/apiResponse";

const EMPTY_FORM = {
  maBN: "",
  dotKhamBenh: "",
  lichSuBenh: "",
  ghiChu: "",
};

const TiepNhanHoSoPage = () => {
  const [records, setRecords] = useState([]);
  const [patients, setPatients] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [patientQuery, setPatientQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedPatient = useMemo(
    () => patients.find((item) => item.maBN === form.maBN) || null,
    [patients, form.maBN],
  );

  const filteredPatients = useMemo(() => {
    const query = patientQuery.trim().toLowerCase();
    if (!query) return patients.slice(0, 20);
    return patients
      .filter((item) =>
        [item.hoTen, item.maBN, item.cccd, item.soDienThoai]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
      .slice(0, 20);
  }, [patients, patientQuery]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [recordResponse, patientResponse] = await Promise.all([
        getAllHoSo(),
        axios.get("/benhnhan"),
      ]);
      setRecords(ensureArray(unwrapApiResponse(recordResponse, [])));
      setPatients(ensureArray(unwrapApiResponse(patientResponse, [])));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể tải dữ liệu hồ sơ"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async () => {
    if (!selectedPatient) {
      toast.error("Vui lòng chọn bệnh nhân");
      return;
    }
    if (!selectedPatient.cccd || !/^\d{12}$/.test(selectedPatient.cccd)) {
      toast.error(
        "Bệnh nhân chưa có CCCD hợp lệ. Hãy cập nhật CCCD trước khi tạo hồ sơ.",
      );
      return;
    }
    if (!form.dotKhamBenh) {
      toast.error("Vui lòng chọn ngày tiếp nhận hồ sơ");
      return;
    }

    setSaving(true);
    try {
      await createHoSo({
        ...form,
        maHSBA: selectedPatient.cccd,
        dotKhamBenh: new Date(
          `${form.dotKhamBenh}T${new Date().toTimeString().slice(0, 5)}:00+07:00`,
        ).toISOString(),
      });
      toast.success("Tạo hồ sơ bệnh án thành công");
      setForm(EMPTY_FORM);
      setPatientQuery("");
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể tạo hồ sơ bệnh án"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (recordId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa hồ sơ này?")) return;
    try {
      await deleteHoSo(recordId);
      toast.success("Đã xóa hồ sơ");
      await loadData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể xóa hồ sơ"));
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-blue-700">
          Tiếp nhận hồ sơ bệnh án
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Mã hồ sơ bệnh án được lấy từ số CCCD của bệnh nhân.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="relative">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Tìm bệnh nhân
            </label>
            <input
              value={patientQuery}
              onChange={(event) => {
                setPatientQuery(event.target.value);
                setForm((current) => ({ ...current, maBN: "" }));
              }}
              placeholder="Nhập họ tên, mã bệnh nhân, CCCD hoặc số điện thoại"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
            />
            {patientQuery && !form.maBN && (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border bg-white shadow-xl">
                {filteredPatients.length === 0 ? (
                  <p className="p-3 text-sm text-slate-500">
                    Không tìm thấy bệnh nhân.
                  </p>
                ) : (
                  filteredPatients.map((patient) => (
                    <button
                      type="button"
                      key={patient.maBN}
                      onClick={() => {
                        setForm((current) => ({
                          ...current,
                          maBN: patient.maBN,
                        }));
                        setPatientQuery(
                          `${patient.hoTen} - ${patient.cccd || patient.maBN}`,
                        );
                      }}
                      className="block w-full border-b px-3 py-2 text-left text-sm hover:bg-blue-50"
                    >
                      <p className="font-semibold text-slate-800">
                        {patient.hoTen}
                      </p>
                      <p className="text-xs text-slate-500">
                        Mã BN: {patient.maBN} • CCCD: {patient.cccd || "Chưa có"}
                      </p>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <label className="space-y-1 text-sm font-medium text-slate-700">
            Ngày tiếp nhận
            <input
              type="date"
              value={form.dotKhamBenh}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  dotKhamBenh: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
            />
          </label>

          <label className="space-y-1 text-sm font-medium text-slate-700">
            Lịch sử bệnh
            <textarea
              value={form.lichSuBenh}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  lichSuBenh: event.target.value,
                }))
              }
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
            />
          </label>

          <label className="space-y-1 text-sm font-medium text-slate-700">
            Ghi chú
            <textarea
              value={form.ghiChu}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  ghiChu: event.target.value,
                }))
              }
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
            />
          </label>
        </div>

        {selectedPatient && (
          <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
            <strong>{selectedPatient.hoTen}</strong>
            <span className="mx-2">•</span>
            Mã BN: {selectedPatient.maBN}
            <span className="mx-2">•</span>
            Mã HSBA sẽ tạo: {selectedPatient.cccd || "Chưa có CCCD"}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Đang tạo..." : "Tạo hồ sơ bệnh án"}
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-8 text-center text-slate-500">Đang tải dữ liệu...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-blue-50 text-left text-blue-800">
                <tr>
                  <th className="px-4 py-3">Mã HSBA</th>
                  <th className="px-4 py-3">Bệnh nhân</th>
                  <th className="px-4 py-3">CCCD</th>
                  <th className="px-4 py-3">Ngày lập</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.recordId || record.maHSBA} className="border-t">
                    <td className="px-4 py-3 font-mono text-xs">
                      {record.displayRecordId ||
                        record.maHSBAHienThi ||
                        record.maHSBA}
                    </td>
                    <td className="px-4 py-3">
                      {record.BenhNhan?.hoTen || record.patientName || "-"}
                    </td>
                    <td className="px-4 py-3">
                      {record.BenhNhan?.cccd || record.cccd || "-"}
                    </td>
                    <td className="px-4 py-3">
                      {record.ngayLap
                        ? new Date(record.ngayLap).toLocaleString("vi-VN")
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          handleDelete(record.recordId || record.maHSBA)
                        }
                        className="text-red-600 hover:underline"
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default TiepNhanHoSoPage;
