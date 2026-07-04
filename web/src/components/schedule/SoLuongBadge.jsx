import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import { getPatientCount } from "../../services/nhansu/hrScheduleService";

const SoLuongBadge = ({ maBS, maCa, ngayLamViec }) => {
  const [soLuong, setSoLuong] = useState({ soLuong: 0, toiDa: 10, conLai: 10 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!maBS || !maCa || !ngayLamViec) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const res = await getPatientCount({
          maBS,
          maCa,
          ngayLamViec: dayjs(ngayLamViec).format("YYYY-MM-DD"),
        });
        if (!cancelled) {
          setSoLuong(res.data.data || { soLuong: 0, toiDa: 10, conLai: 10 });
        }
      } catch {
        if (!cancelled) {
          setSoLuong({ soLuong: 0, toiDa: 10, conLai: 10 });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [maBS, maCa, ngayLamViec]);

  if (loading || !maBS) {
    return <span className="text-xs text-gray-400">...</span>;
  }

  const isFull = soLuong.soLuong >= soLuong.toiDa;
  const isAlmostFull = soLuong.soLuong >= soLuong.toiDa * 0.8;

  return (
    <span
      className={`text-xs px-2 py-0.5 rounded font-medium ${
        isFull
          ? "bg-red-100 text-red-700"
          : isAlmostFull
            ? "bg-yellow-100 text-yellow-700"
            : "bg-green-100 text-green-700"
      }`}
    >
      {soLuong.soLuong}/{soLuong.toiDa} BN
    </span>
  );
};

export default SoLuongBadge;
