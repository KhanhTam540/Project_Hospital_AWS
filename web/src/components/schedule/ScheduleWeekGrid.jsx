import React from "react";
import dayjs from "dayjs";
import { Pencil, Trash2 } from "lucide-react";
import SoLuongBadge from "./SoLuongBadge";

const ScheduleWeekGrid = ({
  weekDays,
  caList,
  getLichForDayAndCa,
  loading,
  canManage = false,
  onEdit,
  onDelete,
  accent = "blue",
}) => {
  const headerGradient =
    accent === "amber"
      ? "from-amber-600 to-yellow-600"
      : "from-blue-600 to-indigo-600";

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-amber-600 mx-auto" />
        <p className="text-sm text-gray-500 mt-4">Đang tải lịch làm việc...</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse min-w-[900px]">
        <thead>
          <tr className={`bg-gradient-to-r ${headerGradient} text-white`}>
            <th className="border border-gray-300 px-4 py-3 text-left font-semibold w-36">
              Ca / Ngày
            </th>
            {weekDays.map((day, idx) => (
              <th
                key={idx}
                className="border border-gray-300 px-3 py-3 text-center font-semibold min-w-[160px]"
              >
                <div className="capitalize">{day.format("dddd")}</div>
                <div className="text-sm font-normal opacity-90">{day.format("DD/MM/YYYY")}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {caList.map((ca) => (
            <tr key={ca.maCa} className="hover:bg-gray-50/80">
              <td className="border border-gray-200 px-4 py-3 bg-gray-50 font-semibold align-top">
                <div className={`font-bold ${accent === "amber" ? "text-amber-700" : "text-blue-700"}`}>
                  {ca.tenCa}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {ca.thoiGianBatDau} – {ca.thoiGianKetThuc}
                </div>
              </td>
              {weekDays.map((day, dayIdx) => {
                const lichList = getLichForDayAndCa(day, ca.maCa);
                return (
                  <td
                    key={dayIdx}
                    className="border border-gray-200 px-2 py-2 text-center align-top"
                  >
                    {lichList.length > 0 ? (
                      <div className="space-y-2">
                        {lichList.map((lich) => {
                          const bacSi = lich.BacSi || {};
                          const maBS = lich.maBS || bacSi.maBS;
                          return (
                            <div
                              key={lich.maLichLV}
                              className="bg-white border border-green-200 rounded-lg p-2.5 shadow-sm text-left"
                            >
                              <div className="text-sm font-semibold text-gray-800">
                                {bacSi.hoTen || "Bác sĩ"}
                              </div>
                              <div className="text-xs text-gray-500 mb-1.5">
                                {bacSi.chuyenMon || bacSi.capBac || "—"}
                              </div>
                              {maBS && (
                                <SoLuongBadge
                                  maBS={maBS}
                                  maCa={ca.maCa}
                                  ngayLamViec={day}
                                />
                              )}
                              {canManage && (
                                <div className="flex gap-1 mt-2 pt-2 border-t border-gray-100">
                                  <button
                                    type="button"
                                    onClick={() => onEdit?.(lich)}
                                    className="flex-1 flex items-center justify-center gap-1 text-xs py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100"
                                  >
                                    <Pencil size={12} /> Sửa
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDelete?.(lich.maLichLV)}
                                    className="flex-1 flex items-center justify-center gap-1 text-xs py-1 rounded bg-red-50 text-red-600 hover:bg-red-100"
                                  >
                                    <Trash2 size={12} /> Xóa
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-gray-300 text-xs py-6">—</div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ScheduleWeekGrid;
