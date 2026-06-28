import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Activity,
  Heart,
  Thermometer,
  Droplets,
  Wind,
  Scale,
  Ruler,
  Save,
  User,
  Stethoscope,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { getNurseQueue, saveVitals } from "../../../services/nhansu/YTa/vitalsService";

const EMPTY_VITALS = {
  nhietDo: "",
  huyetApTamThu: "",
  huyetApTamTruong: "",
  nhipTim: "",
  nhipTho: "",
  spo2: "",
  canNang: "",
  chieuCao: "",
  ghiChuDieuDuong: "",
};

const VitalInput = ({ label, name, value, onChange, unit, icon: Icon, min, max, step = "1" }) => (
  <div>
    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
      {Icon && <Icon size={14} className="text-emerald-600" />}
      {label}
      {unit && <span className="text-gray-400 font-normal">({unit})</span>}
    </label>
    <input
      type="number"
      name={name}
      value={value}
      onChange={onChange}
      min={min}
      max={max}
      step={step}
      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
      placeholder="—"
    />
  </div>
);

const NurseVitalsPage = () => {
  const [queue, setQueue] = useState([]);
  const [selected, setSelected] = useState(null);
  const [vitals, setVitals] = useState(EMPTY_VITALS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getNurseQueue();
      setQueue(res.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Không tải được danh sách bệnh nhân");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const selectPatient = (item) => {
    setSelected(item);
    const pk = item.phieuKham;
    if (pk) {
      setVitals({
        nhietDo: pk.nhietDo ?? "",
        huyetApTamThu: pk.huyetApTamThu ?? "",
        huyetApTamTruong: pk.huyetApTamTruong ?? "",
        nhipTim: pk.nhipTim ?? "",
        nhipTho: pk.nhipTho ?? "",
        spo2: pk.spo2 ?? "",
        canNang: pk.canNang ?? "",
        chieuCao: pk.chieuCao ?? "",
        ghiChuDieuDuong: pk.ghiChuDieuDuong ?? "",
      });
    } else {
      setVitals(EMPTY_VITALS);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setVitals((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selected) {
      toast.error("Vui lòng chọn bệnh nhân");
      return;
    }

    setSaving(true);
    try {
      await saveVitals({
        maBN: selected.maBN,
        maHSBA: selected.maHSBA,
        maBS: selected.maBS,
        maPK: selected.phieuKham?.maPK,
        ...vitals,
      });
      toast.success("Đã lưu sinh hiệu vào phiếu khám");
      await loadQueue();
      const updated = queue.find((q) => q.maBN === selected.maBN);
      if (updated) selectPatient({ ...updated, daDoSinhHieu: true });
    } catch (err) {
      toast.error(err.response?.data?.message || "Lưu sinh hiệu thất bại");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg">
            <Activity size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Ghi sinh hiệu bệnh nhân</h1>
            <p className="text-sm text-gray-500">Điều dưỡng · Cập nhật vào phiếu khám (PhieuKham)</p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadQueue}
          className="text-sm text-emerald-700 font-medium hover:underline"
        >
          Làm mới danh sách
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Patient queue */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-emerald-50">
            <h2 className="font-semibold text-emerald-800 flex items-center gap-2">
              <User size={18} /> Danh sách hôm nay
            </h2>
          </div>
          <div className="max-h-[520px] overflow-y-auto divide-y divide-gray-100">
            {loading ? (
              <div className="p-8 text-center text-gray-400 text-sm">Đang tải...</div>
            ) : queue.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">Không có bệnh nhân</div>
            ) : (
              queue.map((item) => (
                <button
                  key={`${item.maBN}-${item.maLich || "hs"}`}
                  type="button"
                  onClick={() => selectPatient(item)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                    selected?.maBN === item.maBN ? "bg-emerald-50 border-l-4 border-emerald-500" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-800">{item.hoTenBN || item.maBN}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {item.hoTenBS ? `BS. ${item.hoTenBS}` : "Chưa có BS"}
                        {item.gioKham && ` · ${item.gioKham}`}
                      </p>
                      <p className="text-xs text-gray-400">HSBA: {item.maHSBA}</p>
                    </div>
                    {item.daDoSinhHieu ? (
                      <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-1" />
                    ) : (
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full shrink-0">
                        Chưa đo
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Vitals form */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          {!selected ? (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-400">
              <Stethoscope size={48} className="mb-3 opacity-40" />
              <p>Chọn bệnh nhân bên trái để ghi sinh hiệu</p>
            </div>
          ) : (
            <>
              <div className="mb-6 pb-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">{selected.hoTenBN}</h2>
                <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-500">
                  <span>Mã BN: {selected.maBN}</span>
                  {selected.maHSBA && <span>HSBA: {selected.maHSBA}</span>}
                  {selected.phieuKham?.maPK && (
                    <span>Phiếu: {selected.phieuKham.maPK}</span>
                  )}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <VitalInput
                    label="Nhiệt độ"
                    name="nhietDo"
                    value={vitals.nhietDo}
                    onChange={handleChange}
                    unit="°C"
                    icon={Thermometer}
                    min={34}
                    max={42}
                    step="0.1"
                  />
                  <VitalInput
                    label="SpO₂"
                    name="spo2"
                    value={vitals.spo2}
                    onChange={handleChange}
                    unit="%"
                    icon={Droplets}
                    min={70}
                    max={100}
                    step="0.1"
                  />
                  <VitalInput
                    label="Huyết áp tâm thu"
                    name="huyetApTamThu"
                    value={vitals.huyetApTamThu}
                    onChange={handleChange}
                    unit="mmHg"
                    icon={Activity}
                    min={60}
                    max={250}
                  />
                  <VitalInput
                    label="Huyết áp tâm trương"
                    name="huyetApTamTruong"
                    value={vitals.huyetApTamTruong}
                    onChange={handleChange}
                    unit="mmHg"
                    icon={Activity}
                    min={40}
                    max={150}
                  />
                  <VitalInput
                    label="Nhịp tim"
                    name="nhipTim"
                    value={vitals.nhipTim}
                    onChange={handleChange}
                    unit="bpm"
                    icon={Heart}
                    min={40}
                    max={200}
                  />
                  <VitalInput
                    label="Nhịp thở"
                    name="nhipTho"
                    value={vitals.nhipTho}
                    onChange={handleChange}
                    unit="/phút"
                    icon={Wind}
                    min={8}
                    max={40}
                  />
                  <VitalInput
                    label="Cân nặng"
                    name="canNang"
                    value={vitals.canNang}
                    onChange={handleChange}
                    unit="kg"
                    icon={Scale}
                    min={1}
                    max={300}
                    step="0.1"
                  />
                  <VitalInput
                    label="Chiều cao"
                    name="chieuCao"
                    value={vitals.chieuCao}
                    onChange={handleChange}
                    unit="cm"
                    icon={Ruler}
                    min={30}
                    max={250}
                    step="0.1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Ghi chú điều dưỡng
                  </label>
                  <textarea
                    name="ghiChuDieuDuong"
                    value={vitals.ghiChuDieuDuong}
                    onChange={handleChange}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500"
                    placeholder="Triệu chứng ban đầu, tình trạng tỉnh táo, v.v."
                  />
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Clock size={12} />
                  Dữ liệu lưu vào bảng PhieuKham · trạng thái DA_DO_SINH_HIEU
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold py-3 rounded-lg shadow-md transition-colors"
                >
                  <Save size={18} />
                  {saving ? "Đang lưu..." : "Lưu sinh hiệu"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default NurseVitalsPage;
