import { useState } from "react";
import { Search, Bell, Menu, ExternalLink } from "lucide-react";
import { useNavigate, useLocation, Link } from "react-router-dom";

interface TopbarProps {
  onMenuClick: () => void;
}

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/customers": "Customers",
  "/customers/new": "New Customer",
  "/subscriptions": "Subscriptions",
  "/requests": "Incoming Requests",
  "/reminders": "Reminders",
  "/history": "Renewal History",
  "/reports": "Reports",
  "/settings": "Settings",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/customers/") && pathname.endsWith("/edit")) return "Edit Customer";
  if (pathname.startsWith("/customers/")) return "Customer Detail";
  if (pathname.startsWith("/requests/")) return "Request Detail";
  return "CRMSync";
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  const pageTitle = getPageTitle(location.pathname);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/customers?search=${encodeURIComponent(searchTerm.trim())}`);
      setSearchTerm("");
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 shrink-0 z-30">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          onClick={onMenuClick}
          className="p-2 -ml-1 text-slate-400 hover:text-slate-700 md:hidden transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Page breadcrumb */}
        <div className="hidden sm:flex items-center gap-2 min-w-0">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Admin</span>
          <span className="text-slate-300">/</span>
          <span className="text-sm font-bold text-slate-800 truncate">{pageTitle}</span>
        </div>

        {/* Mobile: just title */}
        <span className="sm:hidden text-sm font-bold text-slate-800 truncate">{pageTitle}</span>
      </div>

      {/* Centre search */}
      <form onSubmit={handleSearch} className="hidden md:flex relative w-full max-w-xs mx-4">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-slate-400" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl leading-5 bg-slate-50 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 text-sm transition-all"
          placeholder="Search customers..."
        />
      </form>

      <div className="flex items-center gap-2">
        {/* View Public Form shortcut */}
        <Link
          to="/intake"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 py-1.5 px-3 rounded-xl transition-all"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Public Form</span>
        </Link>

        {/* Notifications */}
        <button className="relative p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />
          <Bell className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
