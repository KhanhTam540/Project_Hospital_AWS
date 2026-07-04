import React, { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import toast from "react-hot-toast";

import {
  createPhieuKhamTheoHoSo,
  getHoSoBenhAnChoBacSi,
  getPhieuKhamTheoHoSo,
} from "../../../services/kham/phieukhamService";
import { getApiErrorMessage } from "../../../utils/apiResponse";

const EMPTY_FORM = {
  trieuChung: "",
  chuanDoan: "",
  dieuTri: "",
  loiDan: "",
};

const PhieuKhamPage = () => {
  const [records, setRecords] = useState([]);
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [examinations, setExaminations] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [loadingExaminations, setLoadingExaminations] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedRecord = useMemo(
    () => records.find((item) => item.recordId === selectedRecordId) || null,
    [records, selectedRecordId],
  );

  const loadRecords = useCallback(async () => {
    setLoadingRecords(true);
    try {
      const items = await getHoSoBenhAnChoBacSi();
      setRecords(items);
      setSelectedRecordId((current) => {
        if (current && items.some((item) => item.recordId === current)) {
          return current;
        }
        return items[0]?.recordId || "";
      });
    } catch (error) {
      setRecords([]);
      setSelectedRecordId("");
      toast.error(
        getApiErrorMessage(error, "Không thể tải danh sách hồ sơ bệnh án"),
      );
    } finally {
      setLoadingRecords(false);
    }
  }, []);

  const loadExaminations = useCallback(async (record) => {
    if (!record) {
      setExaminations([]);
      return;
    }

    setLoadingExaminations(true);
    try {
      const items = await getPhieuKhamTheoHoSo(record);
      setExaminations(items);
    } catch (error) {
      setExaminations([]);
      toast.error(
        getApiErrorMessage(
          error,
          "Không thể tải danh sách phiếu khám của hồ sơ đã chọn",
        ),
      );
    } finally {
      setLoadingExaminations(false);
    }
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    setForm(EMPTY_FORM);
    loadExaminations(selectedRecord);
  }, [selectedRecord, loadExaminations]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

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
      await createPhieuKhamTheoHoSo(selectedRecord, {
        symptoms: form.trieuChung,
        diagnosis: form.chuanDoan,
        treatment: form.dieuTri,
        advice: form.loiDan,
      });

      toast.success("Đã lập phiếu khám thành công");
      setForm(EMPTY_FORM);
      await loadExaminations(selectedRecord);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể lập phiếu khám"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Lập phiếu khám bệnh
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Chọn hồ sơ bệnh án trước khi nhập thông tin khám.
          </p>
        </div>
        <button
          type="button"
          onClick={loadRecords}
          disabled={loadingRecords}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Tải lại hồ sơ
        </button>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="mb-2 block text-sm font-semibold text-slate-700">
          Hồ sơ bệnh án
        </label>
        <select
          value={selectedRecordId}
          onChange={(event) => setSelectedRecordId(event.target.value)}
          disabled={loadingRecords || records.length === 0}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100"
        >
          <option value="">
            {loadingRecords
              ? "Đang tải hồ sơ..."
              : "-- Chọn hồ sơ bệnh án --"}
          </option>
          {records.map((record) => (
            <option key={record.recordId} value={record.recordId}>
              {record.recordId} - {record.patientName || record.patientId}
            </option>
          ))}
        </select>

        {!loadingRecords && records.length === 0 && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Chưa có hồ sơ bệnh án. Nhân viên tiếp nhận hoặc bác sĩ cần tạo hồ sơ
            trước khi lập phiếu khám.
          </p>
        )}

        {selectedRecord && (
          <div className="mt-4 grid gap-3 rounded-lg bg-slate-50 p-4 text-sm md:grid-cols-3">
            <div>
              <span className="text-slate-500">Mã hồ sơ</span>
              <p className="font-semibold text-slate-800">
                {selectedRecord.recordId}
              </p>
            </div>
            <div>
              <span className="text-slate-500">Bệnh nhân</span>
              <p className="font-semibold text-slate-800">
                {selectedRecord.patientName || selectedRecord.patientId}
              </p>
            </div>
            <div>
              <span className="text-slate-500">Mã bệnh nhân</span>
              <p className="font-semibold text-slate-800">
                {selectedRecord.patientId}
              </p>
            </div>
          </div>
        )}
      </section>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Triệu chứng <span className="text-red-500">*</span>
            </label>
            <textarea
              name="trieuChung"
              value={form.trieuChung}
              onChange={handleChange}
              rows={3}
              disabled={!selectedRecord || saving}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100"
              placeholder="Nhập triệu chứng của bệnh nhân"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Chẩn đoán <span className="text-red-500">*</span>
            </label>
            <textarea
              name="chuanDoan"
              value={form.chuanDoan}
              onChange={handleChange}
              rows={3}
              disabled={!selectedRecord || saving}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100"
              placeholder="Nhập chẩn đoán"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Điều trị
            </label>
            <textarea
              name="dieuTri"
              value={form.dieuTri}
              onChange={handleChange}
              rows={3}
              disabled={!selectedRecord || saving}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100"
              placeholder="Nhập hướng điều trị"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Lời dặn
            </label>
            <textarea
              name="loiDan"
              value={form.loiDan}
              onChange={handleChange}
              rows={2}
              disabled={!selectedRecord || saving}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100"
              placeholder="Nhập lời dặn dành cho bệnh nhân"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={!selectedRecord || saving}
            className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {saving ? "Đang lưu..." : "Lập phiếu khám"}
          </button>
        </div>
      </form>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-800">
            Phiếu khám thuộc hồ sơ đang chọn
          </h2>
        </div>

        {!selectedRecord ? (
          <p className="p-6 text-center text-slate-500">
            Chọn hồ sơ bệnh án để xem danh sách phiếu khám.
          </p>
        ) : loadingExaminations ? (
          <p className="p-6 text-center text-slate-500">
            Đang tải phiếu khám...
          </p>
        ) : examinations.length === 0 ? (
          <p className="p-6 text-center text-slate-500">
            Hồ sơ này chưa có phiếu khám.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3">Mã phiếu</th>
                  <th className="px-4 py-3">Ngày khám</th>
                  <th className="px-4 py-3">Triệu chứng</th>
                  <th className="px-4 py-3">Chẩn đoán</th>
                  <th className="px-4 py-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {examinations.map((item) => (
                  <tr
                    key={item.examinationId}
                    className="border-t border-slate-100"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      {item.examinationId}
                    </td>
                    <td className="px-4 py-3">
                      {item.createdAt
                        ? dayjs(item.createdAt).format("DD/MM/YYYY HH:mm")
                        : "-"}
                    </td>
                    <td className="max-w-xs px-4 py-3">
                      {item.symptoms || "-"}
                    </td>
                    <td className="max-w-xs px-4 py-3">
                      {item.diagnosis || "-"}
                    </td>
                    <td className="px-4 py-3">{item.status || "-"}</td>
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

export default PhieuKhamPage;
