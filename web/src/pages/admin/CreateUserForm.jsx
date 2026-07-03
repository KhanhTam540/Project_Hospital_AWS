import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import axios from "../../api/axiosClient";
import {
  ensureArray,
  getApiErrorMessage,
  unwrapApiResponse,
} from "../../utils/apiResponse";

const EMPTY_FORM = Object.freeze({
  tenDangNhap: "",
  matKhau: "",
  email: "",
  vaiTro: "",
  maKhoa: "",
  loaiNS: "",
  capBac: "",
  chuyenMon: "",
  hoTen: "",
  trinhDo: "",
  chucVu: "",
  ngaySinh: "",
  gioiTinh: "Nam",
  diaChi: "",
  soDienThoai: "",
  bhyt: "",
});

const ROLE_OPTIONS = Object.freeze([
  { value: "BACSI", label: "Bác sĩ" },
  { value: "NHANSU", label: "Nhân viên y tế" },
  { value: "BENHNHAN", label: "Bệnh nhân" },
  { value: "ADMIN", label: "Quản trị viên" },
]);

const STAFF_TYPE_OPTIONS = Object.freeze([
  { value: "YT", label: "Y tá / Điều dưỡng" },
  { value: "XN", label: "Kỹ thuật viên xét nghiệm" },
  { value: "TN", label: "Tiếp nhận" },
  { value: "HC", label: "Hành chính" },
  { value: "KT", label: "Kế toán / Thu ngân" },
]);

const normalizeAccount = (account = {}) => ({
  tenDangNhap: account.tenDangNhap || account.username || "",
  matKhau: "",
  email: account.email || "",
  vaiTro: account.maNhom || account.primaryRole || account.groups?.[0] || "",
  maKhoa: account.maKhoa || account.departmentId || "",
  loaiNS: account.loaiNS || account.staffType || "",
  capBac: account.capBac || account.rank || "",
  chuyenMon: account.chuyenMon || account.specialty || "",
  hoTen: account.hoTen || account.fullName || "",
  trinhDo: account.trinhDo || account.degree || "",
  chucVu: account.chucVu || account.position || "",
  ngaySinh: String(account.ngaySinh || account.birthDate || "").slice(0, 10),
  gioiTinh: account.gioiTinh || account.gender || "Nam",
  diaChi: account.diaChi || account.address || "",
  soDienThoai: account.soDienThoai || account.phoneNumber || "",
  bhyt: account.bhyt || account.healthInsurance || "",
});

function CreateUserForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const userFromState = location.state?.user;

  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const needsDepartment = useMemo(
    () => ["BACSI", "NHANSU"].includes(form.vaiTro),
    [form.vaiTro],
  );

  const fetchDepartments = useCallback(async () => {
    const response = await axios.get("/khoa");
    setDepartments(ensureArray(unwrapApiResponse(response, [])));
  }, []);

  const fetchAccount = useCallback(async () => {
    if (!isEdit) return;
    if (userFromState) {
      setForm(normalizeAccount(userFromState));
      return;
    }
    const response = await axios.get(`/tai-khoan/${encodeURIComponent(id)}`);
    setForm(normalizeAccount(unwrapApiResponse(response, {})));
  }, [id, isEdit, userFromState]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setInitialLoading(true);
      try {
        await Promise.all([fetchDepartments(), fetchAccount()]);
      } catch (error) {
        if (mounted) {
          toast.error(getApiErrorMessage(error, "Không thể tải dữ liệu biểu mẫu"));
        }
      } finally {
        if (mounted) setInitialLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [fetchAccount, fetchDepartments]);

  const setField = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setField(name, value);
  };

  const validate = () => {
    const next = {};
    const username = form.tenDangNhap.trim();
    const email = form.email.trim();

    if (!username) next.tenDangNhap = "Tên đăng nhập là bắt buộc";
    else if (username.length < 4) next.tenDangNhap = "Cần ít nhất 4 ký tự";

    if (!email) next.email = "Email là bắt buộc";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = "Email không đúng định dạng";
    }

    if (!form.vaiTro) next.vaiTro = "Vui lòng chọn vai trò";

    if (!isEdit) {
      if (!form.matKhau) next.matKhau = "Mật khẩu là bắt buộc";
      else if (
        !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/.test(
          form.matKhau,
        )
      ) {
        next.matKhau =
          "Cần 10+ ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt";
      }
    }

    if (needsDepartment && !form.maKhoa) next.maKhoa = "Vui lòng chọn khoa";
    if (["BACSI", "NHANSU", "BENHNHAN"].includes(form.vaiTro) && !form.hoTen.trim()) {
      next.hoTen = "Họ tên là bắt buộc";
    }
    if (form.vaiTro === "NHANSU" && !form.loaiNS) {
      next.loaiNS = "Vui lòng chọn loại nhân sự";
    }
    if (form.soDienThoai && !/^\+?[0-9]{9,15}$/.test(form.soDienThoai.trim())) {
      next.soDienThoai = "Số điện thoại không đúng định dạng";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const buildPayload = () => {
    const payload = {
      tenDangNhap: form.tenDangNhap.trim(),
      email: form.email.trim().toLowerCase(),
      maNhom: form.vaiTro,
      hoTen: form.hoTen.trim() || undefined,
      soDienThoai: form.soDienThoai.trim() || undefined,
    };

    if (!isEdit) payload.matKhau = form.matKhau;
    if (needsDepartment) payload.maKhoa = form.maKhoa;

    if (form.vaiTro === "NHANSU") {
      Object.assign(payload, {
        loaiNS: form.loaiNS,
        capBac: form.capBac.trim() || undefined,
        chuyenMon: form.chuyenMon.trim() || undefined,
      });
    }

    if (form.vaiTro === "BACSI") {
      Object.assign(payload, {
        chuyenMon: form.chuyenMon.trim() || undefined,
        trinhDo: form.trinhDo.trim() || undefined,
        chucVu: form.chucVu.trim() || undefined,
        capBac: form.capBac.trim() || undefined,
      });
    }

    if (form.vaiTro === "BENHNHAN") {
      Object.assign(payload, {
        ngaySinh: form.ngaySinh || undefined,
        gioiTinh: form.gioiTinh,
        diaChi: form.diaChi.trim() || undefined,
        bhyt: form.bhyt.trim() || undefined,
      });
    }

    return payload;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) {
      toast.error("Vui lòng kiểm tra lại thông tin nhập vào");
      return;
    }

    setLoading(true);
    try {
      const payload = buildPayload();
      if (isEdit) {
        await axios.put(`/tai-khoan/${encodeURIComponent(id)}`, payload);
        toast.success("Cập nhật tài khoản thành công");
      } else {
        const response = await axios.post("/tai-khoan", payload);
        const created = unwrapApiResponse(response, {});
        toast.success(
          created.confirmationStatus === "CONFIRMED"
            ? "Tạo tài khoản thành công. Người dùng có thể đăng nhập ngay."
            : "Tạo tài khoản thành công.",
          { duration: 5000 },
        );
      }
      navigate("/admin/taikhoan");
    } catch (error) {
      const details = error?.response?.data?.error?.details;
      if (details?.fieldErrors && typeof details.fieldErrors === "object") {
        setErrors(details.fieldErrors);
      }
      toast.error(getApiErrorMessage(error, "Không thể lưu tài khoản"));
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field) =>
    `w-full rounded-lg border px-3 py-2.5 outline-none transition focus:ring-2 ${
      errors[field]
        ? "border-red-400 bg-red-50 focus:ring-red-100"
        : "border-slate-300 focus:border-blue-400 focus:ring-blue-100"
    }`;

  const ErrorMessage = ({ field }) =>
    errors[field] ? (
      <p className="mt-1 text-xs font-medium text-red-600">{errors[field]}</p>
    ) : null;

  if (initialLoading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center text-slate-500">
        Đang tải dữ liệu...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <button
        type="button"
        onClick={() => navigate("/admin/taikhoan")}
        className="mb-4 text-sm font-semibold text-slate-500 hover:text-blue-700"
      >
        ← Quay lại danh sách
      </button>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl bg-white p-6 shadow-lg">
        <div className="border-b border-slate-100 pb-4">
          <h1 className="text-2xl font-black text-slate-900">
            {isEdit ? "Cập nhật tài khoản" : "Tạo tài khoản mới"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isEdit
              ? "Cập nhật vai trò và thông tin hồ sơ người dùng."
              : "Tài khoản do Admin tạo sẽ ở trạng thái CONFIRMED, không cần OTP và có thể đăng nhập ngay."}
          </p>
        </div>

        {!isEdit && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            Hệ thống không gửi mã OTP cho tài khoản này. Email được đánh dấu đã xác minh và mật khẩu được đặt vĩnh viễn ngay khi tạo.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Tên đăng nhập *</label>
            <input
              name="tenDangNhap"
              value={form.tenDangNhap}
              onChange={handleChange}
              disabled={isEdit}
              className={inputClass("tenDangNhap")}
              autoComplete="username"
            />
            <ErrorMessage field="tenDangNhap" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Email *</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className={inputClass("email")}
              autoComplete="email"
            />
            <ErrorMessage field="email" />
          </div>
        </div>

        {!isEdit && (
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Mật khẩu *</label>
            <input
              type="password"
              name="matKhau"
              value={form.matKhau}
              onChange={handleChange}
              className={inputClass("matKhau")}
              autoComplete="new-password"
            />
            <ErrorMessage field="matKhau" />
            {!errors.matKhau && (
              <p className="mt-1 text-xs text-slate-500">
                Ít nhất 10 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt.
              </p>
            )}
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Vai trò *</label>
          <select
            name="vaiTro"
            value={form.vaiTro}
            onChange={handleChange}
            className={inputClass("vaiTro")}
          >
            <option value="">-- Chọn vai trò --</option>
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <ErrorMessage field="vaiTro" />
        </div>

        {needsDepartment && (
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Khoa *</label>
            <select
              name="maKhoa"
              value={form.maKhoa}
              onChange={handleChange}
              className={inputClass("maKhoa")}
            >
              <option value="">-- Chọn khoa --</option>
              {departments.map((item) => (
                <option key={item.maKhoa} value={item.maKhoa}>{item.tenKhoa}</option>
              ))}
            </select>
            <ErrorMessage field="maKhoa" />
          </div>
        )}

        {["BACSI", "NHANSU", "BENHNHAN"].includes(form.vaiTro) && (
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Họ và tên *</label>
            <input name="hoTen" value={form.hoTen} onChange={handleChange} className={inputClass("hoTen")} />
            <ErrorMessage field="hoTen" />
          </div>
        )}

        {form.vaiTro === "NHANSU" && (
          <div className="grid gap-4 rounded-xl bg-slate-50 p-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Loại nhân sự *</label>
              <select name="loaiNS" value={form.loaiNS} onChange={handleChange} className={inputClass("loaiNS")}>
                <option value="">-- Chọn loại --</option>
                {STAFF_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <ErrorMessage field="loaiNS" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Cấp bậc</label>
              <input name="capBac" value={form.capBac} onChange={handleChange} className={inputClass("capBac")} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-slate-700">Chuyên môn</label>
              <input name="chuyenMon" value={form.chuyenMon} onChange={handleChange} className={inputClass("chuyenMon")} />
            </div>
          </div>
        )}

        {form.vaiTro === "BACSI" && (
          <div className="grid gap-4 rounded-xl bg-blue-50 p-4 md:grid-cols-2">
            <input name="chuyenMon" value={form.chuyenMon} onChange={handleChange} placeholder="Chuyên môn" className={inputClass("chuyenMon")} />
            <input name="trinhDo" value={form.trinhDo} onChange={handleChange} placeholder="Trình độ" className={inputClass("trinhDo")} />
            <input name="chucVu" value={form.chucVu} onChange={handleChange} placeholder="Chức vụ" className={inputClass("chucVu")} />
            <input name="capBac" value={form.capBac} onChange={handleChange} placeholder="Cấp bậc" className={inputClass("capBac")} />
          </div>
        )}

        {form.vaiTro === "BENHNHAN" && (
          <div className="grid gap-4 rounded-xl bg-emerald-50 p-4 md:grid-cols-2">
            <input type="date" name="ngaySinh" value={form.ngaySinh} onChange={handleChange} className={inputClass("ngaySinh")} />
            <select name="gioiTinh" value={form.gioiTinh} onChange={handleChange} className={inputClass("gioiTinh")}>
              <option value="Nam">Nam</option>
              <option value="Nữ">Nữ</option>
              <option value="Khác">Khác</option>
            </select>
            <div>
              <input name="soDienThoai" value={form.soDienThoai} onChange={handleChange} placeholder="Số điện thoại" className={inputClass("soDienThoai")} />
              <ErrorMessage field="soDienThoai" />
            </div>
            <input name="bhyt" value={form.bhyt} onChange={handleChange} placeholder="Mã BHYT" className={inputClass("bhyt")} />
            <input name="diaChi" value={form.diaChi} onChange={handleChange} placeholder="Địa chỉ" className={`${inputClass("diaChi")} md:col-span-2`} />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {loading ? "Đang lưu..." : isEdit ? "Cập nhật tài khoản" : "Tạo tài khoản CONFIRMED"}
        </button>
      </form>
    </div>
  );
}

export default CreateUserForm;
