import React, { useState } from "react";
import { Building2, Stethoscope } from "lucide-react";
import ManageKhoa from "./ManageKhoa";
import ManagePhongKham from "./ManagePhongKham";

function ManageKhoaPhongPage() {
  const [tab, setTab] = useState("khoa");

  const tabs = [
    { id: "khoa", label: "Khoa (Departments)", icon: Building2 },
    { id: "phongkham", label: "Phòng khám (Clinics)", icon: Stethoscope },
  ];

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Khoa & Phòng khám</h1>
        <p className="text-gray-500 text-sm mt-1">Quản lý khoa phòng và phòng khám ngoại trú</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
              tab === id
                ? "bg-indigo-600 text-white shadow-md"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>

      {tab === "khoa" ? <ManageKhoa embedded /> : <ManagePhongKham />}
    </div>
  );
}

export default ManageKhoaPhongPage;
