import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { CheckCircle2, FileText, Save } from "lucide-react";

import {
  createExaminationForRecord,
  getDoctorMedicalRecords,
} from "../../services/bacsi/doctorWorkflowService";
import { getApiErrorMessage } from "../../utils/apiResponse";

const EMPTY_FORM = {
  trieuChung: "",
  chuanDoan: "",
  dieuTri: "",
  loiDan: "",
};

const text = (value) => String(value ?? "").trim();
const sameId = (left, right) =>
  text(left).toUpperCase() === text(right).toUpperCase();

const getPatientId = (patient) =>
  text(patient?.patientId || patient?.maBN || patient?.id);

const getPreferredRecordId = (patient) =>
  text(
    patient?.recordId ||
      patient?.medicalRecordId ||
      patient?.maHSBA,
  );

const ExaminationPanel = ({ patient, onSaved, onComplete }) => {
  const [records, setRecords] = useState([]);
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastCreated, setLastCreated] = useState(null);

  const patientId = useMemo(() => getPatientId(patient), [patient]);

  const selectedRecord = useMemo(
    () =>
      records.find((item) => item.recordId === selectedRecordId) ||
      null,
    [records, selectedRecordId],
  );

  useEffect(() => {
    let active = true;

    const loadRecords = async () => {
      setRecords([]);
      setSelectedRecordId("");
      setLastCreated(null);
      setForm(EMPTY_FORM);

      if (!patientId) return;

      setLoadingRecords(true);
      try {
        const allRecords = await getDoctorMedicalRecords();
        if (!active) return;

        const patientRecords = allRecords.filter(
          (item) => sameId(item.patientId, patientId),
        );
        const preferredRecordId = getPreferredRecordId(patient);
        const nextRecordId =
          patientRecords.find(
            (item) => sameId(item.recordId, preferredRecordId),
          )?.recordId ||
          patientRecords[0]?.recordId ||
          "";

        setRecords(patientRecords);
        setSelectedRecordId(nextRecordId);
      } catch (error) {
        if (!active) return;
        toast.error(
          getApiErrorMessage(
            error,
            "Không thể tải hồ sơ bệnh án của bệnh nhân",
          ),
        );
      } finally {
        if (active) setLoadingRecords(false);
      }
    };

    loadRecords();
    return () => {
      active = false;
    };
  }, [patientId, patient]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!patientId) {
      toast.error("Vui lòng chọn bệnh nhân từ hàng chờ");
      return;
    }
    if (!selectedRecord) {
      toast.error("Vui lòng chọn hồ sơ bệnh án");
      return;
    }
    if (!form.trieuChung.trim() || !form.chuanDoan.trim()) {
      toast.error("Vui lòng nhập triệu chứng và chẩn đoán");
      return;
    }

    setSaving(true);
    try {
      const created = await createExaminationForRecord(
        selectedRecord,
        {
          symptoms: form.trieuChung,
          diagnosis: form.chuanDoan,
          treatment: form.dieuTri,
          advice: form.loiDan,
          vitals: patient?.vitals || {},
        },
      );

      setLastCreated(created);
      setForm(EMPTY_FORM);
      toast.success("Đã lưu phiếu khám");
      onSaved?.(created);
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "Không thể lưu phiếu khám"),
      );
    } finally {
      setSaving(false);
    }
  };

  if (!patient) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400">
        <FileText size={40} className="mb-2 opacity-40" />
        <p className="text-sm">Chọn bệnh nhân để khám</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <h3 className="flex items-center gap-2 font-semibold text-blue-800">
          <FileText size={18} /> Phiếu khám — {patient.hoTenBN || patient.fullName || patientId}
        </h3>
        {patient.vitals && (
          <span className="text-xs text-gray-500">
            🌡 {patient.vitals.nhietDo ?? patient.vitals.temperature ?? "—"}°C · ❤ {patient.vitals.nhipTim ?? patient.vitals.heartRate ?? "—"}
          </span>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Hồ sơ bệnh án <span className="text-red-500">*</span>
        </label>
        <select
          value={selectedRecordId}
          onChange={(event) => {
            setSelectedRecordId(event.target.value);
            setLastCreated(null);
          }}
          disabled={loadingRecords || records.length === 0 || saving}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100"
        >
          <option value="">
            {loadingRecords
              ? "Đang tải hồ sơ..."
              : "— Chọn hồ sơ bệnh án —"}
          </option>
          {records.map((record) => (
            <option key={record.recordId} value={record.recordId}>
              {record.recordId} — {record.diagnosis || "Chưa có chẩn đoán"}
            </option>
          ))}
        </select>
        {!loadingRecords && records.length === 0 && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Bệnh nhân này chưa có hồ sơ bệnh án. Hãy tạo hồ sơ trước khi lập phiếu khám.
          </p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Triệu chứng <span className="text-red-500">*</span>
        </label>
        <textarea
          name="trieuChung"
          value={form.trieuChung}
          onChange={handleChange}
          rows={3}
          disabled={!selectedRecord || saving}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100"
          placeholder="Mô tả triệu chứng lâm sàng..."
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Chẩn đoán <span className="text-red-500">*</span>
        </label>
        <textarea
          name="chuanDoan"
          value={form.chuanDoan}
          onChange={handleChange}
          rows={2}
          disabled={!selectedRecord || saving}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100"
          placeholder="Nhập chẩn đoán..."
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Điều trị
          </label>
          <textarea
            name="dieuTri"
            value={form.dieuTri}
            onChange={handleChange}
            rows={2}
            disabled={!selectedRecord || saving}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100"
            placeholder="Hướng điều trị..."
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Lời dặn
          </label>
          <textarea
            name="loiDan"
            value={form.loiDan}
            onChange={handleChange}
            rows={2}
            disabled={!selectedRecord || saving}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100"
            placeholder="Hướng dẫn điều trị, tái khám..."
          />
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Tệp X-quang/MRI được tải ở tab “Phim chẩn đoán”, không gửi chung bằng multipart/form-data với phiếu khám.
      </p>

      {lastCreated && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <CheckCircle2 size={16} />
          Đã tạo phiếu {lastCreated.examinationId || lastCreated.maPK}.
          Bạn có thể chuyển sang tab “Kê đơn thuốc”.
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {lastCreated && patient.maLich && onComplete && (
          <button
            type="button"
            onClick={() => onComplete(patient)}
            className="rounded-lg border border-emerald-600 px-4 py-2.5 font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            Hoàn tất lượt khám
          </button>
        )}
        <button
          type="submit"
          disabled={!selectedRecord || saving}
          className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          <Save size={16} />
          {saving ? "Đang lưu..." : "Lưu phiếu khám"}
        </button>
      </div>
    </form>
  );
};

export default ExaminationPanel;
