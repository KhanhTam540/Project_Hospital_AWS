import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Database,
  FileText,
  FlaskConical,
  Pill,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserPlus,
  Users,
} from "lucide-react";
import axios from "../api/axiosClient";
import { useAuth } from "../auth/AuthContext";

const EMPTY_STATS = {
  totalUsers: 0,
  totalBacSi: 0,
  totalBenhNhan: 0,
  totalLichKham: 0,
  totalHoaDon: 0,
  totalThuoc: 0,
  totalKhoa: 0,
  totalXetNghiem: 0,
};

const METRICS = [
  {
    key: "totalUsers",
    title: "Tổng tài khoản",
    caption: "Người dùng đã ghi nhận",
    icon: Users,
    to: "/admin/taikhoan",
    tone: "blue",
  },
  {
    key: "totalBacSi",
    title: "Bác sĩ",
    caption: "Nhân sự chuyên môn",
    icon: Stethoscope,
    to: "/admin/bacsi",
    tone: "emerald",
  },
  {
    key: "totalBenhNhan",
    title: "Bệnh nhân",
    caption: "Hồ sơ đang quản lý",
    icon: Users,
    to: "/admin/benhnhan",
    tone: "violet",
  },
  {
    key: "totalLichKham",
    title: "Lịch khám",
    caption: "Lịch hẹn trong hệ thống",
    icon: CalendarDays,
    to: "/admin/lichkham",
    tone: "amber",
  },
  {
    key: "totalHoaDon",
    title: "Hóa đơn",
    caption: "Giao dịch đã ghi nhận",
    icon: BarChart3,
    to: "/admin/thongke",
    tone: "cyan",
  },
  {
    key: "totalThuoc",
    title: "Thuốc",
    caption: "Danh mục dược phẩm",
    icon: Pill,
    to: "/admin/thuoc",
    tone: "rose",
  },
  {
    key: "totalKhoa",
    title: "Khoa & phòng",
    caption: "Đơn vị chuyên môn",
    icon: Building2,
    to: "/admin/khoa",
    tone: "indigo",
  },
  {
    key: "totalXetNghiem",
    title: "Xét nghiệm",
    caption: "Dịch vụ cận lâm sàng",
    icon: FlaskConical,
    to: "/admin/xetnghiem",
    tone: "teal",
  },
];

const TONE_CLASSES = {
  blue: {
    icon: "bg-blue-50 text-blue-600 ring-blue-100",
    line: "from-blue-500 to-indigo-500",
    glow: "group-hover:shadow-blue-100/80",
  },
  emerald: {
    icon: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    line: "from-emerald-500 to-teal-500",
    glow: "group-hover:shadow-emerald-100/80",
  },
  violet: {
    icon: "bg-violet-50 text-violet-600 ring-violet-100",
    line: "from-violet-500 to-fuchsia-500",
    glow: "group-hover:shadow-violet-100/80",
  },
  amber: {
    icon: "bg-amber-50 text-amber-600 ring-amber-100",
    line: "from-amber-500 to-orange-500",
    glow: "group-hover:shadow-amber-100/80",
  },
  cyan: {
    icon: "bg-cyan-50 text-cyan-600 ring-cyan-100",
    line: "from-cyan-500 to-sky-500",
    glow: "group-hover:shadow-cyan-100/80",
  },
  rose: {
    icon: "bg-rose-50 text-rose-600 ring-rose-100",
    line: "from-rose-500 to-pink-500",
    glow: "group-hover:shadow-rose-100/80",
  },
  indigo: {
    icon: "bg-indigo-50 text-indigo-600 ring-indigo-100",
    line: "from-indigo-500 to-blue-500",
    glow: "group-hover:shadow-indigo-100/80",
  },
  teal: {
    icon: "bg-teal-50 text-teal-600 ring-teal-100",
    line: "from-teal-500 to-emerald-500",
    glow: "group-hover:shadow-teal-100/80",
  },
};

