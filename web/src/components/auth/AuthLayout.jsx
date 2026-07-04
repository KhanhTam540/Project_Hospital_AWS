import { Link } from "react-router-dom";
import {
  CalendarCheck2,
  HeartPulse,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from "lucide-react";

const DEFAULT_PANEL_ITEMS = [
  "Đặt lịch khám và theo dõi lịch hẹn thuận tiện",
  "Quản lý hồ sơ sức khỏe trên một nền tảng",
  "Kết nối an toàn với đội ngũ y tế",
];

const FEATURE_ICONS = [CalendarCheck2, HeartPulse, ShieldCheck];

export default function AuthLayout({
  title,
  subtitle,
  icon = "🏥",
  children,
  footer,
  panelEyebrow = "HOSPITAL P2TB",
  panelTitle = "Chăm sóc sức khỏe thuận tiện trong một nền tảng thống nhất",
  panelDescription =
    "Đồng hành cùng bệnh nhân từ lúc đặt lịch, tiếp nhận, khám bệnh đến theo dõi kết quả và thanh toán.",
  panelItems = DEFAULT_PANEL_ITEMS,
  panelNote = "Nền tảng quản lý bệnh viện hiện đại, an toàn và dễ sử dụng.",
}) {
  const normalizedItems = Array.isArray(panelItems)
    ? panelItems.slice(0, 3)
    : DEFAULT_PANEL_ITEMS;

  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[46%_54%]">
      {/* Brand panel — desktop */}
      <aside className="relative hidden min-h-screen overflow-hidden bg-slate-950 text-white lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.28),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.18),transparent_30%)]" />
        <div className="absolute -left-24 top-28 h-72 w-72 rounded-full border border-white/10" />
        <div className="absolute -left-10 top-44 h-48 w-48 rounded-full border border-sky-300/10" />
        <div className="absolute -right-20 bottom-[-84px] h-72 w-72 rounded-full bg-sky-500/10 blur-2xl" />
        <div className="absolute right-10 top-10 h-28 w-28 rounded-[32px] border border-white/10 bg-white/[0.03] rotate-12" />

        <div className="relative z-10 flex min-h-screen w-full flex-col justify-between px-10 py-9 xl:px-14 xl:py-11">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-lg shadow-sky-950/30 backdrop-blur">
              <Stethoscope size={25} strokeWidth={2.1} />
            </div>
            <div>
              <p className="text-lg font-extrabold tracking-tight text-white">Hospital P2TB</p>
              <p className="text-xs font-medium tracking-wide text-sky-200/80">
                Hệ thống quản lý bệnh viện
              </p>
            </div>
          </div>

          <div className="max-w-xl py-10">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-300/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-sky-200">
              <Sparkles size={14} />
              {panelEyebrow}
            </div>

            <h1 className="max-w-lg text-4xl font-black leading-[1.14] tracking-[-0.035em] text-white xl:text-5xl">
              {panelTitle}
            </h1>

            <p className="mt-5 max-w-lg text-[15px] leading-7 text-slate-300 xl:text-base">
              {panelDescription}
            </p>

            <div className="mt-8 grid gap-3">
              {normalizedItems.map((item, index) => {
                const FeatureIcon = FEATURE_ICONS[index] || ShieldCheck;

                return (
                  <div
                    key={item}
                    className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3.5 backdrop-blur-sm transition hover:border-sky-300/25 hover:bg-white/[0.085]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-400/15 text-sky-200 transition group-hover:bg-sky-400/20">
                      <FeatureIcon size={20} strokeWidth={2} />
                    </div>
                    <p className="text-sm font-semibold leading-5 text-slate-100">{item}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-white/10 pt-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
              <ShieldCheck size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-200">Bảo vệ thông tin người dùng</p>
              <p className="mt-0.5 text-[11px] leading-4 text-slate-400">{panelNote}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Form panel */}
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:px-8 lg:px-10 xl:px-16">
        <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-sky-50/90 to-transparent lg:hidden" />
        <div className="relative z-10 w-full max-w-md">
          {/* Mobile brand */}
          <div className="mb-6 text-center lg:hidden">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/15">
              <Stethoscope size={24} />
            </div>
            <h2 className="mt-3 text-xl font-extrabold tracking-tight text-slate-900">
              Hospital P2TB
            </h2>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Hệ thống quản lý bệnh viện
            </p>
          </div>

          <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.10)] sm:p-8">
            <div className="mb-7 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-2xl shadow-inner shadow-sky-100">
                {icon}
              </div>
              <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-900">
                {title}
              </h1>
              {subtitle && (
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  {subtitle}
                </p>
              )}
            </div>

            {children}

            {footer && (
              <div className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-600">
                {footer}
              </div>
            )}
          </div>

          <p className="mt-5 text-center text-xs text-slate-400">
            © 2026 Hospital P2TB · Chăm sóc sức khỏe thuận tiện hơn
          </p>
        </div>
      </main>
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
      <label className="mb-1.5 block text-sm font-bold text-slate-700">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={`w-full rounded-xl border px-3.5 py-3 text-sm outline-none transition
            ${error ? "border-red-400 bg-red-50/60" : "border-slate-200 bg-slate-50/40"}
            ${
              disabled
                ? "cursor-not-allowed bg-slate-100 text-slate-400"
                : "focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100/70"
            }
            ${rightElement ? "pr-11" : ""}`}
          {...rest}
        />
        {rightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</div>
        )}
      </div>
      {error && (
        <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-500">
          <span aria-hidden="true">⚠️</span>
          {error}
        </p>
      )}
    </div>
  );
}

export function AuthButton({
  children,
  loading,
  variant = "primary",
  className = "",
  ...rest
}) {
  const variants = {
    primary:
      "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/20 hover:from-sky-600 hover:to-blue-700 hover:shadow-xl hover:shadow-sky-500/25",
    success:
      "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600",
    outline:
      "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
  };

  return (
    <button
      type="button"
      disabled={loading}
      className={`w-full rounded-xl py-3 font-bold text-sm transition duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function AuthLink({ to, children }) {
  return (
    <Link
      to={to}
      className="font-bold text-sky-600 transition hover:text-blue-700 hover:underline"
    >
      {children}
    </Link>
  );
}
