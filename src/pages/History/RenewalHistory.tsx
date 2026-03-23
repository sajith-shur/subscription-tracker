import { useState, useEffect, useMemo } from "react";
import {
  History, Search, Download, TrendingUp,
  CreditCard, DollarSign, BarChart2, RefreshCw,
  ChevronLeft, ChevronRight, User,
  ExternalLink, FileText
} from "lucide-react";
import * as db from "../../services/db";
import { useToast } from "../../components/ui/Toast";
import { useNavigate } from "react-router-dom";
import { useLocalization } from "../../contexts/LocalizationContext";
import type { RenewalHistory, Customer } from "../../types/index";

type EnrichedHistory = RenewalHistory & { customer?: Customer };

const PLAN_META: Record<string, { label: string; color: string }> = {
  "1M": { label: "1 Month",   color: "bg-slate-100 text-slate-600" },
  "2M": { label: "2 Months",  color: "bg-blue-50 text-blue-600" },
  "3M": { label: "3 Months",  color: "bg-indigo-50 text-indigo-700" },
  "6M": { label: "6 Months",  color: "bg-violet-50 text-violet-700" },
  "9M": { label: "9 Months",  color: "bg-purple-50 text-purple-700" },
  "12M": { label: "12 Months", color: "bg-emerald-50 text-emerald-700" },
};

const PAGE_SIZE = 10;

