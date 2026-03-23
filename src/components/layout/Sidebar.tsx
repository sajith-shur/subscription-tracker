import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Users, CreditCard, BellRing, History, PieChart, Settings, ChevronLeft, ChevronRight, Inbox, LogOut, Package, DollarSign } from "lucide-react";
import { cn } from "../../utils/cn";
import { useAuth } from "../../contexts/AuthContext";
import { motion } from "framer-motion";
import { collection, query, where, getCountFromServer } from "firebase/firestore";
import { db as firestore } from "../../services/firebase";

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (val: boolean) => void;
  mobileOpen?: boolean;
}

interface NavGroup {
  label: string;
  items: { name: string; href: string; icon: any; badge?: number }[];
}

export function Sidebar({ isCollapsed, setIsCollapsed, mobileOpen }: SidebarProps) {
  const { logout } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const fetchPending = async () => {
      try {
        const q = query(collection(firestore, "requests"), where("status", "==", "Pending"));
        const snap = await getCountFromServer(q);
        setPendingCount(snap.data().count);
      } catch {
        // silently fail — not critical
      }
    };
    fetchPending();
  }, []);

  const navGroups: NavGroup[] = [
    {
      label: "Overview",
      items: [
        { name: "Dashboard", href: "/", icon: LayoutDashboard },
      ],
    },
    {
      label: "Sales Pipeline",
      items: [
        { name: "Incoming Requests", href: "/requests", icon: Inbox, badge: pendingCount },
      ],
    },
    {
      label: "CRM",
      items: [
        { name: "Customers", href: "/customers", icon: Users },
        { name: "Subscriptions", href: "/subscriptions", icon: CreditCard },
        { name: "Renewal History", href: "/history", icon: History },
        { name: "Reminders", href: "/reminders", icon: BellRing },
      ],
    },
    {
      label: "Inventory",
      items: [
        { name: "Live Stock", href: "/inventory", icon: Package },
      ],
    },
    {
      label: "Finance",
      items: [
        { name: "USDT Purchases", href: "/finance/usdt", icon: DollarSign },
        { name: "Profit Reports", href: "/reports/profit", icon: PieChart },
      ],
    },
    {
      label: "System",
      items: [
        { name: "Products", href: "/settings/products", icon: Settings },
        { name: "Settings", href: "/settings", icon: Settings },
      ],
    },
  ];

  return (
    <aside
      className={cn(
        "bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 ease-in-out fixed inset-y-0 left-0 z-50 md:sticky md:block",
        isCollapsed ? "w-20" : "w-64",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}
    >
      {/* Logo */}
      <div className={cn("p-5 flex items-center justify-between border-b border-slate-800/60", isCollapsed && "px-4 justify-center")}>
        {!isCollapsed ? (
          <div className="animate-in fade-in duration-500 flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-indigo-500/20 shrink-0">
              C
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight leading-none">CRM<span className="text-indigo-400">Sync</span></h1>
              <span className="text-[9px] font-black tracking-widest text-indigo-400/70 uppercase">Admin Panel</span>
            </div>
          </div>
        ) : (
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-lg mx-auto shadow-lg shadow-indigo-500/20">
            C
          </div>
        )}
      </div>

      {/* Nav Groups */}
      <nav className="flex-1 px-3 mt-6 space-y-7 overflow-y-auto custom-scrollbar pb-10">
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-2">
            {!isCollapsed && (
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500/80 px-3 flex items-center gap-2">
                <span className="w-1.5 h-[1px] bg-indigo-500/30"></span>
                {group.label}
              </p>
            )}
            {isCollapsed && <div className="border-t border-slate-800/50 mt-2 mb-2" />}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    end={item.href === "/"}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center px-3 py-2.5 text-sm font-bold rounded-xl transition-all group relative duration-200",
                        isActive
                          ? "bg-indigo-600 text-white shadow-[0_4px_12px_rgba(79,70,229,0.3)] ring-1 ring-white/10"
                          : "text-slate-500 hover:bg-slate-800/40 hover:text-white"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <motion.div 
                            layoutId="activeNavIndicator"
                            className="absolute left-0 w-1.5 h-6 bg-indigo-400 rounded-r-full shadow-[2px_0_8px_rgba(129,140,248,0.5)]" 
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                          />
                        )}
                        <Icon className={cn("h-[18px] w-[18px] flex-shrink-0 transition-transform group-hover:scale-110", !isCollapsed && "mr-3")} />
                        {!isCollapsed && (
                          <span className="flex-1 animate-in slide-in-from-left-2 duration-300">{item.name}</span>
                        )}
                        {/* Badge */}
                        {!isCollapsed && item.badge != null && item.badge > 0 && (
                          <span className={cn(
                            "ml-auto text-[10px] font-black min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 shadow-sm",
                            isActive ? "bg-white text-indigo-600" : "bg-rose-500 text-white"
                          )}>
                            {item.badge}
                          </span>
                        )}
                        {isCollapsed && item.badge != null && item.badge > 0 && (
                          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-slate-900" />
                        )}
                        {/* Collapsed tooltip */}
                        {isCollapsed && (
                          <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-[11px] rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl border border-slate-700">
                            {item.name}
                            {item.badge != null && item.badge > 0 && (
                              <span className="ml-1.5 bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{item.badge}</span>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800/50">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:flex w-full items-center justify-center p-2 rounded-xl bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white transition-all mb-4"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        <div className={cn("flex items-center", isCollapsed && "justify-center")}>
          <div className="w-9 h-9 rounded-xl bg-indigo-500 flex items-center justify-center text-white font-black text-xs shadow-inner shadow-indigo-400 shrink-0">
            AD
          </div>
          {!isCollapsed && (
            <div className="ml-3 animate-in fade-in duration-300 min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate">Admin User</p>
              <p className="text-[10px] text-slate-500 font-medium">Strategic Tier</p>
            </div>
          )}
          {!isCollapsed && (
            <button
              onClick={() => logout()}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-auto group/logout"
              title="Log out"
            >
              <LogOut className="w-4 h-4 transition-transform group-hover/logout:translate-x-0.5" />
            </button>
          )}
          {isCollapsed && (
            <button
              onClick={() => logout()}
              className="absolute -top-2 -right-2 p-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-full border border-slate-700 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity"
              title="Log out"
            >
              <LogOut className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
