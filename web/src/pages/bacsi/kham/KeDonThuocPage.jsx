import React, { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import toast from "react-hot-toast";

import {
  createDonThuocTheoPhieuKham,
  getDanhSachThuoc,
  getDonThuocTheoHoSo,
  getPhieuKhamTheoHoSo,
} from "../../../services/donthuoc/donthuocService";
import { getHoSoBenhAnChoBacSi } from "../../../services/kham/phieukhamService";
import { getApiErrorMessage } from "../../../utils/apiResponse";

const EMPTY_MEDICINE = {
  maThuoc: "",
  soLuong: "",
  lieuDung: "",
  tanSuat: "",
  soNgay: "",
  huongDan: "",
};

const KeDonThuocPage = () => {
  const [records, setRecords] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [examinations, setExaminations] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [selectedExaminationId, setSelectedExaminationId] = useState("");
  const [medicineForm, setMedicineForm] = useState(EMPTY_MEDICINE);
  const [medicineItems, setMedicineItems] = useState([]);
  const [generalInstructions, setGeneralInstructions] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingRecordData, setLoadingRecordData] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedRecord = useMemo(
    () => records.find((item) => item.recordId === selectedRecordId) || null,
    [records, selectedRecordId],
  );

  const selectedExamination = useMemo(
    () =>
      examinations.find(
        (item) => item.examinationId === selectedExaminationId,
      ) || null,
    [examinations, selectedExaminationId],
  );

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [recordItems, medicineItemsResult] = await Promise.all([
        getHoSoBenhAnChoBacSi(),
        getDanhSachThuoc(),
      ]);

      setRecords(recordItems);
      setMedicines(medicineItemsResult);
      setSelectedRecordId((current) => {
        if (current && recordItems.some((item) => item.recordId === current)) {
          return current;
        }
        return recordItems[0]?.recordId || "";
      });
    } catch (error) {
      setRecords([]);
      setMedicines([]);
      setSelectedRecordId("");
      toast.error(
        getApiErrorMessage(error, "Không thể tải dữ liệu kê đơn thuốc"),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRecordData = useCallback(async (record) => {
    if (!record) {
      setExaminations([]);
      setPrescriptions([]);
      setSelectedExaminationId("");
      return;
    }

    setLoadingRecordData(true);
    try {
      const [examItems, prescriptionItems] = await Promise.all([
        getPhieuKhamTheoHoSo(record),
        getDonThuocTheoHoSo(record),
      ]);

      setExaminations(examItems);
      setPrescriptions(prescriptionItems);
      setSelectedExaminationId((current) => {
        if (
          current &&
          examItems.some((item) => item.examinationId === current)
        ) {
          return current;
        }
        return examItems[0]?.examinationId || "";
      });
    } catch (error) {
      setExaminations([]);
      setPrescriptions([]);
      setSelectedExaminationId("");
      toast.error(
        getApiErrorMessage(
          error,
          "Không thể tải phiếu khám hoặc đơn thuốc của hồ sơ",
        ),
      );
    } finally {
      setLoadingRecordData(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    setMedicineItems([]);
    setMedicineForm(EMPTY_MEDICINE);
    setGeneralInstructions("");
    setSelectedExaminationId("");
    loadRecordData(selectedRecord);
  }, [selectedRecord, loadRecordData]);

  const handleMedicineChange = (event) => {
    const { name, value } = event.target;
    setMedicineForm((current) => ({ ...current, [name]: value }));
  };

  const addMedicine = () => {
    const selectedMedicine = medicines.find(
      (item) => item.medicineId === medicineForm.maThuoc,
    );

    if (!selectedMedicine) {
      toast.error("Vui lòng chọn thuốc");
      return;
    }

    const quantity = Number(medicineForm.soLuong);
    const durationDays = Number(medicineForm.soNgay);

    if (!Number.isInteger(quantity) || quantity <= 0) {
      toast.error("Số lượng thuốc phải là số nguyên lớn hơn 0");
      return;
    }
    if (!medicineForm.lieuDung.trim() || !medicineForm.tanSuat.trim()) {
      toast.error("Vui lòng nhập liều dùng và tần suất");
      return;
    }
    if (!Number.isInteger(durationDays) || durationDays <= 0) {
      toast.error("Số ngày sử dụng phải là số nguyên lớn hơn 0");
      return;
    }

    setMedicineItems((current) => [
      ...current,
      {
        medicineId: selectedMedicine.medicineId,
        medicineName: selectedMedicine.medicineName,
        quantity,
        dosage: medicineForm.lieuDung.trim(),
        frequency: medicineForm.tanSuat.trim(),
        durationDays,
        instructions: medicineForm.huongDan.trim(),
      },
    ]);
    setMedicineForm(EMPTY_MEDICINE);
  };

  const removeMedicine = (index) => {
    setMedicineItems((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const savePrescription = async () => {
    if (!selectedRecord) {
      toast.error("Vui lòng chọn hồ sơ bệnh án");
      return;
    }
    if (!selectedExamination) {
      toast.error("Vui lòng chọn phiếu khám cần kê đơn");
      return;
    }
    if (medicineItems.length === 0) {
      toast.error("Vui lòng thêm ít nhất một thuốc");
      return;
    }

    setSaving(true);
    try {
      await createDonThuocTheoPhieuKham({
        record: selectedRecord,
        examination: selectedExamination,
        medicineItems,
        generalInstructions,
      });

      toast.success("Đã kê đơn thuốc thành công");
      setMedicineItems([]);
      setMedicineForm(EMPTY_MEDICINE);
      setGeneralInstructions("");
      await loadRecordData(selectedRecord);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể tạo đơn thuốc"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        Đang tải dữ liệu kê đơn...
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Kê đơn thuốc</h1>
          <p className="mt-1 text-sm text-slate-500">
            Chọn hồ sơ bệnh án và đúng phiếu khám trước khi kê đơn.
          </p>
        </div>
        <button
          type="button"
          onClick={loadInitialData}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Tải lại dữ liệu
        </button>
      </div>

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Hồ sơ bệnh án
          </label>
          <select
            value={selectedRecordId}
            onChange={(event) => setSelectedRecordId(event.target.value)}
            disabled={records.length === 0}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100"
          >
            <option value="">-- Chọn hồ sơ --</option>
            {records.map((record) => (
              <option key={record.recordId} value={record.recordId}>
                {record.recordId} - {record.patientName || record.patientId}
              </option>
            ))}
          </select>
          {records.length === 0 && (
            <p className="mt-2 text-sm text-amber-700">
              Chưa có hồ sơ bệnh án để kê đơn.
            </p>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Phiếu khám
          </label>
          <select
            value={selectedExaminationId}
            onChange={(event) =>
              setSelectedExaminationId(event.target.value)
            }
            disabled={!selectedRecord || loadingRecordData}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100"
          >
            <option value="">
              {loadingRecordData
                ? "Đang tải phiếu khám..."
                : "-- Chọn phiếu khám --"}
            </option>
            {examinations.map((item) => (
              <option key={item.examinationId} value={item.examinationId}>
                {item.examinationId} - {item.diagnosis || "Chưa chẩn đoán"}
                {item.createdAt
                  ? ` - ${dayjs(item.createdAt).format("DD/MM/YYYY")}`
                  : ""}
              </option>
            ))}
          </select>
          {selectedRecord && !loadingRecordData && examinations.length === 0 && (
            <p className="mt-2 text-sm text-amber-700">
              Hồ sơ này chưa có phiếu khám. Hãy lập phiếu khám trước khi kê đơn.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-slate-800">
          Thêm thuốc vào đơn
        </h2>
        <div className="grid gap-3 md:grid-cols-6">
          <select
            name="maThuoc"
            value={medicineForm.maThuoc}
            onChange={handleMedicineChange}
            disabled={!selectedExamination || saving}
            className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2 disabled:bg-slate-100"
          >
            <option value="">-- Chọn thuốc --</option>
            {medicines.map((item) => (
              <option key={item.medicineId} value={item.medicineId}>
                {item.medicineName}
              </option>
            ))}
          </select>
          <input
            name="soLuong"
            type="number"
            min="1"
            value={medicineForm.soLuong}
            onChange={handleMedicineChange}
            disabled={!selectedExamination || saving}
            placeholder="Số lượng"
            className="rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100"
          />
          <input
            name="lieuDung"
            value={medicineForm.lieuDung}
            onChange={handleMedicineChange}
            disabled={!selectedExamination || saving}
            placeholder="Liều dùng"
            className="rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100"
          />
          <input
            name="tanSuat"
            value={medicineForm.tanSuat}
            onChange={handleMedicineChange}
            disabled={!selectedExamination || saving}
            placeholder="Tần suất"
            className="rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100"
          />
          <input
            name="soNgay"
            type="number"
            min="1"
            value={medicineForm.soNgay}
            onChange={handleMedicineChange}
            disabled={!selectedExamination || saving}
            placeholder="Số ngày"
            className="rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100"
          />
          <input
            name="huongDan"
            value={medicineForm.huongDan}
            onChange={handleMedicineChange}
            disabled={!selectedExamination || saving}
            placeholder="Hướng dẫn thêm"
            className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-5 disabled:bg-slate-100"
          />
          <button
            type="button"
            onClick={addMedicine}
            disabled={!selectedExamination || saving}
            className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:bg-slate-400"
          >
            Thêm thuốc
          </button>
        </div>
      </section>

      {medicineItems.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3">Thuốc</th>
                  <th className="px-4 py-3">Số lượng</th>
                  <th className="px-4 py-3">Liều dùng</th>
                  <th className="px-4 py-3">Tần suất</th>
                  <th className="px-4 py-3">Số ngày</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {medicineItems.map((item, index) => (
                  <tr key={`${item.medicineId}-${index}`} className="border-t">
                    <td className="px-4 py-3">{item.medicineName}</td>
                    <td className="px-4 py-3">{item.quantity}</td>
                    <td className="px-4 py-3">{item.dosage}</td>
                    <td className="px-4 py-3">{item.frequency}</td>
                    <td className="px-4 py-3">{item.durationDays}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => removeMedicine(index)}
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

          <div className="border-t p-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Hướng dẫn chung
            </label>
            <textarea
              value={generalInstructions}
              onChange={(event) => setGeneralInstructions(event.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={savePrescription}
                disabled={saving}
                className="rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-400"
              >
                {saving ? "Đang lưu..." : "Lưu đơn thuốc"}
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold text-slate-800">
            Đơn thuốc thuộc hồ sơ đang chọn
          </h2>
        </div>

        {!selectedRecord ? (
          <p className="p-6 text-center text-slate-500">
            Chọn hồ sơ bệnh án để xem đơn thuốc.
          </p>
        ) : loadingRecordData ? (
          <p className="p-6 text-center text-slate-500">
            Đang tải đơn thuốc...
          </p>
        ) : prescriptions.length === 0 ? (
          <p className="p-6 text-center text-slate-500">
            Chưa có đơn thuốc trong hồ sơ này.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3">Mã đơn</th>
                  <th className="px-4 py-3">Phiếu khám</th>
                  <th className="px-4 py-3">Ngày kê</th>
                  <th className="px-4 py-3">Số loại thuốc</th>
                </tr>
              </thead>
              <tbody>
                {prescriptions.map((item) => (
                  <tr key={item.prescriptionId} className="border-t">
                    <td className="px-4 py-3 font-mono text-xs">
                      {item.prescriptionId}
                    </td>
                    <td className="px-4 py-3">
                      {item.examinationId || "-"}
                    </td>
                    <td className="px-4 py-3">
                      {item.createdAt
                        ? dayjs(item.createdAt).format("DD/MM/YYYY HH:mm")
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {item.medicineItems.length}
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

export default KeDonThuocPage;
