import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Pill, Plus, Save, Trash2 } from "lucide-react";

import {
  createPrescriptionForExamination,
  getDoctorMedicalRecords,
  getExaminationsByRecord,
  getMedicines,
} from "../../services/bacsi/doctorWorkflowService";
import { getApiErrorMessage } from "../../utils/apiResponse";
import MedicalRecordSearchSelect from "./MedicalRecordSearchSelect";

const EMPTY_MEDICINE = {
  medicineId: "",
  medicineName: "",
  quantity: "",
  dosage: "",
  frequency: "",
  durationDays: "",
  instructions: "",
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

const getPreferredExaminationId = (patient) =>
  text(patient?.examinationId || patient?.maPK);

const PrescriptionPanel = ({ patient, onSaved }) => {
  const [records, setRecords] = useState([]);
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [examinations, setExaminations] = useState([]);
  const [selectedExaminationId, setSelectedExaminationId] = useState("");
  const [medicines, setMedicines] = useState([]);
  const [medicineForm, setMedicineForm] = useState(EMPTY_MEDICINE);
  const [items, setItems] = useState([]);
  const [generalInstructions, setGeneralInstructions] = useState("");
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [loadingExaminations, setLoadingExaminations] = useState(false);
  const [saving, setSaving] = useState(false);

  const patientId = useMemo(() => getPatientId(patient), [patient]);

  const selectedRecord = useMemo(
    () =>
      records.find((item) => item.recordId === selectedRecordId) ||
      null,
    [records, selectedRecordId],
  );

  const selectedExamination = useMemo(
    () =>
      examinations.find(
        (item) => item.examinationId === selectedExaminationId,
      ) || null,
    [examinations, selectedExaminationId],
  );

  useEffect(() => {
    let active = true;

    const loadMedicines = async () => {
      try {
        const list = await getMedicines();
        if (active) setMedicines(list);
      } catch (error) {
        if (active) {
          toast.error(
            getApiErrorMessage(error, "Không thể tải danh sách thuốc"),
          );
        }
      }
    };

    loadMedicines();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadRecords = async () => {
      setRecords([]);
      setSelectedRecordId("");
      setExaminations([]);
      setSelectedExaminationId("");
      setItems([]);

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
        if (active) {
          toast.error(
            getApiErrorMessage(
              error,
              "Không thể tải hồ sơ bệnh án của bệnh nhân",
            ),
          );
        }
      } finally {
        if (active) setLoadingRecords(false);
      }
    };

    loadRecords();
    return () => {
      active = false;
    };
  }, [patientId, patient]);

  useEffect(() => {
    let active = true;

    const loadExaminations = async () => {
      setExaminations([]);
      setSelectedExaminationId("");
      setItems([]);

      if (!selectedRecord) return;

      setLoadingExaminations(true);
      try {
        const list = await getExaminationsByRecord(selectedRecord);
        if (!active) return;

        const preferredExaminationId = getPreferredExaminationId(patient);
        const nextExaminationId =
          list.find(
            (item) =>
              sameId(item.examinationId, preferredExaminationId),
          )?.examinationId ||
          list[0]?.examinationId ||
          "";

        setExaminations(list);
        setSelectedExaminationId(nextExaminationId);
      } catch (error) {
        if (active) {
          toast.error(
            getApiErrorMessage(
              error,
              "Không thể tải phiếu khám của hồ sơ",
            ),
          );
        }
      } finally {
        if (active) setLoadingExaminations(false);
      }
    };

    loadExaminations();
    return () => {
      active = false;
    };
  }, [selectedRecordId, selectedRecord, patient]);

  const handleMedicineChange = (event) => {
    const { name, value } = event.target;

    if (name === "medicineId") {
      const medicine = medicines.find(
        (item) => item.medicineId === value,
      );
      setMedicineForm((current) => ({
        ...current,
        medicineId: value,
        medicineName: medicine?.medicineName || "",
      }));
      return;
    }

    setMedicineForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const addItem = () => {
    const quantity = Number(medicineForm.quantity);
    const durationDays = Number(medicineForm.durationDays);

    if (!selectedExamination) {
      toast.error("Vui lòng chọn phiếu khám");
      return;
    }
    if (
      !medicineForm.medicineId ||
      !Number.isInteger(quantity) ||
      quantity <= 0 ||
      !medicineForm.dosage.trim() ||
      !medicineForm.frequency.trim() ||
      !Number.isInteger(durationDays) ||
      durationDays <= 0
    ) {
      toast.error(
        "Vui lòng nhập đủ thuốc, số lượng, liều dùng, tần suất và số ngày",
      );
      return;
    }

    setItems((current) => [
      ...current,
      {
        medicineId: medicineForm.medicineId,
        medicineName: medicineForm.medicineName,
        quantity,
        dosage: medicineForm.dosage.trim(),
        frequency: medicineForm.frequency.trim(),
        durationDays,
        instructions: medicineForm.instructions.trim(),
      },
    ]);
    setMedicineForm(EMPTY_MEDICINE);
  };

  const removeItem = (index) => {
    setItems((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const handleSubmit = async () => {
    if (!selectedRecord) {
      toast.error("Vui lòng chọn hồ sơ bệnh án");
      return;
    }
    if (!selectedExamination) {
      toast.error("Vui lòng chọn phiếu khám");
      return;
    }
    if (items.length === 0) {
      toast.error("Vui lòng thêm ít nhất một thuốc");
      return;
    }

    setSaving(true);
    try {
      const created = await createPrescriptionForExamination({
        record: selectedRecord,
        examination: selectedExamination,
        medicineItems: items,
        generalInstructions,
      });
      toast.success("Đã kê đơn thuốc điện tử");
      setItems([]);
      setGeneralInstructions("");
      onSaved?.(created);
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "Không thể tạo đơn thuốc"),
      );
    } finally {
      setSaving(false);
    }
  };

  if (!patient) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400">
        <Pill size={40} className="mb-2 opacity-40" />
        <p className="text-sm">Chọn bệnh nhân để kê đơn</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="flex items-center gap-2 border-b border-gray-100 pb-3 font-semibold text-orange-800">
        <Pill size={18} /> Đơn thuốc điện tử — {patient.hoTenBN || patient.fullName || patientId}
      </h3>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <MedicalRecordSearchSelect
            records={records}
            value={selectedRecordId}
            onChange={(recordId) => setSelectedRecordId(recordId)}
            loading={loadingRecords}
            disabled={loadingRecords || saving}
            label="Tra cứu hồ sơ bằng CCCD *"
            placeholder="Nhập đúng 12 số CCCD của bệnh nhân"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Phiếu khám <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedExaminationId}
            onChange={(event) =>
              setSelectedExaminationId(event.target.value)
            }
            disabled={
              !selectedRecord ||
              loadingExaminations ||
              examinations.length === 0 ||
              saving
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 disabled:bg-gray-100"
          >
            <option value="">
              {loadingExaminations
                ? "Đang tải phiếu khám..."
                : "— Chọn phiếu khám —"}
            </option>
            {examinations.map((item) => (
              <option
                key={item.examinationId}
                value={item.examinationId}
              >
                {item.examinationId} — {item.diagnosis || "Chưa chẩn đoán"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!loadingRecords && records.length === 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Bệnh nhân này chưa có hồ sơ bệnh án.
        </p>
      )}
      {selectedRecord && !loadingExaminations && examinations.length === 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Hồ sơ này chưa có phiếu khám. Hãy lưu phiếu khám trước rồi chuyển lại tab kê đơn.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="sm:col-span-2 lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Thuốc
          </label>
          <select
            name="medicineId"
            value={medicineForm.medicineId}
            onChange={handleMedicineChange}
            disabled={!selectedExamination || saving}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
          >
            <option value="">— Chọn thuốc —</option>
            {medicines.map((medicine) => (
              <option
                key={medicine.medicineId}
                value={medicine.medicineId}
              >
                {medicine.medicineName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Số lượng
          </label>
          <input
            name="quantity"
            value={medicineForm.quantity}
            onChange={handleMedicineChange}
            type="number"
            min="1"
            disabled={!selectedExamination || saving}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Liều dùng
          </label>
          <input
            name="dosage"
            value={medicineForm.dosage}
            onChange={handleMedicineChange}
            placeholder="1 viên"
            disabled={!selectedExamination || saving}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Tần suất
          </label>
          <input
            name="frequency"
            value={medicineForm.frequency}
            onChange={handleMedicineChange}
            placeholder="2 lần/ngày"
            disabled={!selectedExamination || saving}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Số ngày
          </label>
          <input
            name="durationDays"
            value={medicineForm.durationDays}
            onChange={handleMedicineChange}
            type="number"
            min="1"
            disabled={!selectedExamination || saving}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
          />
        </div>

        <div className="sm:col-span-2 lg:col-span-5">
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Hướng dẫn thêm
          </label>
          <input
            name="instructions"
            value={medicineForm.instructions}
            onChange={handleMedicineChange}
            placeholder="Uống sau ăn..."
            disabled={!selectedExamination || saving}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
          />
        </div>

        <button
          type="button"
          onClick={addItem}
          disabled={!selectedExamination || saving}
          className="flex items-center justify-center gap-1 rounded-lg bg-orange-100 px-3 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-200 disabled:opacity-50"
        >
          <Plus size={14} /> Thêm thuốc
        </button>
      </div>

      {items.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-100">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-3 py-2">Thuốc</th>
                <th className="px-3 py-2">SL</th>
                <th className="px-3 py-2">Liều</th>
                <th className="px-3 py-2">Tần suất</th>
                <th className="px-3 py-2">Ngày</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={`${item.medicineId}-${index}`} className="border-t">
                  <td className="px-3 py-2 font-medium">
                    {item.medicineName}
                  </td>
                  <td className="px-3 py-2">{item.quantity}</td>
                  <td className="px-3 py-2">{item.dosage}</td>
                  <td className="px-3 py-2">{item.frequency}</td>
                  <td className="px-3 py-2">{item.durationDays}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-red-500"
                      aria-label={`Xóa ${item.medicineName}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Hướng dẫn chung
        </label>
        <textarea
          value={generalInstructions}
          onChange={(event) =>
            setGeneralInstructions(event.target.value)
          }
          rows={2}
          disabled={!selectedExamination || saving}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100"
          placeholder="Lời dặn chung cho đơn thuốc..."
        />
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={
          !selectedExamination || items.length === 0 || saving
        }
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-2.5 font-semibold text-white hover:bg-green-700 disabled:opacity-60"
      >
        <Save size={16} />
        {saving ? "Đang lưu..." : "Kê đơn thuốc"}
      </button>
    </div>
  );
};

export default PrescriptionPanel;
