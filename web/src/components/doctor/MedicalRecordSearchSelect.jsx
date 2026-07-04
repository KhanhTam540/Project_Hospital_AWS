import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";

const text = (value) => String(value ?? "").trim();
const onlyDigits = (value) => text(value).replace(/\D/g, "").slice(0, 12);

const recordCitizenId = (record) =>
  onlyDigits(
    record?.cccd ||
      record?.citizenId ||
      record?.BenhNhan?.cccd ||
      record?.BenhNhan?.citizenId ||
      record?.patient?.cccd ||
      record?.patient?.citizenId ||
      record?.displayRecordId ||
      record?.maHSBAHienThi,
  );

const recordPatientName = (record) =>
  text(
    record?.patientName ||
      record?.BenhNhan?.hoTen ||
      record?.patient?.hoTen ||
      record?.patient?.fullName,
  );

const buildLabel = (record) => {
  if (!record) return "";
  const citizenId = recordCitizenId(record);
  const patientName = recordPatientName(record);
  return [citizenId, patientName].filter(Boolean).join(" - ");
};

const MedicalRecordSearchSelect = ({
  records = [],
  value = "",
  onChange,
  disabled = false,
  loading = false,
  label = "Tra cứu hồ sơ bằng CCCD",
  placeholder = "Nhập đúng 12 số CCCD của bệnh nhân",
}) => {
  const selectedRecord = useMemo(
    () => records.find((item) => item.recordId === value) || null,
    [records, value],
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const blurTimer = useRef(null);

  useEffect(() => {
    if (selectedRecord) {
      setQuery(buildLabel(selectedRecord));
      return;
    }
    if (!value) setQuery("");
  }, [selectedRecord, value]);

  const citizenIdQuery = onlyDigits(query);

  const filtered = useMemo(() => {
    if (selectedRecord && query === buildLabel(selectedRecord)) return [];
    if (citizenIdQuery.length !== 12) return [];

    return records
      .filter((record) => recordCitizenId(record) === citizenIdQuery)
      .slice(0, 1);
  }, [records, query, selectedRecord, citizenIdQuery]);

  const selectRecord = (record) => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    onChange?.(record.recordId, record);
    setQuery(buildLabel(record));
    setOpen(false);
  };

  const clearSelection = () => {
    onChange?.("", null);
    setQuery("");
    setOpen(true);
  };

  const message = (() => {
    if (loading) return "Đang tải dữ liệu hồ sơ...";
    if (!citizenIdQuery) return "Nhập số CCCD để tra cứu chính xác bệnh nhân.";
    if (citizenIdQuery.length < 12) {
      return `CCCD còn thiếu ${12 - citizenIdQuery.length} chữ số.`;
    }
    if (filtered.length === 0) {
      return `Không tìm thấy hồ sơ gắn với CCCD ${citizenIdQuery}.`;
    }
    return "";
  })();

  return (
    <div className="relative">
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <div className="relative">
        <Search
          size={17}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          value={query}
          onChange={(event) => {
            const nextValue = onlyDigits(event.target.value);
            setQuery(nextValue);
            if (selectedRecord) onChange?.("", null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setOpen(false), 160);
          }}
          disabled={disabled}
          inputMode="numeric"
          autoComplete="off"
          maxLength={12}
          pattern="[0-9]{12}"
          placeholder={loading ? "Đang tải hồ sơ..." : placeholder}
          className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-10 font-mono tracking-wide focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100"
          aria-label="Nhập CCCD bệnh nhân"
        />
        {(query || value) && !disabled && (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={clearSelection}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            aria-label="Xóa CCCD đã nhập"
          >
            <X size={17} />
          </button>
        )}
      </div>

      <p className="mt-2 text-xs text-slate-500">
        Hệ thống chỉ tra cứu bằng CCCD 12 số; không tìm bằng tên hoặc mã nội bộ.
      </p>

      {open && !disabled && !selectedRecord && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          {filtered.length === 0 ? (
            <p className="px-4 py-5 text-center text-sm text-slate-500">
              {message}
            </p>
          ) : (
            filtered.map((record) => {
              const citizenId = recordCitizenId(record);
              const name = recordPatientName(record) || "Chưa có tên";
              return (
                <button
                  type="button"
                  key={`${record.recordId}-${citizenId}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectRecord(record)}
                  className="block w-full px-4 py-3 text-left hover:bg-blue-50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">{name}</span>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 font-mono text-xs font-semibold text-blue-700">
                      {citizenId}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Hồ sơ bệnh án dùng CCCD làm mã tra cứu duy nhất.
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default MedicalRecordSearchSelect;
