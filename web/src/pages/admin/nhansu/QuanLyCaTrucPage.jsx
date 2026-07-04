import React, { useCallback, useEffect, useMemo, useState } from "react";
import AdminPagination, { useAdminPagination } from "../../../components/admin/AdminPagination";
import toast from "react-hot-toast";
import {
  Clock,
  Edit,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  createCaTruc,
  deleteCaTruc,
  getAllCaTruc,
  updateCaTruc,
} from "../../../services/catruc/catrucService";

const EMPTY_FORM = {
  maCa: "",
  tenCa: "",
  thoiGianBatDau: "",
  thoiGianKetThuc: "",
};

const extractShiftList = (response) => {
  const payload = response?.data?.data ?? response?.data ?? [];

  if (Array.isArray(payload)) {
    return payload;
  }

  const candidates = [
    payload?.items,
    payload?.shifts,
    payload?.caTruc,
    payload?.data,
  ];

  return candidates.find(Array.isArray) ?? [];
};

const normalizeTime = (value) => {
  if (!value) return "--:--";
  return String(value).slice(0, 5);
};

const normalizeShift = (item = {}) => ({
  ...item,
  maCa: item.maCa ?? item.shiftId ?? item.id ?? "",
  tenCa: item.tenCa ?? item.shiftName ?? item.name ?? "",
  thoiGianBatDau:
    item.thoiGianBatDau ?? item.startTime ?? item.timeStart ?? "",
  thoiGianKetThuc:
    item.thoiGianKetThuc ?? item.endTime ?? item.timeEnd ?? "",
});

