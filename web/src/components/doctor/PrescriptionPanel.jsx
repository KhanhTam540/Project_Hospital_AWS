import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Pill, Plus, Save, Trash2 } from "lucide-react";
import axios from "../../api/axiosClient";

const PrescriptionPanel = ({ patient, maBS }) => {
  const [thuocs, setThuocs] = useState([]);
  const [items, setItems] = useState([]);
  const [maPK, setMaPK] = useState("");
  const [phieuList, setPhieuList] = useState([]);
  const [form, setForm] = useState({ maThuoc: "", tenThuoc: "", soLuong: "", lieuDung: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get("/thuoc").then((res) => setThuocs(res.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!maBS) return;
    axios
      .get(`/phieukham/bacsi/${maBS}`)
      .then((res) => setPhieuList(res.data.data || []))
      .catch(() => {});
  }, [maBS]);

  useEffect(() => {
    if (patient?.maPK) setMaPK(patient.maPK);
  }, [patient]);

  const handleMedChange = (e) => {
    const { name, value } = e.target;
    if (name === "maThuoc") {
      const t = thuocs.find((x) => x.maThuoc === value);
      setForm({ ...form, maThuoc: value, tenThuoc: t?.tenThuoc || "" });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const addItem = () => {
    if (!form.maThuoc || !form.soLuong || !form.lieuDung) {
      return toast.error("Chọn thuốc, số lượng và liều dùng");
    }
    setItems([...items, { ...form }]);
    setForm({ maThuoc: "", tenThuoc: "", soLuong: "", lieuDung: "" });
  };

  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!maPK) return toast.error("Chọn phiếu khám (tạo phiếu khám trước)");
    if (!items.length) return toast.error("Thêm ít nhất một thuốc");

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("maPK", maPK);
      fd.append("chiTietList", JSON.stringify(items));
      await axios.post("/donthuoc", fd);
      toast.success("Đã kê đơn thuốc điện tử");
      setItems([]);
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi kê đơn");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
      <h3 className="font-semibold text-orange-800 flex items-center gap-2 border-b border-gray-100 pb-3">
        <Pill size={18} /> Đơn thuốc điện tử
      </h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Phiếu khám (maPK)</label>
        <select
          value={maPK}
          onChange={(e) => setMaPK(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400"
        >
          <option value="">— Chọn phiếu khám —</option>
          {phieuList.map((p) => (
            <option key={p.maPK} value={p.maPK}>
              {p.maPK} — {p.chuanDoan?.slice(0, 40) || p.maBN}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Thuốc</label>
          <select
            name="maThuoc"
            value={form.maThuoc}
            onChange={handleMedChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">— Chọn thuốc —</option>
            {thuocs.map((t) => (
              <option key={t.maThuoc} value={t.maThuoc}>
                {t.tenThuoc}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Số lượng</label>
          <input
            name="soLuong"
            value={form.soLuong}
            onChange={handleMedChange}
            type="number"
            min="1"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Liều dùng</label>
          <input
            name="lieuDung"
            value={form.lieuDung}
            onChange={handleMedChange}
            placeholder="VD: 1 viên x 2 lần/ngày"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={addItem}
        className="flex items-center gap-1 text-sm text-orange-700 font-medium hover:underline"
      >
        <Plus size={14} /> Thêm vào đơn
      </button>

      {items.length > 0 && (
        <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg text-sm">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-center justify-between px-3 py-2">
              <span>
                <strong>{item.tenThuoc}</strong> × {item.soLuong} — {item.lieuDung}
              </span>
              <button type="button" onClick={() => removeItem(idx)} className="text-red-500 p-1">
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg"
      >
        <Save size={16} />
        {saving ? "Đang lưu..." : "Kê đơn thuốc"}
      </button>
    </div>
  );
};

export default PrescriptionPanel;
