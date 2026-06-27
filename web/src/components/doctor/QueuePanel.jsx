import React from "react";
import { Bell, CheckCircle2, Clock, User, Wifi, WifiOff } from "lucide-react";

const statusStyles = {
  WAITING: "bg-amber-100 text-amber-800 border-amber-200",
  IN_PROGRESS: "bg-blue-100 text-blue-800 border-blue-300 ring-2 ring-blue-400",
  COMPLETED: "bg-gray-100 text-gray-500 border-gray-200",
};

const statusLabel = {
  WAITING: "Chờ khám",
  IN_PROGRESS: "Đang khám",
  COMPLETED: "Đã khám",
};

const QueuePanel = ({
  queue,
  selected,
  onSelect,
  onCallNext,
  connected,
  useRedis,
  loading,
}) => {
  const waiting = queue.filter((q) => q.trangThaiQueue === "WAITING").length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full min-h-[480px]">
      <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-blue-900 flex items-center gap-2">
            <Bell size={18} /> Hàng chờ khám
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {waiting} bệnh nhân đang chờ · {queue.length} tổng
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full ${
              connected ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
            }`}
            title={useRedis ? "Redis SSE" : "Memory SSE (dev)"}
          >
            {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {connected ? "Live" : "Offline"}
          </span>
          <button
            type="button"
            onClick={onCallNext}
            className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg"
          >
            Gọi tiếp
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Đang tải hàng chờ...</div>
        ) : queue.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">Không có bệnh nhân trong hàng chờ</div>
        ) : (
          queue.map((item) => (
            <button
              key={item.maLich || item.maBN}
              type="button"
              onClick={() => onSelect(item)}
              className={`w-full text-left px-4 py-3 hover:bg-blue-50/50 transition-colors ${
                selected?.maLich === item.maLich ? "bg-blue-50 border-l-4 border-blue-600" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold text-sm ${
                    item.trangThaiQueue === "IN_PROGRESS"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {String(item.sequence).padStart(2, "0")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-gray-800 truncate">{item.hoTenBN}</p>
                    {item.daDoSinhHieu && (
                      <CheckCircle2 size={14} className="text-emerald-500 shrink-0" title="Đã đo sinh hiệu" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <Clock size={11} /> {item.gioKham || "—"}
                    {item.phong && ` · P.${item.phong}`}
                  </p>
                  <span
                    className={`inline-block mt-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                      statusStyles[item.trangThaiQueue] || statusStyles.WAITING
                    }`}
                  >
                    {statusLabel[item.trangThaiQueue] || item.trangThaiQueue}
                  </span>
                </div>
              </div>
              {item.vitals?.nhietDo && (
                <p className="text-[10px] text-gray-400 mt-2 ml-12">
                  🌡 {item.vitals.nhietDo}°C · ❤ {item.vitals.nhipTim} · BP {item.vitals.huyetApTamThu}/
                  {item.vitals.huyetApTamTruong}
                </p>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default QueuePanel;