const QUICK_ACTIONS = [
  {
    title: "Tạo tài khoản",
    description: "Thêm mới người dùng và hồ sơ truy cập.",
    icon: UserPlus,
    to: "/admin/taikhoan/tao-moi",
    accent: "from-blue-500 to-indigo-600",
  },
  {
    title: "Phân quyền",
    description: "Kiểm soát vai trò và phạm vi sử dụng.",
    icon: ShieldCheck,
    to: "/admin/taikhoan/phan-quyen",
    accent: "from-violet-500 to-fuchsia-600",
  },
  {
    title: "Theo dõi thống kê",
    description: "Xem dữ liệu vận hành và báo cáo tổng hợp.",
    icon: BarChart3,
    to: "/admin/thongke",
    accent: "from-emerald-500 to-teal-600",
  },
  {
    title: "Hồ sơ bệnh án",
    description: "Tra cứu và quản lý hồ sơ bệnh nhân.",
    icon: FileText,
    to: "/admin/hosobenhan",
    accent: "from-orange-500 to-rose-500",
  },
];



const extractCount = (response) => {
  const body = response?.data;
  const value = body?.data ?? body?.items ?? body;

  if (Array.isArray(value)) return value.length;
  if (Array.isArray(value?.users)) return value.users.length;
  if (Array.isArray(value?.items)) return value.items.length;
  if (typeof value?.total === "number") return value.total;
  if (typeof value?.count === "number") return value.count;
  if (typeof body?.count === "number") return body.count;
  return 0;
};

const getDisplayName = (user) =>
  user?.HoTen || user?.hoTen || user?.name || user?.email || "Quản trị viên P2TB";

const MetricSkeleton = () => (
  <div className="h-40 animate-pulse rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
    <div className="mb-7 flex items-center justify-between">
      <div className="h-11 w-11 rounded-xl bg-slate-100" />
      <div className="h-6 w-20 rounded-full bg-slate-100" />
    </div>
    <div className="h-8 w-20 rounded bg-slate-100" />
    <div className="mt-3 h-4 w-32 rounded bg-slate-100" />
  </div>
);

const MetricCard = ({ metric, value }) => {
  const Icon = metric.icon;
  const tone = TONE_CLASSES[metric.tone];

  return (
    <Link
      to={metric.to}
      className={`group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl ${tone.glow}`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${tone.line}`} />

      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${tone.icon}`}>
          <Icon size={22} strokeWidth={2.1} />
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-100">
          Trực tiếp
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>
      </div>

      <div className="mt-6 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-3xl font-black tracking-tight text-slate-900">{value}</p>
          <p className="mt-1 font-semibold text-slate-700">{metric.title}</p>
          <p className="mt-0.5 truncate text-xs text-slate-400">{metric.caption}</p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-all group-hover:bg-slate-900 group-hover:text-white">
          <ArrowUpRight size={17} />
        </div>
      </div>
    </Link>
  );
};

