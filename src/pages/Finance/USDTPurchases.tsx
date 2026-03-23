import { useState, useEffect } from "react";
import { 
  Plus, Trash2, Calendar, DollarSign, TrendingUp, CreditCard, 
  Search, SearchX
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as db from "../../services/db";
import { useToast } from "../../components/ui/Toast";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useLocalization } from "../../contexts/LocalizationContext";
import type { USDTPurchase } from "../../types/index";

export function USDTPurchases() {
  const { showToast } = useToast();
  const { formatCurrency, formatDate } = useLocalization();
  const [purchases, setPurchases] = useState<USDTPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    gbpSpent: 0,
    usdtReceived: 0,
    notes: ""
  });

  const loadPurchases = async () => {
    setLoading(true);
    try {
      const data = await db.getUSDTPurchases();
      setPurchases(data);
    } catch (error) {
      console.error("Failed to load USDT purchases:", error);
      showToast("Failed to load USDT purchases", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPurchases();
  }, []);

  const handleCreate = async () => {
    if (formData.gbpSpent <= 0 || formData.usdtReceived <= 0) {
      showToast("Please enter valid amounts", "error");
      return;
    }

    const exchangeRate = formData.gbpSpent / formData.usdtReceived;
    const newPurchase: USDTPurchase = {
      id: `usdt_${Date.now()}`,
      date: formData.date,
      gbpSpent: formData.gbpSpent,
      usdtReceived: formData.usdtReceived,
      exchangeRate,
      notes: formData.notes
    };

    try {
      await db.saveUSDTPurchase(newPurchase);
      showToast("USDT purchase logged successfully", "success");
      setIsModalOpen(false);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        gbpSpent: 0,
        usdtReceived: 0,
        notes: ""
      });
      loadPurchases();
    } catch (error) {
      showToast("Failed to save purchase", "error");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await db.deleteUSDTPurchase(deleteId);
      showToast("Purchase deleted", "success");
      setPurchases(prev => prev.filter(p => p.id !== deleteId));
      setDeleteId(null);
    } catch (error) {
      showToast("Failed to delete", "error");
    }
  };

  const filtered = purchases.filter(p => 
    p.notes.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.date.includes(searchTerm)
  );

  const totalGbp = purchases.reduce((sum, p) => sum + p.gbpSpent, 0);
  const totalUsdt = purchases.reduce((sum, p) => sum + p.usdtReceived, 0);
  const avgRate = totalUsdt > 0 ? totalGbp / totalUsdt : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">USDT Purchases</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Track your USDT acquisition costs and batches</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-indigo-200"
        >
          <Plus className="w-4 h-4" />
          Log Purchase
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Total Spent</span>
          </div>
          <div className="text-3xl font-black text-slate-900">{formatCurrency(totalGbp)}</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Total USDT</span>
          </div>
          <div className="text-3xl font-black text-slate-900">{totalUsdt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Avg. Rate</span>
          </div>
          <div className="text-3xl font-black text-slate-900">{formatCurrency(avgRate)} <span className="text-sm font-medium text-slate-400">/ USDT</span></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by date or notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">{formatCurrency(0).replace(/[0-9.]/g, '')} Spent</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">USDT Received</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Rate</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Notes</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
                      <p className="font-medium">Loading purchases...</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                        <SearchX className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="font-bold text-slate-900 text-lg">No purchases found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm font-medium text-slate-600">
                        <Calendar className="w-4 h-4 mr-2 text-slate-400" />
                        {formatDate(p.date)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-slate-900">{formatCurrency(p.gbpSpent)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-emerald-600">{p.usdtReceived.toLocaleString()} USDT</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-500">{formatCurrency(p.exchangeRate)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-600 max-w-xs truncate">{p.notes || "—"}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setDeleteId(p.id)}
                        className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Purchase"
        message="Are you sure you want to delete this purchase record? This might affect batch cost calculations."
        confirmLabel="Delete"
        isDestructive
      />

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Log USDT Purchase</h2>
                  <p className="text-xs text-slate-400">Record a new batch of USDT</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">Date</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">Local Cost ({formatCurrency(0).replace(/[0-9.]/g, '')})</label>
                    <input
                      type="number"
                      value={formData.gbpSpent || ""}
                      onChange={e => setFormData({ ...formData, gbpSpent: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">USDT Received</label>
                    <input
                      type="number"
                      value={formData.usdtReceived || ""}
                      onChange={e => setFormData({ ...formData, usdtReceived: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
                    />
                  </div>
                </div>

                {formData.gbpSpent > 0 && formData.usdtReceived > 0 && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Calculated Rate</span>
                    <span className="text-sm font-black text-indigo-900">{formatCurrency(formData.gbpSpent / formData.usdtReceived)} <span className="text-[10px] font-medium text-indigo-400">/ USDT</span></span>
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">Notes (optional)</label>
                  <textarea
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Batch source, reference, etc."
                    rows={2}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
                <button onClick={handleCreate} className="px-5 py-2.5 text-sm font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
                  Save Purchase
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
