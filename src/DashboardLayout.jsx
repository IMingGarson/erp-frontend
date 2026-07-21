import React, { useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  ClipboardList,
  PackageOpen,
  Database,
  Building2,
  LogOut,
  ShoppingCart,
  Factory,
  ShieldAlert,
  Users,
  PackageCheck,
  FileText,
} from "lucide-react";
import { useAuthStore } from "./store/authStore";

const MENU_GROUPS = [
  {
    group: "營運資料",
    items: [
      { path: "/", label: "批號與庫存監控", icon: Activity },
      { path: "/materials", label: "品項與物料管理", icon: Database },
      { path: "/vendors", label: "客戶名錄管理", icon: Building2 },
      { path: "/trace", label: "追蹤追溯", icon: ShieldAlert },
    ],
  },
  {
    group: "生產與需求",
    items: [
      { path: "/requirement", label: "物料需求單管理", icon: ClipboardList },
      { path: "/production", label: "生產單管理", icon: FileText },
      { path: "/delivery-notes", label: "銷貨單管理", icon: PackageCheck },
      {
        path: "/purchase-requisitions",
        label: "請購單管理",
        icon: ShoppingCart,
      },
    ],
  },
  {
    group: "系統管理",
    items: [{ path: "/users", label: "系統帳號管理", icon: Users }],
  },
];

const DEPARTMENT_MAP = {
  admin: "行政",
  manufacturing: "製造",
  rd: "研發",
  purchasing: "採購",
  employer: "老闆",
};

export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const rawDepartment = user?.department?.toLowerCase() || "";
  const displayDepartment = DEPARTMENT_MAP[rawDepartment];

  useEffect(() => {
    if (!user || !displayDepartment) {
      console.warn("異常狀態：查無使用者或部門未對應，強制登出");
      logout();
      navigate("/login", { replace: true });
    }
  }, [user, displayDepartment, logout, navigate]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (!user || !displayDepartment) {
    return null;
  }

  const username = user.username || "Guest";
  const avatarInitials = username.substring(0, 2).toUpperCase();

  return (
    <div className="flex h-screen print:h-auto bg-slate-50 font-sans overflow-hidden print:overflow-visible">
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0 shadow-2xl z-20 print:hidden">
        <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-950/50">
          <h1 className="font-black text-2xl tracking-wider text-blue-400">
            ERP<span className="text-white">System</span>
          </h1>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-8 overflow-y-auto custom-scrollbar">
          {MENU_GROUPS.map((group, idx) => (
            <div key={idx}>
              <h3 className="px-3 mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                {group.group}
              </h3>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  const Icon = item.icon;
                  return (
                    <li key={item.path}>
                      <Link
                        to={item.path}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? "bg-blue-600 text-white shadow-md"
                            : "text-slate-400 hover:bg-slate-800 hover:text-white"
                        }`}
                      >
                        <Icon
                          className={`w-5 h-5 ${isActive ? "text-white" : "text-slate-400"}`}
                        />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div
          onClick={handleLogout}
          className="p-4 border-t border-slate-800 bg-slate-900 hover:bg-slate-800 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-blue-400 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-inner flex-shrink-0">
                {avatarInitials}
              </div>

              <div className="overflow-hidden flex-1">
                <div className="text-sm font-bold text-white truncate group-hover:text-blue-400 transition-colors">
                  {username}
                </div>
                <div className="text-xs text-slate-400 truncate">
                  {displayDepartment}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-slate-500 group-hover:text-red-400 transition-colors flex-shrink-0">
              <span className="text-xs font-medium">登出</span>
              <LogOut className="w-4 h-4" />
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 print:block">
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
