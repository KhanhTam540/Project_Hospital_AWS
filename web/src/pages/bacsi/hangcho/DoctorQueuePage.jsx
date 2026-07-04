import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Stethoscope } from "lucide-react";

import useDoctorQueueSSE from "../../../hooks/useDoctorQueueSSE";
import {
  callNextPatient,
  completePatient,
} from "../../../services/bacsi/queueService";
import { resolveCurrentDoctor } from "../../../services/bacsi/bacsiService";
import { getApiErrorMessage } from "../../../utils/apiResponse";
import QueuePanel from "../../../components/doctor/QueuePanel";
import ExaminationPanel from "../../../components/doctor/ExaminationPanel";
import PrescriptionPanel from "../../../components/doctor/PrescriptionPanel";
import MedicalScanUploader from "../../../components/upload/MedicalScanUploader";
import SecureScanGallery from "../../../components/scans/SecureScanGallery";

const DoctorQueuePage = () => {
  const [maBS, setMaBS] = useState("");
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState("exam");

  const { queue, connected, useRedis, loading, refresh } =
    useDoctorQueueSSE(maBS);

  useEffect(() => {
    let active = true;

    const loadDoctor = async () => {
      try {
        const doctor = await resolveCurrentDoctor({ forceRefresh: true });
        const doctorId = doctor?.maBS || doctor?.doctorId;
        if (!doctorId) {
          throw new Error("Không xác định được mã bác sĩ");
        }
        if (active) setMaBS(doctorId);
      } catch (error) {
        if (!active) return;
        setMaBS("");
        toast.error(
          getApiErrorMessage(error, "Không thể xác định bác sĩ đang đăng nhập"),
        );
      }
    };

    loadDoctor();
    return () => {
      active = false;
    };
  }, []);

  const handleCallNext = async () => {
    if (!maBS) {
      toast.error("Chưa xác định được mã bác sĩ");
      return;
    }

    try {
      const res = await callNextPatient(selected?.maLich);
      const called = res.data?.data ?? res.data;
      setSelected(called);
      toast.success(`Đã gọi: ${called.hoTenBN} (#${called.sequence})`);
      refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không gọi được bệnh nhân"));
    }
  };

  const handleComplete = async (patient) => {
    if (!patient?.maLich || !maBS) return;

    try {
      await completePatient(maBS, patient.maLich);
      toast.success("Hoàn thành khám");
      setSelected(null);
      setActiveTab("exam");
      refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Lỗi cập nhật trạng thái khám"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 p-3 text-white shadow-lg">
            <Stethoscope size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Phòng khám — Hàng chờ realtime
            </h1>
            <p className="text-sm text-gray-500">
              SSE {useRedis ? "+ Redis" : "(in-memory dev)"} · Mã BS: {maBS || "Đang xác định..."}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <QueuePanel
            queue={queue}
            selected={selected}
            onSelect={(patient) => {
              setSelected(patient);
              setActiveTab("exam");
            }}
            onCallNext={handleCallNext}
            connected={connected}
            useRedis={useRedis}
            loading={loading || !maBS}
          />
        </div>

        <div className="space-y-4 xl:col-span-8">
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
                className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
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
              onSaved={() => {
                refresh();
                setActiveTab("rx");
              }}
              onComplete={handleComplete}
            />
          ) : activeTab === "rx" ? (
            <PrescriptionPanel patient={selected} onSaved={refresh} />
          ) : (
            <div className="space-y-6">
              {selected ? (
                <>
                  <SecureScanGallery
                    maBN={selected.maBN}
                    patientName={selected.hoTenBN}
                  />
                  <div className="border-t border-gray-200 pt-6">
                    <MedicalScanUploader
                      onUploadComplete={(results) => {
                        console.log(
                          "[MedicalScanUploader] upload results:",
                          results,
                        );
                      }}
                    />
                  </div>
                </>
              ) : (
                <p className="py-12 text-center text-sm text-gray-400">
                  Chọn bệnh nhân từ hàng chờ để xem hoặc tải phim X-quang/MRI.
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