const AdminHome = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [unavailableServices, setUnavailableServices] = useState(0);
  const [currentTime, setCurrentTime] = useState(dayjs());

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(dayjs()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const fetchStats = useCallback(async ({ silent = false } = {}) => {
    silent ? setRefreshing(true) : setLoading(true);

    const requests = [
      ["totalUsers", "/tai-khoan"],
      ["totalBacSi", "/bacsi"],
      ["totalBenhNhan", "/benhnhan"],
      ["totalLichKham", "/lichkham"],
      ["totalHoaDon", "/hoadon"],
      ["totalThuoc", "/thuoc"],
      ["totalKhoa", "/khoa"],
      ["totalXetNghiem", "/xetnghiem"],
    ];

    const results = await Promise.allSettled(
      requests.map(([, endpoint]) => axios.get(endpoint)),
    );

    const nextStats = { ...EMPTY_STATS };
    let failed = 0;

    results.forEach((result, index) => {
      const [key] = requests[index];
      if (result.status === "fulfilled") {
        nextStats[key] = extractCount(result.value);
      } else {
        failed += 1;
      }
    });

    setStats(nextStats);
    setUnavailableServices(failed);
    setLastUpdated(dayjs());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const totalManagedRecords = useMemo(
    () => Object.values(stats).reduce((sum, value) => sum + Number(value || 0), 0),
    [stats],
  );

  const greeting = currentTime.hour() < 12
    ? "Chào buổi sáng"
    : currentTime.hour() < 18
      ? "Chào buổi chiều"
      : "Chào buổi tối";

  return (
    <div className="min-h-full bg-slate-50/80">
      <div className="mx-auto max-w-[1680px] space-y-6 p-4 sm:p-6 xl:p-8">
        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 px-5 py-6 text-white shadow-2xl shadow-blue-950/20 sm:px-7 sm:py-7 xl:px-9">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-500/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />

          <div className="relative grid gap-6 xl:grid-cols-[1fr_auto] xl:items-center">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-100 backdrop-blur">
                  <Sparkles size={14} />
                  Trung tâm điều hành Hospital P2TB
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
                  Hệ thống trực tuyến
                </span>
              </div>

              <p className="text-sm font-medium text-blue-200">{greeting},</p>
              <h1 className="mt-1 max-w-3xl text-3xl font-black tracking-tight sm:text-4xl xl:text-5xl">
                {getDisplayName(user)}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Theo dõi hoạt động bệnh viện, quản lý tài khoản và kiểm soát dữ liệu nghiệp vụ tập trung.
              </p>
            </div>

            <div className="grid min-w-[290px] grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-white/[0.07] p-3 backdrop-blur-xl sm:min-w-[360px]">
              <div className="rounded-xl bg-black/10 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-200">
                  <Clock3 size={15} /> Thời gian
                </div>
                <p className="mt-2 text-lg font-bold">{currentTime.format("HH:mm")}</p>
                <p className="text-xs text-slate-400">{currentTime.format("DD/MM/YYYY")}</p>
              </div>
              <div className="rounded-xl bg-black/10 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-200">
                  <Database size={15} /> Bản ghi
                </div>
                <p className="mt-2 text-lg font-bold">{totalManagedRecords}</p>
                <p className="text-xs text-slate-400">Đang quản lý</p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Tổng quan vận hành</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Dữ liệu hệ thống</h2>
              <p className="mt-1 text-sm text-slate-500">
                {lastUpdated
                  ? `Cập nhật lúc ${lastUpdated.format("HH:mm:ss, DD/MM/YYYY")}`
                  : "Đang đồng bộ dữ liệu từ các dịch vụ."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => fetchStats({ silent: true })}
              disabled={refreshing}
              className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Đang cập nhật" : "Làm mới dữ liệu"}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {loading
              ? Array.from({ length: 8 }, (_, index) => <MetricSkeleton key={index} />)
              : METRICS.map((metric) => (
                  <MetricCard key={metric.key} metric={metric} value={stats[metric.key]} />
                ))}
          </div>
        </section>

        <section>
          <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Lối tắt quản trị</p>
                <h2 className="mt-1 text-xl font-black text-slate-900">Thao tác nhanh</h2>
              </div>
              <Activity size={23} className="text-violet-500" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.title}
                    to={action.to}
                    className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-lg"
                  >
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${action.accent} text-white shadow-lg`}>
                      <Icon size={22} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900">{action.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500">{action.description}</p>
                    </div>
                    <ArrowUpRight size={18} className="shrink-0 text-slate-300 transition group-hover:text-slate-700" />
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className={`rounded-2xl border p-4 ${unavailableServices > 0 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${unavailableServices > 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                {unavailableServices > 0 ? <Bell size={18} /> : <CheckCircle2 size={18} />}
              </div>
              <div>
                <p className={`font-bold ${unavailableServices > 0 ? "text-amber-900" : "text-emerald-900"}`}>
                  {unavailableServices > 0
                    ? `${unavailableServices} nguồn dữ liệu chưa phản hồi`
                    : "Dữ liệu dashboard đã được đồng bộ"}
                </p>
                <p className={`mt-0.5 text-sm ${unavailableServices > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                  {unavailableServices > 0
                    ? "Một số API nghiệp vụ chưa triển khai trong Tuần 1 nên chỉ số tương ứng tạm hiển thị 0."
                    : "Các nguồn dữ liệu hiện tại đang hoạt động bình thường."}
                </p>
              </div>
            </div>
          </div>

          <Link
            to="/admin/taikhoan"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-blue-700"
          >
            Quản lý tài khoản
            <ArrowUpRight size={17} />
          </Link>
        </section>
      </div>
    </div>
  );
};

export default AdminHome;
