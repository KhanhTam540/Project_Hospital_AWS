import React, { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import ChatWrapper from "../components/chat/ChatWrapper.jsx";
import ChatbotWidget from "../components/Chatbot/ChatbotWidget.jsx";
import { adminMenuSections, getAdminPath, ADMIN_BASE_PATH } from "../config/adminMenu";
import { Menu, X } from "lucide-react";
import SidebarAccount from "../components/navigation/SidebarAccount.jsx";

const SidebarItem = ({ to, icon: Icon, label, badge }) => {
  const location = useLocation();
  const isActive =
    location.pathname === to ||
    (to !== ADMIN_BASE_PATH && location.pathname.startsWith(to));

  return (
    <Link
      to={to}
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 mb-1 font-medium group relative
        ${
          isActive
            ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30"
            : "text-slate-300 hover:bg-slate-700 hover:text-white"
        }
      `}
    >
      <Icon size={20} className={isActive ? "text-white" : "text-slate-400 group-hover:text-white"} />
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{badge}</span>
      )}
    </Link>
  );
};

const MenuSection = ({ title, children }) => (
  <div className="mb-6">
    <div className="px-4 text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
      {title}
    </div>
    <div className="space-y-1">{children}</div>
  </div>
);

function AdminLayout() {
  const { logout, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50
          w-72 bg-gradient-to-b from-slate-900 to-slate-800 text-white 
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          flex flex-col shadow-2xl
        `}
      >
        <div className="h-20 flex items-center justify-between px-6 border-b border-slate-700 bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg ring-2 ring-blue-500/30">
              ⚕️
            </div>
            <div>
              <h1
                  className="font-bold text-lg leading-tight tracking-tight !text-white"
                  style={{ color: "#ffffff" }}
                  >
                  SmartHospital
              </h1>
              <span className="text-xs text-slate-400 font-medium tracking-wide">ADMIN PANEL</span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-slate-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
          {adminMenuSections.map((section) => (
            <MenuSection key={section.title} title={section.title}>
              {section.items.map((item) => (
                <SidebarItem
                  key={item.path || "dashboard"}
                  to={getAdminPath(item.path)}
                  icon={item.icon}
                  label={item.label}
                  badge={item.badge}
                />
              ))}
            </MenuSection>
          ))}
        </div>

        <div className="border-t border-slate-700/80 bg-slate-950/70 p-3">
          <SidebarAccount
            user={user}
            fallbackName="Admin P2TB"
            roleLabel="Quản trị viên"
            detailLabel={user?.email || "AWS Cognito"}
            onLogout={logout}
            accent="from-blue-500 to-violet-600"
          />
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden relative bg-gray-50">
        <header className="bg-white shadow-sm border-b border-gray-200 h-16 flex items-center px-4 md:hidden z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <Menu size={24} />
          </button>
          <span className="ml-3 font-bold text-gray-800 text-lg">Admin Panel</span>
        </header>

        <main className="flex-1 overflow-y-auto scroll-smooth bg-gray-50">
          <Outlet />
        </main>
      </div>

      <div className="fixed bottom-6 right-6 z-50 flex flex-row gap-4 justify-end items-end">
        <ChatWrapper />
        <ChatbotWidget />
      </div>
    </div>
  );
}

export default AdminLayout;
