import React, { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import toast from "react-hot-toast";

import {
  createYeuCauTheoHoSo,
  getDanhMucXetNghiem,
  getHoSoBenhAnChoBacSi,
  getYeuCauTheoHoSo,
} from "../../../services/xetnghiem/yeucauxetnghiemService";
import { getApiErrorMessage } from "../../../utils/apiResponse";

const EMPTY_FORM = {
  maXN: "",
  priority: "NORMAL",
  ghiChu: "",
};

const QuanLyYeuCauXNPage = () => {
  const [records, setRecords] = useState([]);
  const [labTests, setLabTests] = useState([]);
  const [requests, setRequests] = useState([]);
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedRecord = useMemo(
    () => records.find((item) => item.recordId === selectedRecordId) || null,
    [records, selectedRecordId],
  );

  const labTestMap = useMemo(
    () => new Map(labTests.map((item) => [item.labTestId, item])),
    [labTests],
  );

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [recordItems, testItems] = await Promise.all([
        getHoSoBenhAnChoBacSi(),
        getDanhMucXetNghiem(),
      ]);

      setRecords(recordItems);
      setLabTests(testItems);
      setSelectedRecordId((current) => {
        if (current && recordItems.some((item) => item.recordId === current)) {
          return current;
        }
        return recordItems[0]?.recordId || "";
      });
    } catch (error) {
      setRecords([]);
      setLabTests([]);
      setSelectedRecordId("");
      toast.error(
        getApiErrorMessage(
          error,
          "Không thể tải hồ sơ bệnh án hoặc danh mục xét nghiệm",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRequests = useCallback(async (record) => {
    if (!record) {
      setRequests([]);
      return;
    }

    setLoadingRequests(true);
    try {
      setRequests(await getYeuCauTheoHoSo(record));
    } catch (error) {
      setRequests([]);
      toast.error(
        getApiErrorMessage(
          error,
          "Không thể tải yêu cầu xét nghiệm của hồ sơ đã chọn",
        ),
      );
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    setForm(EMPTY_FORM);
    loadRequests(selectedRecord);
  }, [selectedRecord, loadRequests]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();

    if (!selectedRecord) {
      toast.error("Vui lòng chọn hồ sơ bệnh án");
      return;
    }
    if (!form.maXN) {
      toast.error("Vui lòng chọn xét nghiệm");
      return;
    }

    setSaving(true);
    try {
      await createYeuCauTheoHoSo({
        record: selectedRecord,
        labTestId: form.maXN,
        priority: form.priority,
        note: form.ghiChu,
      });

      toast.success("Đã tạo yêu cầu xét nghiệm");
      setForm(EMPTY_FORM);
      await loadRequests(selectedRecord);
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "Không thể tạo yêu cầu xét nghiệm"),
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        Đang tải dữ liệu xét nghiệm...
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Yêu cầu xét nghiệm
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Mỗi yêu cầu được gắn với một hồ sơ bệnh án và một xét nghiệm cụ thể.
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

      <form
        onSubmit={handleCreate}
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-2">
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
                Chưa có hồ sơ bệnh án để lập yêu cầu xét nghiệm.
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Xét nghiệm
            </label>
            <select
              name="maXN"
              value={form.maXN}
              onChange={handleChange}
              disabled={!selectedRecord || labTests.length === 0}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100"
            >
              <option value="">-- Chọn xét nghiệm --</option>
              {labTests.map((item) => (
                <option key={item.labTestId} value={item.labTestId}>
                  {item.testName || item.labTestId}
                </option>
              ))}
            </select>
            {labTests.length === 0 && (
              <p className="mt-2 text-sm text-amber-700">
                Danh mục xét nghiệm đang trống. Quản trị viên cần tạo xét nghiệm trước.
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Mức độ ưu tiên
            </label>
            <select
              name="priority"
              value={form.priority}
              onChange={handleChange}
              disabled={!selectedRecord}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
            >
              <option value="NORMAL">Thông thường</option>
              <option value="URGENT">Khẩn</option>
              <option value="EMERGENCY">Cấp cứu</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Ghi chú
            </label>
            <input
              name="ghiChu"
              value={form.ghiChu}
              onChange={handleChange}
              disabled={!selectedRecord}
              placeholder="Chỉ định hoặc lưu ý cho phòng xét nghiệm"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
            />
          </div>
        </div>

        {selectedRecord && (
          <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
            <strong>Bệnh nhân:</strong>{" "}
            {selectedRecord.patientName || selectedRecord.patientId}
            <span className="mx-2 text-slate-300">|</span>
            <strong>Mã hồ sơ:</strong> {selectedRecord.recordId}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={!selectedRecord || !form.maXN || saving}
            className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {saving ? "Đang tạo..." : "Tạo yêu cầu xét nghiệm"}
          </button>
        </div>
      </form>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-800">
            Yêu cầu của hồ sơ đang chọn
          </h2>
        </div>

        {!selectedRecord ? (
          <p className="p-6 text-center text-slate-500">
            Chọn hồ sơ bệnh án để xem yêu cầu xét nghiệm.
          </p>
        ) : loadingRequests ? (
          <p className="p-6 text-center text-slate-500">
            Đang tải yêu cầu xét nghiệm...
          </p>
        ) : requests.length === 0 ? (
          <p className="p-6 text-center text-slate-500">
            Hồ sơ này chưa có yêu cầu xét nghiệm.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3">Mã yêu cầu</th>
                  <th className="px-4 py-3">Hồ sơ</th>
                  <th className="px-4 py-3">Xét nghiệm</th>
                  <th className="px-4 py-3">Ưu tiên</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Ngày yêu cầu</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((item) => (
                  <tr key={item.labRequestId} className="border-t">
                    <td className="px-4 py-3 font-mono text-xs">
                      {item.labRequestId}
                    </td>
                    <td className="px-4 py-3">{item.recordId || "-"}</td>
                    <td className="px-4 py-3">
                      {labTestMap.get(item.labTestId)?.testName ||
                        item.labTestId ||
                        "-"}
                    </td>
                    <td className="px-4 py-3">
                      {item.priority || "NORMAL"}
                    </td>
                    <td className="px-4 py-3">{item.status || "-"}</td>
                    <td className="px-4 py-3">
                      {item.requestedAt
                        ? dayjs(item.requestedAt).format("DD/MM/YYYY HH:mm")
                        : "-"}
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

export default QuanLyYeuCauXNPage;
