import { Link } from "react-router-dom";

export default function AuthLayout({ title, subtitle, icon = "🏥", children, footer }) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-gradient-to-br from-sky-50 via-white to-blue-100">
      {/* Brand panel — desktop */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[45%] flex-col justify-between p-12 bg-gradient-to-br from-[#21618C] to-[#1A5276] text-white">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <span className="text-4xl">🏥</span>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">WebHospital</h2>
              <p className="text-sky-200 text-sm">Hệ thống quản lý bệnh viện</p>
            </div>
          </div>
          <h1 className="text-3xl xl:text-4xl font-extrabold leading-tight mb-4">
            Chăm sóc sức khỏe
            <br />
            thông minh & an toàn
          </h1>
          <p className="text-sky-100 text-base max-w-md leading-relaxed">
            Đăng nhập để truy cập cổng bệnh nhân, bác sĩ hoặc khu vực quản trị nội bộ.
            Xác thực bảo mật qua AWS Cognito.
          </p>
        </div>
        <p className="text-sky-300 text-xs">© 2026 WebHospital · Bảo mật AWS Cognito</p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          {/* Mobile brand */}
          <div className="lg:hidden text-center mb-6">
            <span className="text-3xl">{icon}</span>
            <h2 className="text-xl font-bold text-[#21618C] mt-2">WebHospital</h2>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 sm:p-8">
            <div className="text-center mb-6">
              <span className="text-3xl">{icon}</span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#21618C] mt-2">{title}</h1>
              {subtitle && (
                <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
              )}
            </div>

            {children}

            {footer && <div className="mt-6 text-center text-sm text-slate-600">{footer}</div>}
          </div>

          <p className="lg:hidden text-center text-xs text-slate-400 mt-4">
            © 2026 WebHospital
          </p>
        </div>
      </div>
    </div>
  );
}

export function AuthInput({
  label,
  type = "text",
  value,
  onChange,
  error,
  disabled,
  placeholder,
  autoFocus,
  rightElement,
  ...rest
}) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition
            ${error ? "border-red-400 bg-red-50" : "border-slate-200 bg-white"}
            ${disabled ? "bg-slate-50 text-slate-400 cursor-not-allowed" : "focus:border-sky-400 focus:ring-2 focus:ring-sky-100"}
            ${rightElement ? "pr-10" : ""}`}
          {...rest}
        />
        {rightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</div>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">⚠️ {error}</p>
      )}
    </div>
  );
}

export function AuthButton({ children, loading, variant = "primary", className = "", ...rest }) {
  const variants = {
    primary: "bg-[#3498DB] hover:bg-[#2E86C1] text-white",
    success: "bg-emerald-500 hover:bg-emerald-600 text-white",
    outline: "border border-slate-200 text-slate-600 hover:bg-slate-50",
  };

  return (
    <button
      type="button"
      disabled={loading}
      className={`w-full py-2.5 rounded-xl font-semibold text-sm transition disabled:opacity-60 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function AuthLink({ to, children }) {
  return (
    <Link to={to} className="text-[#3498DB] font-semibold hover:underline">
      {children}
    </Link>
  );
}