export function RenewalHistoryPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { formatCurrency, formatDate } = useLocalization();

  const [history, setHistory] = useState<EnrichedHistory[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPlan, setFilterPlan] = useState("All");
  const [filterPayment, setFilterPayment] = useState("All");
  const [filterDate, setFilterDate] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    (async () => {
      const [allHistory, customers] = await Promise.all([
        db.getRenewalHistory(),
        db.getCustomers()
      ]);
      const customerMap = new Map(customers.map((c: Customer) => [c.id, c]));
      const enriched = allHistory
        .map((h: RenewalHistory) => ({ ...h, customer: customerMap.get(h.customerId) as Customer | undefined }))
        .sort((a: EnrichedHistory, b: EnrichedHistory) => new Date(b.renewedOn).getTime() - new Date(a.renewedOn).getTime());
      setHistory(enriched);
    })();
  }, []);

  // Unique values for filter dropdowns
  const allPlans = useMemo(() => ["All", ...Array.from(new Set(history.map(h => h.newPlan)))], [history]);
  const allPayments = useMemo(() => ["All", ...Array.from(new Set(history.map(h => h.paymentMethod).filter(Boolean)))], [history]);

  // Date range filter
  const dateRanges: Record<string, number | null> = {
    all: null,
    "7d": 7,
    "30d": 30,
    "90d": 90,
  };

  const filtered = useMemo(() => {
    const now = Date.now();
    const days = dateRanges[filterDate];
    return history.filter(h => {
      const nameMatch = !searchTerm || h.customer?.fullName.toLowerCase().includes(searchTerm.toLowerCase());
      const planMatch = filterPlan === "All" || h.newPlan === filterPlan;
      const payMatch = filterPayment === "All" || h.paymentMethod === filterPayment;
      const dateMatch = !days || (now - new Date(h.renewedOn).getTime()) <= days * 86400000;
      return nameMatch && planMatch && payMatch && dateMatch;
    });
  }, [history, searchTerm, filterPlan, filterPayment, filterDate]);

  // KPI calculations
  const totalRevenue = filtered.reduce((s, h) => s + h.amount, 0);
  const avgValue = filtered.length > 0 ? totalRevenue / filtered.length : 0;
  const thisMonthRevenue = useMemo(() => {
    const now = new Date();
    return history
      .filter(h => {
        const d = new Date(h.renewedOn);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, h) => s + h.amount, 0);
  }, [history]);
  const renewalsThisMonth = useMemo(() => {
    const now = new Date();
    return history.filter(h => {
      const d = new Date(h.renewedOn);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, [history]);

  // Revenue chart data — last 6 months
  const chartData = useMemo(() => {
    const months: { label: string; key: string; amount: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = d.toLocaleString("default", { month: "short" });
      const amount = history
        .filter(h => {
          const hd = new Date(h.renewedOn);
          return hd.getMonth() === d.getMonth() && hd.getFullYear() === d.getFullYear();
        })
        .reduce((s, h) => s + h.amount, 0);
      months.push({ label, key, amount });
    }
    return months;
  }, [history]);
  const maxChartAmt = Math.max(...chartData.map(d => d.amount), 1);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExportCSV = () => {
    if (filtered.length === 0) { showToast("No data to export.", "error"); return; }
    try {
      const headers = ["ID", "Customer", "Plan", "Billing Period", "Date", "Amount", "Payment Method", "Notes"];
      const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const rows = filtered.map(h => [
        h.id, h.customer?.fullName || 'Unknown',
        h.newPlan, PLAN_META[h.newPlan]?.label || h.newPlan,
        new Date(h.renewedOn).toLocaleDateString("en-GB"),
        h.amount.toFixed(2), h.paymentMethod, h.notes || ''
      ]);
      const csv = [headers.map(escape).join(","), ...rows.map(r => r.map(escape).join(","))].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `renewal_history_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast(`Exported ${filtered.length} records.`, "success");
    } catch { showToast("Export failed.", "error"); }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <History className="w-6 h-6 text-indigo-600" />
            Renewal History
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">Track all subscription transactions and revenue.</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all shadow-sm"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Transactions" value={String(filtered.length)} icon={<FileText className="w-5 h-5 text-indigo-500" />} bgColor="bg-indigo-50" />
        <KpiCard label="Total Revenue" value={formatCurrency(totalRevenue)} icon={<TrendingUp className="w-5 h-5 text-emerald-500" />} bgColor="bg-emerald-50" highlight />
        <KpiCard label="Avg Transaction" value={formatCurrency(avgValue)} icon={<DollarSign className="w-5 h-5 text-blue-500" />} bgColor="bg-blue-50" />
        <KpiCard label="Renewals This Month" value={`${renewalsThisMonth} · ${formatCurrency(thisMonthRevenue)}`} icon={<RefreshCw className="w-5 h-5 text-violet-500" />} bgColor="bg-violet-50" />
      </div>

      {/* Revenue Chart */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-indigo-50 rounded-2xl"><BarChart2 className="w-5 h-5 text-indigo-600" /></div>
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Revenue Trend</h3>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Last 6 months · renewal income</p>
          </div>
        </div>
        <div className="flex items-end gap-3 h-36">
          {chartData.map(d => (
            <div key={d.key} className="flex-1 flex flex-col items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400">{d.amount > 0 ? formatCurrency(d.amount) : ''}</span>
              <div className="w-full rounded-t-xl bg-indigo-100 overflow-hidden relative" style={{ height: '80px' }}>
                <div
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-xl transition-all duration-700"
                  style={{ height: `${d.amount === 0 ? 0 : Math.max((d.amount / maxChartAmt) * 100, 4)}%` }}
                />
              </div>
              <span className="text-[11px] font-bold text-slate-500">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filters + Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Filter Bar */}
        <div className="p-6 border-b border-slate-50 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search customer..."
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 transition-all"
              />
            </div>
            {/* Plan filter */}
            <FilterSelect label="Plan" value={filterPlan} options={allPlans} onChange={v => { setFilterPlan(v); setPage(1); }} />
            {/* Payment filter */}
            <FilterSelect label="Payment" value={filterPayment} options={allPayments} onChange={v => { setFilterPayment(v); setPage(1); }} />
            {/* Date filter */}
            <FilterSelect label="Period" value={filterDate} options={["all", "7d", "30d", "90d"]} labels={{ all: "All Time", "7d": "Last 7 Days", "30d": "Last 30 Days", "90d": "Last 90 Days" }} onChange={v => { setFilterDate(v); setPage(1); }} />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-400">
              Showing {filtered.length > 0 ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)}` : "0"} of {filtered.length} transactions
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/80 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Subscription Plan</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Billing Period</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment Method</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Notes</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginated.map(entry => {
                const planMeta = PLAN_META[entry.newPlan] || { label: entry.newPlan, color: "bg-slate-100 text-slate-600" };
                const initials = (entry.customer?.fullName || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
                const noteParts = (entry.notes || '').split(':');
                return (
                  <tr key={entry.id} className="hover:bg-slate-50/60 transition-colors group">
                    {/* Customer */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs flex-shrink-0">
                          {initials}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm leading-tight">{entry.customer?.fullName || 'Unknown'}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{entry.customer?.leadSource || ''}</p>
                        </div>
                      </div>
                    </td>
                    {/* Subscription Plan */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {entry.notes && entry.notes.includes(':') ? (
                          <span className="text-xs font-bold text-slate-800">
                            {noteParts.slice(1).join(':').trim()}
                          </span>
                        ) : null}
                        <span className="text-[10px] text-slate-400 font-medium">Subscription</span>
                      </div>
                    </td>
                    {/* Billing Period */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider ${planMeta.color}`}>
                        {planMeta.label}
                      </span>
                    </td>
                    {/* Date */}
                    <td className="px-6 py-4 text-slate-600 font-medium text-xs whitespace-nowrap">
                      {formatDate(entry.renewedOn)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-black text-emerald-600 text-sm">
                        {formatCurrency(entry.amount)}
                      </span>
                    </td>
                    {/* Payment Method */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-bold text-slate-600 capitalize">{entry.paymentMethod || '—'}</span>
                      </div>
                    </td>
                    {/* Notes */}
                    <td className="px-6 py-4 max-w-[180px]">
                      {entry.notes ? (
                        <div>
                          <p className="text-[10px] text-slate-400 font-medium truncate">{noteParts[0]?.trim()}</p>
                          {noteParts[1] && <p className="text-xs font-bold text-slate-700 truncate">{noteParts.slice(1).join(':').trim()}</p>}
                        </div>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {entry.customerId && (
                          <button
                            onClick={() => navigate(`/customers/${entry.customerId}`)}
                            className="p-2 hover:bg-indigo-50 rounded-xl transition-all"
                            title="View Customer"
                          >
                            <User className="w-3.5 h-3.5 text-indigo-500" />
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/subscriptions`)}
                          className="p-2 hover:bg-slate-100 rounded-xl transition-all"
                          title="View Subscriptions"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Empty state */}
          {filtered.length === 0 && (
            <div className="p-16 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mb-5">
                <History className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-black text-slate-800">No renewal history yet</h3>
              <p className="text-slate-400 text-sm mt-2 max-w-sm leading-relaxed">
                When customers renew subscriptions, their transactions will appear here.
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-50 bg-slate-50/40">
            <p className="text-[11px] font-bold text-slate-400">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="p-2 rounded-xl border border-slate-200 hover:bg-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => Math.abs(p - page) <= 2).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${p === page ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'border border-slate-200 text-slate-600 hover:bg-white'}`}
                >
                  {p}
                </button>
              ))}
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                className="p-2 rounded-xl border border-slate-200 hover:bg-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon, bgColor, highlight = false }: { label: string; value: string; icon: React.ReactNode; bgColor: string; highlight?: boolean }) {
  return (
    <div className={`bg-white rounded-3xl border p-6 shadow-sm flex items-center justify-between gap-4 ${highlight ? 'border-emerald-100 shadow-emerald-50' : 'border-slate-100'}`}>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{label}</p>
        <p className={`text-xl font-black ${highlight ? 'text-emerald-600' : 'text-slate-900'}`}>{value}</p>
      </div>
      <div className={`w-12 h-12 rounded-2xl ${bgColor} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
    </div>
  );
}

function FilterSelect({ label, value, options, labels, onChange }: {
  label: string;
  value: string;
  options: string[];
  labels?: Record<string, string>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-2xl border border-transparent focus-within:border-indigo-100 transition-all">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-transparent border-none text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
      >
        {options.map(o => (
          <option key={o} value={o}>{labels ? labels[o] || o : o}</option>
        ))}
      </select>
    </div>
  );
}
