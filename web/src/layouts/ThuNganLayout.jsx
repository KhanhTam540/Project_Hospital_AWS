import React, { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import ChatWrapper from "../components/chat/ChatWrapper.jsx";
import ChatbotWidget from "../components/Chatbot/ChatbotWidget.jsx";
import {
  LayoutDashboard,
  Banknote,
  LogOut,
  Menu,
  X,
  UserCircle,
  Receipt,
} from "lucide-react";

const SidebarItem = ({ to, icon: Icon, label }) => {
  const location = useLocation();
  const isActive =
    location.pathname === to ||
    (to !== "/thungan" && location.pathname.startsWith(to));

  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 mb-1 font-medium group ${
        isActive
          ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/30"
          : "text-slate-300 hover:bg-slate-700 hover:text-white"
      }`}
    >
      <Icon size={20} />
      <span>{label}</span>
    </Link>
  );
};

const ThuNganLayout = () => {
  const { logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const tenDangNhap = localStorage.getItem("tenDangNhap") || "Thu ngân";

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-gradient-to-b from-emerald-900 to-teal-900 text-white transform transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } flex flex-col shadow-2xl`}
      >
        <div className="h-20 flex items-center justify-between px-6 border-b border-emerald-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
              <Receipt size={22} />
            </div>
            <div>
              <p className="font-bold text-sm">SmartHospital</p>
              <p className="text-xs text-emerald-300">Thu ngân</p>
            </div>
          </div>
          <button
            type="button"
            className="md:hidden text-emerald-300"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={22} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          <SidebarItem to="/thungan" icon={LayoutDashboard} label="Trang chủ" />
          <SidebarItem to="/thungan/thanhtoan" icon={Banknote} label="Thu viện phí" />
        </nav>

        <div className="p-4 border-t border-emerald-800">
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <UserCircle size={32} className="text-emerald-300" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{tenDangNhap}</p>
              <p className="text-xs text-emerald-400">THUNGAN</p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-300 hover:bg-red-900/30 rounded-lg"
          >
            <LogOut size={16} /> Đăng xuất
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 shrink-0">
          <button
            type="button"
            className="md:hidden p-2 text-gray-600"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={22} />
          </button>
          <p className="text-sm text-gray-500 hidden sm:block">Cổng thu ngân · Billing Dashboard</p>
          <div className="flex-1 md:flex-none" />
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-40">
        <ChatWrapper />
        <ChatbotWidget />
      </div>
    </div>
  );
};

export default ThuNganLayout;
