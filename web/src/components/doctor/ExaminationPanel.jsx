import React, { useState } from "react";
import toast from "react-hot-toast";
import { FileText, Save } from "lucide-react";
import axios from "../../api/axiosClient";

const ExaminationPanel = ({ patient, maBS, onSaved, onComplete }) => {
  const [form, setForm] = useState({
    trieuChung: "",
    chuanDoan: "",
    loiDan: "",
  });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!patient) return toast.error("Chọn bệnh nhân từ hàng chờ");
    if (!form.trieuChung || !form.chuanDoan) {
      return toast.error("Vui lòng nhập triệu chứng và chẩn đoán");
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("maHSBA", patient.maHSBA);
      fd.append("maBN", patient.maBN);
      fd.append("maBS", maBS);
      fd.append("trieuChung", form.trieuChung);
      fd.append("chuanDoan", form.chuanDoan);
      fd.append("loiDan", form.loiDan || "");
      if (file) fd.append("file", file);

      await axios.post("/phieukham", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Đã lưu phiếu khám");
      setForm({ trieuChung: "", chuanDoan: "", loiDan: "" });
      setFile(null);
      onSaved?.();
      if (patient.maLich) onComplete?.(patient);
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi lưu phiếu khám");
    } finally {
      setSaving(false);
    }
  };

  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-gray-400 bg-white rounded-xl border border-gray-200">
        <FileText size={40} className="mb-2 opacity-40" />
        <p className="text-sm">Chọn bệnh nhân để khám</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4"
    >
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <h3 className="font-semibold text-blue-800 flex items-center gap-2">
          <FileText size={18} /> Phiếu khám — {patient.hoTenBN}
        </h3>
        {patient.vitals && (
          <span className="text-xs text-gray-500">
            🌡 {patient.vitals.nhietDo ?? "—"}°C · ❤ {patient.vitals.nhipTim ?? "—"}
          </span>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Triệu chứng *</label>
        <textarea
          name="trieuChung"
          value={form.trieuChung}
          onChange={handleChange}
          rows={3}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400"
          placeholder="Mô tả triệu chứng lâm sàng..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Chẩn đoán *</label>
        <textarea
          name="chuanDoan"
          value={form.chuanDoan}
          onChange={handleChange}
          rows={2}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400"
          placeholder="Chẩn đoán chính..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Lời dặn</label>
        <textarea
          name="loiDan"
          value={form.loiDan}
          onChange={handleChange}
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400"
          placeholder="Hướng dẫn điều trị, tái khám..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Đính kèm (tuỳ chọn)</label>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700"
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg"
      >
        <Save size={16} />
        {saving ? "Đang lưu..." : "Lưu phiếu khám"}
      </button>
    </form>
  );
};

export default ExaminationPanel;
