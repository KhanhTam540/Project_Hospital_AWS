import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Stethoscope } from "lucide-react";
import axios from "../../../api/axiosClient";
import useDoctorQueueSSE from "../../../hooks/useDoctorQueueSSE";
import { callNextPatient, completePatient } from "../../../services/bacsi/queueService";
import QueuePanel from "../../../components/doctor/QueuePanel";
import ExaminationPanel from "../../../components/doctor/ExaminationPanel";
import PrescriptionPanel from "../../../components/doctor/PrescriptionPanel";
import MedicalScanUploader from "../../../components/upload/MedicalScanUploader";
import SecureScanGallery from "../../../components/scans/SecureScanGallery";

const DoctorQueuePage = () => {
  const [maBS, setMaBS] = useState(localStorage.getItem("maBS") || "");
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState("exam");

  const { queue, connected, useRedis, loading, refresh } = useDoctorQueueSSE(maBS);

  useEffect(() => {
    const load = async () => {
      const maTK = localStorage.getItem("maTK");
      if (!maTK) return;
      try {
        const res = await axios.get(`/bacsi/maTK/${maTK}`);
        const bs = res.data.data?.maBS || res.data.maBS;
        if (bs) {
          setMaBS(bs);
          localStorage.setItem("maBS", bs);
        }
      } catch {
        /* use cached maBS */
      }
    };
    if (!maBS) load();
  }, [maBS]);

  const handleCallNext = async () => {
    try {
      const res = await callNextPatient(selected?.maLich);
      const called = res.data.data;
      setSelected(called);
      toast.success(`Đã gọi: ${called.hoTenBN} (#${called.sequence})`);
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không gọi được bệnh nhân");
    }
  };

  const handleComplete = async (patient) => {
    if (!patient?.maLich || !maBS) return;
    try {
      await completePatient(maBS, patient.maLich);
      toast.success("Hoàn thành khám");
      setSelected(null);
      refresh();
    } catch {
      toast.error("Lỗi cập nhật trạng thái");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg">
            <Stethoscope size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Phòng khám — Hàng chờ realtime</h1>
            <p className="text-sm text-gray-500">
              SSE {useRedis ? "+ Redis" : "(in-memory dev)"} · Mã BS: {maBS || "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-4">
          <QueuePanel
            queue={queue}
            selected={selected}
            onSelect={setSelected}
            onCallNext={handleCallNext}
            connected={connected}
            useRedis={useRedis}
            loading={loading}
          />
        </div>

        <div className="xl:col-span-8 space-y-4">
          <div className="flex gap-2 border-b border-gray-200">
            {[
              { id: "exam", label: "Khám & chẩn đoán" },
              { id: "rx", label: "Kê đơn thuốc" },
              { id: "scans", label: "Phim chẩn đoán" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "exam" ? (
            <ExaminationPanel
              patient={selected}
              maBS={maBS}
              onSaved={refresh}
              onComplete={handleComplete}
            />
          ) : activeTab === "rx" ? (
            <PrescriptionPanel patient={selected} maBS={maBS} />
          ) : (
            <div className="space-y-6">
              {selected ? (
                <>
                  <SecureScanGallery maBN={selected.maBN} patientName={selected.hoTenBN} />
                  <div className="border-t border-gray-200 pt-6">
                    <MedicalScanUploader
                      onUploadComplete={(results) => {
                        console.log("[MedicalScanUploader] mock S3 results:", results);
                      }}
                    />
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-400 text-center py-12">
                  Chọn bệnh nhân từ hàng chờ để xem / tải phim X-quang / MRI
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DoctorQueuePage;
