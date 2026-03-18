import { useState, useEffect, useMemo } from "react";
import { TrendingUp, Users, Calendar, PoundSterling, PieChart, BarChart2, Clock } from "lucide-react";
import * as db from "../../services/db";
import { motion } from "framer-motion";

export function Reports() {
  const [timeRange, setTimeRange] = useState<'6m' | '1y' | 'all'>('6m');
  const [stats, setStats] = useState({
    totalCustomers: 0,
    activeSubscriptions: 0,
    totalRevenue: 0,
    monthlyRecurringRevenue: 0,
    avgSubscriptionLength: 0,
    churnRate: 0,
    conversionRate: 0,
    avgLtv: 0,
    leadSources: [] as { label: string, count: number, percentage: number, color: string }[]
  });

  const [chartData, setChartData] = useState<{ month: string, amount: number }[]>([]);

  useEffect(() => {
    (async () => {
      const [customers, subscriptions, history] = await Promise.all([
        db.getCustomers(),
        db.getSubscriptions(),
        db.getRenewalHistory()
      ]);

    // Filter history based on time range
    const now = new Date();
    const filteredHistory = history.filter(h => {
      const date = new Date(h.renewedOn);
      if (timeRange === '6m') {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(now.getMonth() - 6);
        return date >= sixMonthsAgo;
      }
      if (timeRange === '1y') {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(now.getFullYear() - 1);
        return date >= oneYearAgo;
      }
      return true;
    });

    const activeSubs = subscriptions.filter(s => s.status === 'Active');
    const totalRev = filteredHistory.reduce((sum, h) => sum + h.amount, 0);
    
    // MRR calculation (simplified)
    const mrr = activeSubs.reduce((sum, s) => {
      const price = s.price;
      const months = parseInt(s.planDuration) || 1;
      return sum + (price / months);
    }, 0);

    // Avg Subscription Length calculation
    const lengths = subscriptions.map(s => {
      const start = new Date(s.startDate).getTime();
      const end = new Date(s.renewalDate).getTime();
      return (end - start) / (1000 * 60 * 60 * 24);
    });
    const avgLength = lengths.length > 0 ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) : 0;

    // Lead Sources calculation
    const sourceMap: { [key: string]: number } = {};
    customers.forEach(c => {
      sourceMap[c.leadSource] = (sourceMap[c.leadSource] || 0) + 1;
    });

    const totalC = customers.length || 1;
    const colorMap: { [key: string]: string } = {
      'WhatsApp': 'bg-emerald-500',
      'Reddit': 'bg-orange-500',
      'Referral': 'bg-indigo-500',
      'LinkedIn': 'bg-blue-600',
      'Website': 'bg-slate-400',
      'Other': 'bg-slate-300'
    };

    const labelMap: { [key: string]: string } = {
      'WhatsApp': 'WhatsApp',
      'Reddit': 'Reddit',
      'Referral': 'Referral',
      'LinkedIn': 'LinkedIn',
      'Website': 'Website',
      'Other': 'Other'
    };

    const leadSourcesData = Object.entries(sourceMap).map(([source, count]) => ({
      label: labelMap[source] || source,
      count,
      percentage: Math.round((count / totalC) * 100),
      color: colorMap[source] || 'bg-slate-400'
    })).sort((a, b) => b.count - a.count);

    const expiredCount = subscriptions.filter(s => {
      const daysLeft = (new Date(s.renewalDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return daysLeft < 0;
    }).length;
    const churn = subscriptions.length > 0 ? (expiredCount / subscriptions.length) * 100 : 0;
    const conv = customers.length > 0 ? (activeSubs.length / customers.length) * 100 : 0;

    setStats({
      totalCustomers: customers.length,
      activeSubscriptions: activeSubs.length,
      totalRevenue: totalRev,
      monthlyRecurringRevenue: Math.round(mrr),
      avgSubscriptionLength: avgLength,
      churnRate: Math.round(churn * 10) / 10,
      conversionRate: Math.round(conv * 10) / 10,
      avgLtv: totalC > 0 ? (history.reduce((sum, h) => sum + h.amount, 0) / totalC) : 0,
      leadSources: leadSourcesData
    });

    // Generate chart data
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const lastNMonths = timeRange === '6m' ? 6 : timeRange === '1y' ? 12 : 12;
    
    const data = [];
    for (let i = lastNMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      d.setMonth(d.getMonth() - i);
      const monthStr = monthNames[d.getMonth()] + " " + d.getFullYear().toString().slice(-2);
      
      const monthlyRev = history
        .filter(h => {
          const hDate = new Date(h.renewedOn);
          return hDate.getMonth() === d.getMonth() && hDate.getFullYear() === d.getFullYear();
        })
        .reduce((sum, h) => sum + h.amount, 0);
      
      data.push({ month: monthStr, amount: monthlyRev });
    }
    setChartData(data);

    })(); // end async IIFE
  }, [timeRange]);

  const maxAmount = useMemo(() => Math.max(...chartData.map(d => d.amount), 100), [chartData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">Analytics & Reports</h2>
          <p className="text-slate-500 text-sm mt-1">Deep dive into your business performance and growth metrics.</p>
        </div>
        <div className="flex bg-white p-1 rounded-2xl border border-slate-100 shadow-sm">
          {(['6m', '1y', 'all'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                timeRange === range 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {range === '6m' ? '6 Months' : range === '1y' ? '1 Year' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <ReportCard 
          title="Revenue" 
          value={`£${stats.totalRevenue.toLocaleString()}`} 
          change="+12.5%" 
          icon={<PoundSterling className="h-5 w-5 text-emerald-600" />}
          bgColor="bg-emerald-50"
        />
        <ReportCard 
          title="Est. MRR" 
          value={`£${stats.monthlyRecurringRevenue.toLocaleString()}`} 
          change="+5.2%" 
          icon={<TrendingUp className="w-5 h-5 text-indigo-600" />}
          bgColor="bg-indigo-50"
        />
        <ReportCard 
          title="Active Plans" 
          value={stats.activeSubscriptions.toString()} 
          change="+3" 
          icon={<Calendar className="w-5 h-5 text-blue-600" />}
          bgColor="bg-blue-50"
        />
        <ReportCard 
          title="Avg. Length" 
          value={`${stats.avgSubscriptionLength}d`} 
          change="+1.2%" 
          icon={<Clock className="w-5 h-5 text-indigo-600" />}
          bgColor="bg-indigo-50"
        />
        <ReportCard 
          title="Churn" 
          value={`${stats.churnRate}%`} 
          change="-0.4%" 
          icon={<PieChart className="w-5 h-5 text-amber-600" />}
          bgColor="bg-amber-50"
          inverseColor
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm p-8 flex flex-col h-[450px]">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-indigo-500" />
              Revenue Growth
            </h3>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
              {timeRange === '6m' ? 'Last 6 Months' : 'Annual View'}
            </div>
          </div>
          
          <div className="flex-1 flex items-end justify-between gap-2 px-2 pb-6">
            {chartData.map((data, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-3 group">
                <div className="relative w-full flex flex-col items-center justify-end h-full">
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: `${(data.amount / maxAmount) * 100}%` }}
                    transition={{ duration: 0.8, delay: idx * 0.1, ease: "easeOut" }}
                    className="w-full max-w-[40px] bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-xl shadow-lg shadow-indigo-100 group-hover:from-indigo-500 group-hover:to-indigo-300 transition-all cursor-pointer relative"
                  >
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl">
                      £{data.amount.toLocaleString()}
                    </div>
                  </motion.div>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter truncate w-full text-center">
                  {data.month}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 flex flex-col h-[450px]">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-500" />
            Lead Sources
          </h3>
          <div className="space-y-8 flex-1">
            {stats.leadSources.map((source, idx) => (
              <SourceProgress 
                key={idx}
                label={source.label} 
                percentage={source.percentage} 
                color={source.color} 
                count={source.count} 
              />
            ))}
            {stats.leadSources.length === 0 && (
              <div className="h-full flex items-center justify-center text-slate-400 italic text-sm">
                No lead source data available
              </div>
            )}
          </div>
          <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
             <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Avg LTV</p>
                <p className="text-xl font-black text-slate-900">£{stats.avgLtv.toFixed(2)}</p>
             </div>
            <div className="p-3 bg-indigo-50 rounded-2xl">
               <TrendingUp className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportCard({ title, value, change, icon, bgColor, inverseColor = false }: { 
  title: string, value: string, change: string, icon: React.ReactNode, bgColor: string, inverseColor?: boolean 
}) {
  const isPositive = change.startsWith('+');
  const textColor = inverseColor 
    ? (isPositive ? 'text-rose-600' : 'text-emerald-600')
    : (isPositive ? 'text-emerald-600' : 'text-rose-600');

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-xl ${bgColor} flex items-center justify-center`}>
          {icon}
        </div>
        <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${textColor} bg-opacity-10 tracking-tight`}>
          {change}
        </span>
      </div>
      <div className="mt-4">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{title}</p>
        <p className="text-2xl font-black text-slate-900 mt-1">{value}</p>
      </div>
    </div>
  );
}

function SourceProgress({ label, percentage, color, count }: { label: string, percentage: number, color: string, count: number }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-end">
        <div>
          <span className="text-xs font-bold text-slate-800 block">{label}</span>
          <span className="text-[10px] font-medium text-slate-400 uppercase">{count} {count === 1 ? 'customer' : 'customers'}</span>
        </div>
        <span className="text-sm font-black text-slate-900">{percentage}%</span>
      </div>
      <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className={`h-full ${color} rounded-full`} 
        />
      </div>
    </div>
  );
}
