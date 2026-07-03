import React from "react";
import { LogOut, UserRound } from "lucide-react";

const getUserName = (user, fallback) =>
  user?.HoTen ||
  user?.hoTen ||
  user?.name ||
  user?.email ||
  user?.username ||
  fallback;

const SidebarAccount = ({
  user,
  roleLabel,
  detailLabel,
  fallbackName = "Người dùng",
  onLogout,
  accent = "from-blue-500 to-indigo-600",
}) => {
  const displayName = getUserName(user, fallbackName);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-2 shadow-lg shadow-black/10 backdrop-blur-sm">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${accent} shadow-lg ring-1 ring-white/20`}
        >
          <UserRound size={21} className="text-white" />
        </div>

        <div className="min-w-0 flex-1">
            <p
                className="truncate text-sm font-bold !text-white"
                style={{ color: "#ffffff" }}
                title={displayName}
                >
                {displayName}
            </p>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-slate-400">
            <span className="shrink-0 font-medium text-slate-300">{roleLabel}</span>
            {detailLabel ? (
              <>
                <span className="h-1 w-1 shrink-0 rounded-full bg-slate-600" />
                <span className="truncate" title={detailLabel}>
                  {detailLabel}
                </span>
              </>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          title="Đăng xuất"
          aria-label="Đăng xuất"
          className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-400/20 bg-red-500/10 text-red-300 transition-all duration-200 hover:-translate-y-0.5 hover:border-red-400/40 hover:bg-red-500 hover:text-white hover:shadow-lg hover:shadow-red-950/30 focus:outline-none focus:ring-2 focus:ring-red-400/60"
        >
          <LogOut size={18} className="transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
};

export default SidebarAccount;
