import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Activity, AlertCircle, FileText, PoundSterling, Percent, ChevronRight, Send } from "lucide-react";
import * as db from "../services/db";
import type { Customer, Subscription } from "../types/index";
import { motion } from "framer-motion";
import { getDaysLeft, formatDaysLeft, getDaysLeftColorClass } from "../utils/dateUtils";
import { useToast } from "../components/ui/Toast";

function StatCard({ title, value, icon, bgColor, color, subValue }: { title: string, value: string, icon: React.ReactNode, bgColor: string, color: string, subValue?: string }) {
  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center justify-between group transition-all"
    >
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
        {subValue && <p className="text-xs text-slate-400 mt-1 font-medium">{subValue}</p>}
      </div>
      <div className={`w-14 h-14 rounded-2xl ${bgColor} flex items-center justify-center transition-transform group-hover:scale-110 duration-300`}>
        <div className={color}>{icon}</div>
      </div>
    </motion.div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [stats, setStats] = useState({
    activeCustomers: 0,
    dueToday: 0,
    dueThisWeek: 0,
    expired: 0,
    monthlyRevenue: 0,
    renewalRate: 0,
  });

  const [upcoming, setUpcoming] = useState<{sub: Subscription, customer: Customer | undefined}[]>([]);

  useEffect(() => {
    (async () => {
      const [customers, subs] = await Promise.all([
        db.getCustomers(),
        db.getSubscriptions()
      ]);

      const getSubStatus = (renewalDate: string): string => {
        const daysLeft = getDaysLeft(renewalDate);
        if (daysLeft < 0) return 'Expired';
        if (daysLeft === 0) return 'Due Today';
        if (daysLeft <= 7) return 'Due Soon';
        return 'Active';
      };

      const activeCustomers = customers.filter(c => {
        const customerSubs = subs.filter(s => s.customerId === c.id);
        const hasActiveSub = customerSubs.some(s => getSubStatus(s.renewalDate) !== 'Expired');
        return c.status === 'Active' || hasActiveSub;
      }).length;

      const dueToday = subs.filter(s => getSubStatus(s.renewalDate) === 'Due Today').length;
      const expiredCount = subs.filter(s => getSubStatus(s.renewalDate) === 'Expired').length;

      const monthlyRevenue = subs
        .filter(s => getSubStatus(s.renewalDate) !== 'Expired')
        .reduce((sum, s) => {
          const months = s.durationMonths || 1;
          return sum + (s.price / months);
        }, 0);

      const activeCount = subs.filter(s => getSubStatus(s.renewalDate) !== 'Expired').length;
      const renewalRateValue = activeCount + expiredCount > 0 
        ? Math.round((activeCount / (activeCount + expiredCount)) * 100) 
        : 0;

      const dueThisWeek = subs.filter(s => {
        const status = getSubStatus(s.renewalDate);
        return status === 'Due Soon';
      }).length;

      setStats({
        activeCustomers,
        dueToday,
        dueThisWeek,
        expired: expiredCount,
        monthlyRevenue,
        renewalRate: renewalRateValue,
      });

      // Build a quick customer lookup map
      const customerMap = new Map(customers.map(c => [c.id, c]));

      const upcomingSubs = subs
        .filter(s => {
          const status = getSubStatus(s.renewalDate);
          return status === 'Due Soon' || status === 'Due Today';
        })
        .map(sub => ({ sub, customer: customerMap.get(sub.customerId) }))
        .sort((a, b) => new Date(a.sub.renewalDate).getTime() - new Date(b.sub.renewalDate).getTime())
        .slice(0, 5);

      setUpcoming(upcomingSubs);
    })();
  }, []);

  const handleSendReminder = (customer: Customer, sub: Subscription) => {
    const phone = customer.whatsappNumber.replace(/[^0-9]/g, '');
    const daysLeft = getDaysLeft(sub.renewalDate);
    const message = encodeURIComponent(`Hi ${customer.fullName}, your ${sub.subscriptionType} plan is renewing ${daysLeft === 0 ? 'today' : daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`}. Price: £${sub.price}. Would you like to keep it active?`);
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
    showToast(`Reminder sent to ${customer.fullName}`, "success");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">Dashboard</h2>
          <p className="text-slate-500 text-sm mt-1">Overview of your business and pending renewals.</p>
        </div>
        <div className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full uppercase tracking-wider">
          Last updated: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard 
          title="Active Customers" 
          value={String(stats.activeCustomers)} 
          icon={<Users className="h-6 w-6" />} 
          bgColor="bg-indigo-50" 
          color="text-indigo-600" 
        />
        
        <StatCard 
          title="Due Today" 
          value={String(stats.dueToday)} 
          icon={<AlertCircle className="h-6 w-6" />} 
          bgColor="bg-rose-50" 
          color="text-rose-600" 
        />

        <StatCard 
          title="Due in 7 Days" 
          value={String(stats.dueThisWeek)} 
          icon={<Activity className="h-6 w-6" />} 
          bgColor="bg-amber-50" 
          color="text-amber-600" 
        />

        <StatCard 
          title="Expired" 
          value={String(stats.expired)} 
          icon={<FileText className="h-6 w-6" />} 
          bgColor="bg-slate-50" 
          color="text-slate-600" 
        />

        <StatCard 
          title="Monthly Revenue" 
          value={`£${Math.round(stats.monthlyRevenue)}`} 
          subValue="Projected"
          icon={<PoundSterling className="h-6 w-6" />} 
          bgColor="bg-emerald-50" 
          color="text-emerald-600" 
        />

        <StatCard 
          title="Renewal Rate" 
          value={`${stats.renewalRate}%`} 
          subValue="Healthy target: 80%+"
          icon={<Percent className="h-6 w-6" />} 
          bgColor="bg-blue-50" 
          color="text-blue-600" 
        />
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-50 flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-800">Upcoming Renewals</h3>
            <button 
              onClick={() => navigate('/subscriptions')}
              className="text-sm text-indigo-600 font-bold hover:underline"
            >
              View All
            </button>
          </div>
          <div className="responsive-table-container">
            <table className="w-full text-sm text-left align-middle border-collapse">
              <thead className="bg-slate-50/50 text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Customer</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Subscription Type</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Renewal</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Days Left</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {upcoming.map((item) => {
                  const daysLeft = getDaysLeft(item.sub.renewalDate);
                  return (
                    <tr key={item.sub.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {item.customer?.fullName || 'Unknown'}
                        </div>
                        <div className="text-xs text-slate-400 font-medium">{item.customer?.country}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight bg-indigo-50 text-indigo-700">
                          {item.sub.subscriptionType}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium whitespace-nowrap">
                        {new Date(item.sub.renewalDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${getDaysLeftColorClass(daysLeft)}`}>
                          {formatDaysLeft(daysLeft)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {item.customer && (
                            <button 
                              onClick={() => handleSendReminder(item.customer!, item.sub)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-emerald-600 hover:bg-emerald-50 hover:border-emerald-100 transition-all shadow-sm"
                              title="Send WhatsApp Reminder"
                            >
                              <Send className="w-3.5 h-3.5" />
                              Send Reminder
                            </button>
                          )}
                          <button 
                            onClick={() => navigate(`/customers/${item.sub.customerId}`)}
                            className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {upcoming.length === 0 && (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Activity className="w-8 h-8 text-slate-200" />
                </div>
                <p className="text-slate-400 font-medium italic">No upcoming renewals found.</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800">Health Overview</h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Real-time</span>
          </div>
          
          <div className="space-y-6 flex-1">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100/50">
              <div className="flex justify-between items-end mb-1">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-tight">Renewal Health</span>
                <span className="text-lg font-black text-emerald-600">{stats.renewalRate}%</span>
              </div>
              <div className="w-full bg-emerald-200/50 h-2 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.renewalRate}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="bg-emerald-500 h-full rounded-full" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100/50">
                <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Retention</div>
                <div className="text-xl font-black text-indigo-600">{stats.renewalRate > 0 ? 'Good' : 'N/A'}</div>
              </div>
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100/50">
                <div className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">Follow-ups</div>
                <div className="text-xl font-black text-amber-600">{stats.dueThisWeek}</div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-50">
            <p className="text-xs text-slate-400 leading-relaxed italic">
              * Calculations are based on active and expiring subscriptions in the current month.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
