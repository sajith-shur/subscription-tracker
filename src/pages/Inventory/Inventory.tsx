import { useState, useEffect } from "react";
import { 
  Plus, Trash2, CheckCircle2, 
  Search, SearchX, AlertTriangle, ExternalLink, Filter, 
  Layers, BarChart3, ArrowUpRight, Edit2, X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as db from "../../services/db";
import { useToast } from "../../components/ui/Toast";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useLocalization } from "../../contexts/LocalizationContext";
import type { InventoryItem, ManagedSubscriptionType, USDTPurchase } from "../../types/index";

export function Inventory() {
  const { showToast } = useToast();
  const { formatCurrency, formatDate } = useLocalization();
  const currencySymbol = formatCurrency(0).replace(/[0-9.]/g, '');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<ManagedSubscriptionType[]>([]);
  const [batches, setBatches] = useState<USDTPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<'All' | 'Available' | 'Assigned' | 'Used'>('All');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // New state for enhancements
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    productId: "",
    durationId: "",
    codeOrLink: "",
    batchId: "",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [invData, prodData, batchData] = await Promise.all([
        db.getInventoryItems(),
        db.getSubscriptionTypes(),
        db.getUSDTPurchases()
      ]);
      setItems(invData);
      setProducts(prodData);
      setBatches(batchData);
    } catch (error) {
      console.error("Failed to load inventory data:", error);
      showToast("Failed to load inventory", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async () => {
    if (!formData.productId || !formData.durationId || !formData.codeOrLink) {
      showToast("Please fill in all required fields", "error");
      return;
    }

    const selectedProduct = products.find(p => p.id === formData.productId);
    const selectedDuration = selectedProduct?.durations.find(d => d.id === formData.durationId);
    
    if (!selectedProduct || !selectedDuration) return;

    const vendorCostUsdt = selectedDuration.vendorCostUsdt || 0;
    const selectedBatch = batches.find(b => b.id === formData.batchId);
    const exchangeRate = selectedBatch?.exchangeRate || (batches.length > 0 ? batches[0].exchangeRate : 0);
    const gbpCost = vendorCostUsdt * exchangeRate;

    try {
      const itemData: any = {
        productId: formData.productId,
        productName: selectedProduct.name,
        durationMonths: selectedDuration.months,
        durationLabel: selectedDuration.label,
        codeOrLink: formData.codeOrLink,
        vendorCostUsdt,
        gbpCost,
        updatedAt: new Date().toISOString()
      };

      if (formData.batchId) {
        itemData.batchId = formData.batchId;
      }

      if (editingItem) {
        // Update existing
        const updatedItem: InventoryItem = {
          ...editingItem,
          ...itemData
        };
        await db.saveInventoryItem(updatedItem);
        showToast("Inventory item updated", "success");
      } else {
        // Create new
        const newItem: InventoryItem = {
          id: `inv_${Date.now()}`,
          ...itemData,
          status: 'Available',
          createdAt: new Date().toISOString()
        };
        await db.saveInventoryItem(newItem);
        showToast("Inventory item added", "success");
      }

      setIsModalOpen(false);
      setEditingItem(null);
      setFormData({ productId: "", durationId: "", codeOrLink: "", batchId: "" });
      loadData();
    } catch (error) {
      console.error("Save error:", error);
      showToast(editingItem ? "Failed to update item" : "Failed to save inventory item", "error");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await db.deleteInventoryItem(deleteId);
      showToast("Item deleted", "success");
      setItems(prev => prev.filter(i => i.id !== deleteId));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(deleteId);
        return next;
      });
      setDeleteId(null);
    } catch (error) {
      showToast("Failed to delete", "error");
    }
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(Array.from(selectedIds).map(id => db.deleteInventoryItem(id)));
      showToast(`${selectedIds.size} items deleted`, "success");
      setItems(prev => prev.filter(i => !selectedIds.has(i.id)));
      setSelectedIds(new Set());
      setIsBulkDeleteModalOpen(false);
    } catch (error) {
      showToast("Failed to delete some items", "error");
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(i => i.id)));
    }
  };

  const openEditModal = (item: InventoryItem) => {
    const product = products.find(p => p.id === item.productId);
    const duration = product?.durations.find(d => d.months === item.durationMonths);
    
    setEditingItem(item);
    setFormData({
      productId: item.productId,
      durationId: duration?.id || "",
      codeOrLink: item.codeOrLink,
      batchId: item.batchId || "",
    });
    setIsModalOpen(true);
  };

  const filtered = items.filter(item => {
    const matchesSearch = 
      item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.codeOrLink.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const availableCount = items.filter(i => i.status === 'Available').length;
  const lowStockThreshold = 2;
  
  // Group by product/duration for stock counts
  const stockSummary = products.flatMap(p => 
    p.durations.filter(d => d.active).map(d => {
      const productItems = items.filter(i => i.productId === p.id && i.durationMonths === d.months);
      const count = productItems.filter(i => i.status === 'Available').length;
      const hasHistory = productItems.length > 0;
      return { productName: p.name, durationLabel: d.label, count, hasHistory };
    })
  ).filter(s => s.count > 0 || (s.hasHistory && s.count === 0));

  const lowStockCount = stockSummary.filter(s => s.count <= lowStockThreshold).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Inventory</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Manage activation links and codes</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-indigo-200"
        >
          <Plus className="w-4 h-4" />
          Add Stock
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Total Stock</span>
          </div>
          <div className="text-3xl font-black text-slate-900">{items.length}</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Available</span>
          </div>
          <div className="text-3xl font-black text-emerald-600">{availableCount}</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Total Value</span>
          </div>
          <div className="text-3xl font-black text-slate-900">{formatCurrency(items.reduce((sum, i) => sum + i.gbpCost, 0))}</div>
        </div>
        <div className="bg-rose-50 rounded-2xl p-5 border border-rose-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold text-rose-600 uppercase tracking-widest">Low Stock</span>
          </div>
          <div className="text-3xl font-black text-rose-900">{lowStockCount}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 relative overflow-hidden">
        {selectedIds.size > 0 && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="absolute inset-0 bg-indigo-600 flex items-center justify-between px-6 z-10"
          >
            <div className="flex items-center gap-4 text-white">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center font-bold text-sm">
                {selectedIds.size}
              </div>
              <span className="font-bold text-sm uppercase tracking-wider">Items Selected</span>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setSelectedIds(new Set())}
                className="px-4 py-2 text-white/80 hover:text-white font-bold text-sm transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => setIsBulkDeleteModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-indigo-600 hover:bg-rose-50 hover:text-rose-600 font-bold text-sm rounded-xl transition-all shadow-sm"
              >
                <Trash2 className="w-4 h-4" />
                Delete Selected
              </button>
            </div>
          </motion.div>
        )}
        
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by product or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900"
            />
          </div>
          <div className="w-full md:w-48">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 appearance-none cursor-pointer text-sm"
              >
                <option value="All">All Status</option>
                <option value="Available">Available</option>
                <option value="Assigned">Assigned</option>
                <option value="Used">Used</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 w-10">
                  <div className="flex items-center">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.size > 0 && selectedIds.size === filtered.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Code / Link</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Cost ({formatCurrency(0).replace(/[0-9.]/g, '')})</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Batch</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
                      <p className="font-medium">Loading inventory...</p>
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
                      <p className="font-bold text-slate-900 text-lg">No stock found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className={`hover:bg-slate-50/80 transition-colors group ${selectedIds.has(item.id) ? 'bg-indigo-50/30' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-slate-900">{item.productName}</div>
                      <div className="text-xs text-slate-500 font-medium">{item.durationLabel}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-slate-100 px-2 py-1 rounded border border-slate-200 font-mono text-slate-700 max-w-[200px] truncate">
                          {item.codeOrLink}
                        </code>
                        <button 
                          onClick={() => {
                            if (item.codeOrLink.startsWith('http')) window.open(item.codeOrLink, '_blank');
                            else {
                              navigator.clipboard.writeText(item.codeOrLink);
                              showToast("Code copied", "success");
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                        >
                          {item.codeOrLink.startsWith('http') ? <ExternalLink className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-slate-900">{formatCurrency(item.gbpCost)}</div>
                      <div className="text-[10px] text-slate-400 font-medium">{item.vendorCostUsdt} USDT</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs font-medium text-slate-500">
                        {batches.find(b => b.id === item.batchId)?.date ? new Date(batches.find(b => b.id === item.batchId)!.date).toLocaleDateString() : "—"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                        item.status === 'Available' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        item.status === 'Assigned' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => openEditModal(item)}
                          className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {item.status === 'Available' && (
                          <button 
                            onClick={() => setDeleteId(item.id)}
                            className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
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
        title="Delete Item"
        message="Are you sure you want to delete this inventory item? This cannot be undone."
        confirmLabel="Delete"
        isDestructive
      />

      <ConfirmDialog
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDelete}
        title="Delete Selected Items"
        message={`Are you sure you want to delete ${selectedIds.size} selected items? This action cannot be undone.`}
        confirmLabel="Delete All Selected"
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
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                    {editingItem ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{editingItem ? "Edit Inventory Stock" : "Add Inventory Stock"}</h2>
                    <p className="text-xs text-slate-400">{editingItem ? "Update activation details" : "Add new activation links or codes"}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">Product</label>
                  <select
                    value={formData.productId}
                    onChange={e => setFormData({ ...formData, productId: e.target.value, durationId: "" })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
                  >
                    <option value="">Select Product...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {formData.productId && (
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">Duration</label>
                    <select
                      value={formData.durationId}
                      onChange={e => setFormData({ ...formData, durationId: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
                    >
                      <option value="">Select Duration...</option>
                      {products.find(p => p.id === formData.productId)?.durations.filter(d => d.active).map(d => (
                        <option key={d.id} value={d.id}>{d.label} (Cost: {d.vendorCostUsdt || 0} USDT)</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">Activation Code / Link</label>
                  <textarea
                    value={formData.codeOrLink}
                    onChange={e => setFormData({ ...formData, codeOrLink: e.target.value })}
                    placeholder="Enter link or code here..."
                    rows={3}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">USDT Batch (for cost basis)</label>
                  <select
                    value={formData.batchId}
                    onChange={e => setFormData({ ...formData, batchId: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
                  >
                    <option value="">Latest / Average Rate</option>
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>{formatDate(b.date)} — {currencySymbol}{b.exchangeRate.toFixed(4)}/USDT</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
                 <button onClick={handleCreate} className="px-5 py-2.5 text-sm font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
                  {editingItem ? "Save Changes" : "Add to Stock"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
