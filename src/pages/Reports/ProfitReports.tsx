import { useState, useEffect } from "react";
import {
  TrendingUp, DollarSign, Calendar, ArrowUpRight,
  BarChart3, PieChart, Download
} from "lucide-react";
import * as db from "../../services/db";
import { useLocalization } from "../../contexts/LocalizationContext";
import type { Subscription } from "../../types/index";

export function ProfitReports() {
  const { formatCurrency, formatDate } = useLocalization();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const subs = await db.getSubscriptions();
        setSubscriptions(subs);
      } catch (error) {
        console.error("Failed to load report data:", error);
      }
    };
    loadData();
  }, []);

  const totalRevenue = subscriptions.reduce((sum, s) => sum + s.price, 0);
  const totalCostGbp = subscriptions.reduce((sum, s) => sum + (s.costGbp || 0), 0);
  const totalProfit = totalRevenue - totalCostGbp;
  const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  // Monthly breakdown (simple version)
  const monthlyData = subscriptions.reduce((acc: any, sub) => {
    const month = new Date(sub.startDate).toLocaleString('default', { month: 'short', year: '2-digit' });
    if (!acc[month]) acc[month] = { revenue: 0, profit: 0, count: 0 };
    acc[month].revenue += sub.price;
    acc[month].profit += sub.profitGbp || 0;
    acc[month].count += 1;
    return acc;
  }, {});

  const sortedMonths = Object.keys(monthlyData).sort((a, b) => {
    const dateA = new Date(a);
    const dateB = new Date(b);
    return dateA.getTime() - dateB.getTime();
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Profit Reports</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Detailed financial performance overview</p>
        </div>
        <div className="flex gap-2">
          <button className="p-2 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-indigo-600 transition-colors">
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total Revenue</p>
          <div className="text-2xl font-black text-slate-900">{formatCurrency(totalRevenue)}</div>
          <div className="flex items-center gap-1 mt-2 text-emerald-600 text-xs font-bold">
            <ArrowUpRight className="w-3 h-3" />
            <span>Growth trend</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total Cost ({formatCurrency(0).replace(/[0-9.]/g, '')})</p>
          <div className="text-2xl font-black text-slate-900">{formatCurrency(totalCostGbp)}</div>
          <div className="flex items-center gap-1 mt-2 text-slate-400 text-xs font-bold">
            <Calendar className="w-3 h-3" />
            <span>Inventory basis</span>
          </div>
        </div>
        <div className="bg-indigo-600 rounded-2xl p-6 shadow-lg shadow-indigo-100">
          <p className="text-xs font-black text-white/70 uppercase tracking-widest mb-1">Net Profit</p>
          <div className="text-2xl font-black text-white">{formatCurrency(totalProfit)}</div>
          <div className="flex items-center gap-1 mt-2 text-indigo-200 text-xs font-bold">
            <TrendingUp className="w-3 h-3" />
            <span>ROI focused</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Avg. Margin</p>
          <div className="text-2xl font-black text-slate-900">{margin.toFixed(1)}%</div>
          <div className="flex items-center gap-1 mt-2 text-indigo-600 text-xs font-bold">
            <BarChart3 className="w-3 h-3" />
            <span>Efficiency</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-8">
            <PieChart className="w-4 h-4 text-indigo-600" /> Monthly Growth
          </h3>
          <div className="space-y-6">
            {sortedMonths.reverse().map(month => (
              <div key={month} className="flex items-center gap-4">
                <div className="w-16 text-xs font-black text-slate-400 uppercase">{month}</div>
                <div className="flex-1 flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-slate-500">Revenue</span>
                    <span className="text-slate-900">{formatCurrency(monthlyData[month].revenue)}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full rounded-full" 
                      style={{ width: `${(monthlyData[month].revenue / (totalRevenue / (sortedMonths.length || 1))) * 50}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold mt-1">
                    <span className="text-emerald-500">Profit</span>
                    <span className="text-emerald-600">{formatCurrency(monthlyData[month].profit)}</span>
                  </div>
                  <div className="w-full bg-emerald-50 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full" 
                      style={{ width: `${(monthlyData[month].profit / (totalProfit / (sortedMonths.length || 1))) * 50}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-indigo-600" /> Recent Profitable Sales
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[400px]">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-3">Product</th>
                  <th className="px-6 py-3">Sale</th>
                  <th className="px-6 py-3">Profit</th>
                  <th className="px-6 py-3 text-right">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subscriptions
                  .filter(s => (s.profitGbp || 0) > 0)
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .slice(0, 10)
                  .map(sub => {
                    const margin = (sub.profitGbp! / sub.price) * 100;
                    return (
                      <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-xs font-bold text-slate-900">{sub.subscriptionType}</div>
                          <div className="text-[10px] text-slate-400 font-medium">{formatDate(sub.createdAt)}</div>
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-700">{formatCurrency(sub.price)}</td>
                        <td className="px-6 py-4 text-xs font-black text-emerald-600">+{formatCurrency(sub.profitGbp || 0)}</td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                            {margin.toFixed(0)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