const QuanLyCaTrucPage = () => {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const response = await getAllCaTruc();
      const shifts = extractShiftList(response).map(normalizeShift);
      setList(shifts);
    } catch (error) {
      console.error("Không thể tải danh sách ca trực:", error);
      toast.error(
        error?.response?.data?.message || "Không thể tải dữ liệu ca trực",
      );
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return list;
    }

    return list.filter((ca) =>
      [ca.maCa, ca.tenCa, ca.thoiGianBatDau, ca.thoiGianKetThuc]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    );
  }, [list, search]);

  const pagination = useAdminPagination(filtered, {
    initialPageSize: 10,
    resetKey: search,
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...(current ?? EMPTY_FORM),
      [name]: value,
    }));
  };

  const handleNew = () => {
    setForm({ ...EMPTY_FORM });
  };

  const handleEdit = (ca) => {
    setForm({
      maCa: ca.maCa,
      tenCa: ca.tenCa,
      thoiGianBatDau: normalizeTime(ca.thoiGianBatDau),
      thoiGianKetThuc: normalizeTime(ca.thoiGianKetThuc),
    });
  };

  const validateForm = () => {
    if (!form?.tenCa?.trim()) {
      toast.error("Vui lòng nhập tên ca trực");
      return false;
    }

    if (!form?.thoiGianBatDau || !form?.thoiGianKetThuc) {
      toast.error("Vui lòng chọn đầy đủ giờ bắt đầu và giờ kết thúc");
      return false;
    }

    if (form.thoiGianBatDau === form.thoiGianKetThuc) {
      toast.error("Giờ bắt đầu và giờ kết thúc không được trùng nhau");
      return false;
    }

    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    const payload = {
      tenCa: form.tenCa.trim(),
      thoiGianBatDau: normalizeTime(form.thoiGianBatDau),
      thoiGianKetThuc: normalizeTime(form.thoiGianKetThuc),
    };

    setSubmitting(true);

    try {
      if (form.maCa) {
        await updateCaTruc(form.maCa, payload);
        toast.success("Cập nhật ca trực thành công");
      } else {
        await createCaTruc(payload);
        toast.success("Thêm ca trực thành công");
      }

      setForm(null);
      await fetchData();
    } catch (error) {
      console.error("Không thể lưu ca trực:", error);
      toast.error(
        error?.response?.data?.message ||
          (form.maCa
            ? "Không thể cập nhật ca trực"
            : "Không thể thêm ca trực"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    const shift = list.find((item) => item.maCa === id);
    const label = shift?.tenCa || id;

    if (!window.confirm(`Bạn có chắc muốn xóa ca trực “${label}”?`)) {
      return;
    }

    setDeletingId(id);

    try {
      await deleteCaTruc(id);
      setList((current) => current.filter((item) => item.maCa !== id));
      toast.success("Đã xóa ca trực");
    } catch (error) {
      console.error("Không thể xóa ca trực:", error);
      toast.error(
        error?.response?.data?.message ||
          "Không thể xóa ca trực. Ca có thể đang được sử dụng.",
      );
      await fetchData();
    } finally {
      setDeletingId("");
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-[1600px]">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-slate-600 to-gray-600 shadow-lg">
              <Clock size={30} className="text-white" />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                Quản lý ca trực
              </h1>
              <p className="mt-1 text-sm text-slate-600 sm:text-base">
                Quản lý các ca trực bệnh viện
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleNew}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-slate-600 to-gray-600 px-5 py-2.5 font-semibold text-white shadow-md transition hover:from-slate-700 hover:to-gray-700 hover:shadow-lg"
          >
            <Plus size={19} />
            Thêm ca trực
          </button>
        </div>

        <div className="relative mb-6">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            size={20}
          />
          <input
            type="search"
            placeholder="Tìm kiếm theo tên ca hoặc mã ca..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-12 w-full rounded-lg border border-slate-300 bg-white pl-12 pr-4 text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md">
          {loading ? (
            <div className="flex min-h-72 items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 h-11 w-11 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
                <p className="text-slate-600">Đang tải dữ liệu...</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
              <Clock size={58} className="mb-4 text-slate-300" />
              <h3 className="text-lg font-semibold text-slate-700">
                Không có ca trực nào
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Thay đổi từ khóa tìm kiếm hoặc thêm ca trực mới.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] table-fixed text-sm">
                <colgroup>
                  <col className="w-[18%]" />
                  <col className="w-[26%]" />
                  <col className="w-[18%]" />
                  <col className="w-[18%]" />
                  <col className="w-[20%]" />
                </colgroup>

                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-left font-semibold text-slate-700">
                      Mã ca
                    </th>
                    <th className="px-6 py-4 text-left font-semibold text-slate-700">
                      Tên ca
                    </th>
                    <th className="px-6 py-4 text-left font-semibold text-slate-700">
                      Giờ bắt đầu
                    </th>
                    <th className="px-6 py-4 text-left font-semibold text-slate-700">
                      Giờ kết thúc
                    </th>
                    <th className="px-6 py-4 text-center font-semibold text-slate-700">
                      Thao tác
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {pagination.pageItems.map((ca) => (
                    <tr
                      key={ca.maCa}
                      className="transition-colors hover:bg-slate-50"
                    >
                      <td className="px-6 py-5 align-middle">
                        <span className="inline-flex max-w-full rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800">
                          <span className="truncate">{ca.maCa || "—"}</span>
                        </span>
                      </td>

                      <td className="px-6 py-5 align-middle font-semibold text-slate-800">
                        <div className="truncate" title={ca.tenCa}>
                          {ca.tenCa || "—"}
                        </div>
                      </td>

                      <td className="px-6 py-5 align-middle text-slate-700">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <Clock
                            size={16}
                            className="shrink-0 text-slate-400"
                          />
                          <span>{normalizeTime(ca.thoiGianBatDau)}</span>
                        </div>
                      </td>

                      <td className="px-6 py-5 align-middle text-slate-700">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <Clock
                            size={16}
                            className="shrink-0 text-slate-400"
                          />
                          <span>{normalizeTime(ca.thoiGianKetThuc)}</span>
                        </div>
                      </td>

                      <td className="px-6 py-5 align-middle">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(ca)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Sửa ca trực"
                            aria-label={`Sửa ${ca.tenCa || ca.maCa}`}
                            disabled={Boolean(deletingId)}
                          >
                            <Edit size={18} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(ca.maCa)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Xóa ca trực"
                            aria-label={`Xóa ${ca.tenCa || ca.maCa}`}
                            disabled={deletingId === ca.maCa}
                          >
                            {deletingId === ca.maCa ? (
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-200 border-t-red-600" />
                            ) : (
                              <Trash2 size={18} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loading && filtered.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <AdminPagination pagination={pagination} itemLabel="ca trực" />
          </div>
        )}
      </div>

      {form && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-label={form.maCa ? "Cập nhật ca trực" : "Thêm ca trực"}
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between bg-gradient-to-r from-slate-600 to-gray-600 px-6 py-5">
              <h2 className="text-xl font-bold text-white sm:text-2xl">
                {form.maCa ? "Cập nhật ca trực" : "Thêm ca trực mới"}
              </h2>

              <button
                type="button"
                onClick={() => !submitting && setForm(null)}
                className="rounded-lg p-2 text-white transition hover:bg-white/15 disabled:opacity-50"
                aria-label="Đóng"
                disabled={submitting}
              >
                <X size={23} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              {form.maCa && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Mã ca
                  </label>
                  <input
                    value={form.maCa}
                    disabled
                    className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-slate-500"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="tenCa"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Tên ca <span className="text-red-500">*</span>
                </label>
                <input
                  id="tenCa"
                  name="tenCa"
                  value={form.tenCa || ""}
                  onChange={handleChange}
                  placeholder="Ví dụ: Ca sáng, Ca chiều, Ca đêm"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  maxLength={100}
                  autoFocus
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="thoiGianBatDau"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Giờ bắt đầu <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="thoiGianBatDau"
                    type="time"
                    name="thoiGianBatDau"
                    value={form.thoiGianBatDau || ""}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="thoiGianKetThuc"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Giờ kết thúc <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="thoiGianKetThuc"
                    type="time"
                    name="thoiGianKetThuc"
                    value={form.thoiGianKetThuc || ""}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setForm(null)}
                  disabled={submitting}
                  className="rounded-lg border border-slate-300 px-6 py-2.5 font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Hủy
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-slate-600 to-gray-600 px-6 py-2.5 font-semibold text-white shadow-md transition hover:from-slate-700 hover:to-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  ) : (
                    <Save size={18} />
                  )}
                  {submitting
                    ? "Đang lưu..."
                    : form.maCa
                      ? "Cập nhật"
                      : "Thêm mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuanLyCaTrucPage;
