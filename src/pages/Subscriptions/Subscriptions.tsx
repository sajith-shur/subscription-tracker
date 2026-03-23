import { useState, useEffect, useMemo } from "react";
import { 
  Search, AlertCircle, CheckCircle2, 
  Clock, XCircle, ArrowUpDown, 
  Edit, User, CreditCard, Send
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as db from "../../services/db";
import { useToast } from "../../components/ui/Toast";
import { getDaysLeft, formatDaysLeft, getDaysLeftColorClass } from "../../utils/dateUtils";
import { useLocalization } from "../../contexts/LocalizationContext";
import type { Customer, Subscription } from "../../types/index";
import { motion, AnimatePresence } from "framer-motion";

interface SubWithCustomer {
  sub: Subscription;
  customer: Customer | undefined;
}

type SortField = 'renewalDate' | 'price' | 'customerName';
type SortOrder = 'asc' | 'desc';

export function Subscriptions() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { formatCurrency, formatDate } = useLocalization();
  const [subs, setSubs] = useState<SubWithCustomer[]>([]);
  
  // Search and Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [durationFilter, setDurationFilter] = useState<string>("All");
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>('renewalDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Modal state
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  console.log('Subscriptions loaded', subs.length, selectedSubId, setSelectedSubId);

  const loadSubscriptions = async () => {
    const [allSubs, customers] = await Promise.all([
      db.getSubscriptions(),
      db.getCustomers()
    ]);
    const customerMap = new Map(customers.map(c => [c.id, c]));
    const mapped = allSubs.map(sub => ({
      sub,
      customer: customerMap.get(sub.customerId) as Customer | undefined
    }));
    setSubs(mapped);
  };

  useEffect(() => {
    loadSubscriptions();
  }, []);

  // Helper for Status Derivation
  const getSubStatus = (renewalDate: string): 'Active' | 'Due Soon' | 'Due Today' | 'Expired' => {
    const daysLeft = getDaysLeft(renewalDate);
    if (daysLeft < 0) return 'Expired';
    if (daysLeft === 0) return 'Due Today';
    if (daysLeft <= 7) return 'Due Soon';
    return 'Active';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-emerald-50 text-emerald-600 border-emerald-100/50';
      case 'Due Soon': return 'bg-amber-50 text-amber-600 border-amber-100/50';
      case 'Due Today': return 'bg-rose-50 text-rose-600 border-rose-100/50';
      case 'Expired': return 'bg-slate-100 text-slate-500 border-slate-200';
      default: return 'bg-slate-50 text-slate-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Active': return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'Due Soon': return <Clock className="w-3.5 h-3.5" />;
      case 'Due Today': return <AlertCircle className="w-3.5 h-3.5" />;
      case 'Expired': return <XCircle className="w-3.5 h-3.5" />;
      default: return null;
    }
  };

  // Summary Metrics
  const metrics = useMemo(() => {
    const counts = { active: 0, soon: 0, today: 0, expired: 0 };
    subs.forEach(({ sub }) => {
      const status = getSubStatus(sub.renewalDate);
      if (status === 'Active') counts.active++;
      else if (status === 'Due Soon') counts.soon++;
      else if (status === 'Due Today') counts.today++;
      else if (status === 'Expired') counts.expired++;
    });
    return counts;
  }, [subs]);

  // Derived Filtering and Sorting
  const filteredAndSortedSubs = useMemo(() => {
    return subs
      .filter(item => {
        const matchesSearch = 
          item.customer?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.customer?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.customer?.whatsappNumber?.includes(searchTerm);
        
        const status = getSubStatus(item.sub.renewalDate);
        const matchesStatus = statusFilter === "All" || status === statusFilter;
        const matchesType = typeFilter === "All" || item.sub.subscriptionType === typeFilter;
        const matchesDuration = durationFilter === "All" || item.sub.durationMonths?.toString() === durationFilter;

        return matchesSearch && matchesStatus && matchesType && matchesDuration;
      })
      .sort((a, b) => {
        let comparison = 0;
        if (sortField === 'renewalDate') {
          comparison = new Date(a.sub.renewalDate).getTime() - new Date(b.sub.renewalDate).getTime();
        } else if (sortField === 'price') {
          comparison = a.sub.price - b.sub.price;
        } else if (sortField === 'customerName') {
          comparison = (a.customer?.fullName || "").localeCompare(b.customer?.fullName || "");
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [subs, searchTerm, statusFilter, typeFilter, durationFilter, sortField, sortOrder]);

  const handleToggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleSendReminder = (item: SubWithCustomer) => {
    if (!item.customer) return;
    const phone = item.customer.whatsappNumber.replace(/[^0-9]/g, '');
    const daysLeft = getDaysLeft(item.sub.renewalDate);
    const message = encodeURIComponent(`Hi ${item.customer.fullName}, your ${item.sub.subscriptionType} plan is renewing ${daysLeft === 0 ? 'today' : daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`}. Price: ${formatCurrency(item.sub.price)}. Would you like to keep it active?`);
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
    showToast(`Reminder flow opened for ${item.customer.fullName}`, "info");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900 leading-tight">Subscriptions</h1>
        <p className="text-slate-500 text-sm">Track all active, upcoming, and expired customer subscriptions.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Active Subscriptions" value={metrics.active} icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />} bgColor="bg-emerald-50" />
        <MetricCard title="Due in 7 Days" value={metrics.soon} icon={<Clock className="w-5 h-5 text-amber-600" />} bgColor="bg-amber-50" />
        <MetricCard title="Due Today" value={metrics.today} icon={<AlertCircle className="w-5 h-5 text-rose-600" />} bgColor="bg-rose-50" />
        <MetricCard title="Expired" value={metrics.expired} icon={<XCircle className="w-5 h-5 text-slate-600" />} bgColor="bg-slate-50" />
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search customers, email, or phone..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <FilterSelect 
              value={typeFilter} 
              onChange={setTypeFilter} 
              options={["All", "Premium Career", "Premium Business", "Premium Company Page", "Recruiter Lite", "Sales Navigator Core", "Sales Navigator Advanced", "Sales Navigator Advanced Plus"]} 
              label="Type"
            />
            <FilterSelect 
              value={durationFilter} 
              onChange={setDurationFilter} 
              options={["All", "1", "2", "3", "4", "6", "9", "12"]} 
              label="Duration"
              formatOption={(opt) => opt === 'All' ? 'All Durations' : `${opt} month${opt !== '1' ? 's' : ''}`}
            />
            <FilterSelect 
              value={statusFilter} 
              onChange={setStatusFilter} 
              options={["All", "Active", "Due Soon", "Due Today", "Expired"]} 
              label="Status"
            />
          </div>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400">
                <th className="px-6 py-4">
                  <button onClick={() => handleToggleSort('customerName')} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest hover:text-indigo-600 transition-colors">
                    Customer
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest">Subscription Type</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest">Duration</th>
                <th className="px-6 py-4">
                  <button onClick={() => handleToggleSort('price')} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest hover:text-indigo-600 transition-colors">
                    Price
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest">Start Date</th>
                <th className="px-6 py-4">
                  <button onClick={() => handleToggleSort('renewalDate')} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest hover:text-indigo-600 transition-colors">
                    Renewal Date
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <AnimatePresence mode="popLayout">
                {filteredAndSortedSubs.map((item) => {
                  const daysLeft = getDaysLeft(item.sub.renewalDate);
                  const status = getSubStatus(item.sub.renewalDate);
                  return (
                    <motion.tr 
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      key={item.sub.id} 
                      className="hover:bg-slate-50/30 transition-colors group"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center font-bold text-xs ring-1 ring-indigo-100">
                            {item.customer?.fullName?.charAt(0) || '?'}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 block truncate text-sm">{item.customer?.fullName}</span>
                            <span className="text-[10px] text-slate-400 font-medium truncate block">{item.customer?.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-bold text-slate-600 text-sm">{item.sub.subscriptionType}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-xs font-semibold text-slate-500">{item.sub.durationMonths} {item.sub.durationMonths === 1 ? 'month' : 'months'}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="font-black text-slate-900 text-sm">{formatCurrency(item.sub.price)}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-xs text-slate-500 font-medium">{formatDate(item.sub.startDate)}</span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-slate-900">
                            {formatDate(item.sub.renewalDate)}
                          </div>
                          <div className={`text-[10px] font-bold uppercase tracking-tight ${getDaysLeftColorClass(daysLeft).split(' ')[0]}`}>
                            {formatDaysLeft(daysLeft)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex justify-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${getStatusColor(status)}`}>
                            {getStatusIcon(status)}
                            {status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={() => handleSendReminder(item)}
                            className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                            title="Send WhatsApp Reminder"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => navigate(`/customers/${item.sub.customerId}/edit`)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                            title="Edit Subscription"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => navigate(`/customers/${item.sub.customerId}`)}
                            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
                            title="View Customer"
                          >
                            <User className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
          {filteredAndSortedSubs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                <CreditCard className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No subscriptions found</h3>
              <p className="text-slate-500 text-sm max-w-[280px] mt-1">
                Add a customer subscription to start tracking renewals.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon, bgColor }: { title: string, value: number, icon: React.ReactNode, bgColor: string }) {
  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center justify-between">
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <p className="text-3xl font-black text-slate-900">{value}</p>
      </div>
      <div className={`w-12 h-12 rounded-2xl ${bgColor} flex items-center justify-center`}>
        {icon}
      </div>
    </div>
  );
}

function FilterSelect({ value, onChange, options, label, formatOption }: { 
  value: string, 
  onChange: (val: string) => void, 
  options: string[], 
  label: string,
  formatOption?: (opt: string) => string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      <select 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="py-1.5 pl-3 pr-8 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 outline-none appearance-none cursor-pointer"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\' /%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '0.75rem' }}
      >
        {options.map(opt => (
          <option key={opt} value={opt}>{formatOption ? formatOption(opt) : opt}</option>
        ))}
      </select>
    </div>
  );
}
