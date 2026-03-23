import { useState, useEffect, useRef } from "react";
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
  Tag, Clock, Star, Sparkles, Package, Check, X, GripVertical, AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as db from "../../services/db";
import { useToast } from "../../components/ui/Toast";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useLocalization } from "../../contexts/LocalizationContext";
import type { ManagedSubscriptionType, SubscriptionDuration } from "../../types/index";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const newDuration = (sortOrder: number): SubscriptionDuration => ({
  id: `dur_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  label: "",
  months: 1,
  active: true,
  isDefault: false,
  isMostPopular: false,
  badgeText: "",
  defaultPrice: 0,
  sortOrder,
});

const newType = (): ManagedSubscriptionType => ({
  id: `st_${Date.now()}`,
  name: "",
  category: "",
  active: true,
  notes: "",
  durations: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// ─── Duration Row ─────────────────────────────────────────────────────────────

interface DurationRowProps {
  dur: SubscriptionDuration;
  onUpdate: (d: SubscriptionDuration) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

function DurationRow({ dur, onUpdate, onDelete, onMoveUp, onMoveDown, isFirst, isLast }: DurationRowProps) {
  const { formatCurrency } = useLocalization();
  const currencySymbol = formatCurrency(0).replace(/[0-9.]/g, '');

  return (
    <div className={`grid grid-cols-12 gap-2 items-center p-3 rounded-xl ${dur.active ? "bg-slate-50" : "bg-slate-50/40 opacity-60"} border border-slate-100`}>
      {/* Reorder arrows */}
      <div className="col-span-1 flex flex-col items-center gap-0.5">
        <button onClick={onMoveUp} disabled={isFirst} className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20 transition-colors">
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <GripVertical className="w-3.5 h-3.5 text-slate-300" />
        <button onClick={onMoveDown} disabled={isLast} className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20 transition-colors">
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Label */}
      <input
        value={dur.label}
        onChange={e => onUpdate({ ...dur, label: e.target.value })}
        placeholder="e.g. 6 Months"
        className="col-span-3 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
      />

      {/* Months */}
      <input
        type="number"
        value={dur.months || ""}
        onChange={e => onUpdate({ ...dur, months: parseInt(e.target.value) || 0 })}
        placeholder="Months"
        min={1}
        className="col-span-2 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
      />

      {/* Default Price */}
      <div className="col-span-2 relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">{currencySymbol}</span>
        <input
          type="number"
          value={dur.defaultPrice || ""}
          onChange={e => onUpdate({ ...dur, defaultPrice: parseFloat(e.target.value) || 0 })}
          placeholder="Price"
          step="0.01"
          min={0}
          className="w-full pl-5 pr-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
        />
      </div>

      {/* Vendor Cost USDT */}
      <div className="col-span-2 relative">
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold">USDT</span>
        <input
          type="number"
          value={dur.vendorCostUsdt || ""}
          onChange={e => onUpdate({ ...dur, vendorCostUsdt: parseFloat(e.target.value) || 0 })}
          placeholder="Cost"
          step="0.01"
          min={0}
          className="w-full pl-9 pr-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
        />
      </div>

      {/* Badge text */}
      <input
        value={dur.badgeText}
        onChange={e => onUpdate({ ...dur, badgeText: e.target.value })}
        placeholder="Badge (opt.)"
        className="col-span-2 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
      />

      {/* Toggles */}
      <div className="col-span-2 flex items-center justify-end gap-1">
        <button
          title={dur.isDefault ? "Default duration" : "Set as default"}
          onClick={() => onUpdate({ ...dur, isDefault: !dur.isDefault })}
          className={`p-1.5 rounded-lg transition-colors ${dur.isDefault ? "text-indigo-600 bg-indigo-50" : "text-slate-300 hover:text-indigo-400"}`}
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          title={dur.isMostPopular ? "Most popular" : "Mark as popular"}
          onClick={() => onUpdate({ ...dur, isMostPopular: !dur.isMostPopular })}
          className={`p-1.5 rounded-lg transition-colors ${dur.isMostPopular ? "text-amber-500 bg-amber-50" : "text-slate-300 hover:text-amber-400"}`}
        >
          <Star className="w-3.5 h-3.5" />
        </button>
        <button
          title={dur.active ? "Disable" : "Enable"}
          onClick={() => onUpdate({ ...dur, active: !dur.active })}
          className={`p-1.5 rounded-lg transition-colors ${dur.active ? "text-emerald-600" : "text-slate-300"}`}
        >
          {dur.active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Type Card ─────────────────────────────────────────────────────────────────────

interface TypeCardProps {
  type: ManagedSubscriptionType;
  onSave: (t: ManagedSubscriptionType) => void;
  onDelete: (id: string) => void;
}

function TypeCard({ type, onSave, onDelete }: TypeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ManagedSubscriptionType>(type);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => { setDraft(type); }, [type]);

  const addDuration = () => {
    setDraft(prev => ({
      ...prev,
      durations: [...prev.durations, newDuration(prev.durations.length)]
    }));
    setExpanded(true);
    setEditing(true);
  };

  const updateDuration = (idx: number, d: SubscriptionDuration) => {
    setDraft(prev => {
      const durations = [...prev.durations];
      durations[idx] = d;
      return { ...prev, durations };
    });
  };

  const removeDuration = (idx: number) => {
    setDraft(prev => ({ ...prev, durations: prev.durations.filter((_, i) => i !== idx) }));
  };

  const moveDuration = (idx: number, dir: -1 | 1) => {
    setDraft(prev => {
      const durations = [...prev.durations];
      const target = idx + dir;
      if (target < 0 || target >= durations.length) return prev;
      [durations[idx], durations[target]] = [durations[target], durations[idx]];
      return { ...prev, durations: durations.map((d, i) => ({ ...d, sortOrder: i })) };
    });
  };

  const handleSave = () => {
    onSave({ ...draft, updatedAt: new Date().toISOString() });
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(type);
    setEditing(false);
  };

  const activeDurs = type.durations.filter(d => d.active).length;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${type.active ? "border-slate-200" : "border-slate-100 opacity-70"}`}
    >
      {/* Header Row */}
      <div className="flex items-center gap-4 p-5">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${type.active ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-400"}`}>
          <Package className="w-5 h-5" />
        </div>

        {editing ? (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={draft.name}
              onChange={e => setDraft({ ...draft, name: e.target.value })}
              placeholder="Subscription Type Name *"
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-semibold"
            />
            <input
              value={draft.category}
              onChange={e => setDraft({ ...draft, category: e.target.value })}
              placeholder="Category (optional)"
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <input
              value={draft.notes}
              onChange={e => setDraft({ ...draft, notes: e.target.value })}
              placeholder="Notes / Terms (optional)"
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        ) : (
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-slate-900 text-base truncate">{type.name || "Unnamed"}</h3>
              {type.category && (
                <span className="text-[10px] font-bold uppercase tracking-widest bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full">{type.category}</span>
              )}
              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${type.active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                {type.active ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeDurs} active duration{activeDurs !== 1 ? "s" : ""}
              {type.notes && ` · ${type.notes}`}
            </p>
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0">
          {editing ? (
            <>
              <button onClick={handleSave} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors">Save</button>
              <button onClick={handleCancel} className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-200 transition-colors">Cancel</button>
            </>
          ) : (
            <>
              <button onClick={() => { setEditing(true); setExpanded(true); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors" title="Edit">
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => onSave({ ...type, active: !type.active, updatedAt: new Date().toISOString() })}
                className={`p-2 rounded-xl transition-colors ${type.active ? "text-emerald-500 hover:bg-emerald-50" : "text-slate-400 hover:bg-slate-100"}`}
                title={type.active ? "Deactivate" : "Activate"}
              >
                {type.active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
              </button>
              <button onClick={() => setDeleteOpen(true)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors" title="Delete">
                <Trash2 className="w-4 h-4" />
              </button>
              <button onClick={() => setExpanded(!expanded)} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl transition-colors">
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Duration Manager */}
      <AnimatePresence>
        {(expanded || editing) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-slate-50">
              <div className="flex items-center justify-between mt-4 mb-3">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  Duration Options
                </h4>
                <button
                  onClick={addDuration}
                  className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Duration
                </button>
              </div>

              {draft.durations.length === 0 ? (
                <p className="text-center text-sm text-slate-400 italic py-6 bg-slate-50 rounded-xl border-2 border-dashed border-slate-100">
                  No durations yet — click "Add Duration" to get started
                </p>
              ) : (
                <div className="space-y-2">
                  {/* Column headers */}
                  <div className="grid grid-cols-12 gap-2 px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <div className="col-span-1"></div>
                    <div className="col-span-3">Label</div>
                    <div className="col-span-2">Months</div>
                    <div className="col-span-2">Price</div>
                    <div className="col-span-2">Cost (USDT)</div>
                    <div className="col-span-2">Badge</div>
                    <div className="col-span-2 text-right">Actions</div>
                  </div>
                  {draft.durations.map((dur, idx) => (
                    <DurationRow
                      key={dur.id}
                      dur={dur}
                      onUpdate={(d) => { updateDuration(idx, d); setEditing(true); }}
                      onDelete={() => { removeDuration(idx); setEditing(true); }}
                      onMoveUp={() => { moveDuration(idx, -1); setEditing(true); }}
                      onMoveDown={() => { moveDuration(idx, 1); setEditing(true); }}
                      isFirst={idx === 0}
                      isLast={idx === draft.durations.length - 1}
                    />
                  ))}
                </div>
              )}

              {/* Editing legend */}
              {editing && (
                <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-400 font-medium">
                  <span className="flex items-center gap-1"><Check className="w-3 h-3 text-indigo-500" /> Default</span>
                  <span className="flex items-center gap-1"><Star className="w-3 h-3 text-amber-400" /> Most Popular</span>
                  <span className="flex items-center gap-1"><ToggleRight className="w-3.5 h-3.5 text-emerald-500" /> Active</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => { onDelete(type.id); setDeleteOpen(false); }}
        title="Delete Subscription Type"
        message={`Are you sure you want to delete "${type.name}"? This cannot be undone. Existing customer records will not be affected.`}
        confirmLabel="Delete"
        isDestructive
      />
    </motion.div>
  );
}

// ─── Add Type Modal ───────────────────────────────────────────────────────────

interface AddTypeModalProps {
  isOpen: boolean;
  existingNames: string[];
  onClose: () => void;
  onAdd: (t: ManagedSubscriptionType) => void;
}

function AddTypeModal({ isOpen, existingNames, onClose, onAdd }: AddTypeModalProps) {
  const [draft, setDraft] = useState(newType());
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setDraft(newType());
      setError("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (!draft.name.trim()) { setError("Name is required"); return; }
    if (existingNames.includes(draft.name.trim())) { setError("Name already exists"); return; }
    onAdd({ ...draft, name: draft.name.trim(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">New Subscription Type</h2>
            <p className="text-xs text-slate-400">Durations can be added after saving</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">Name *</label>
            <input
              ref={inputRef}
              value={draft.name}
              onChange={e => { setDraft({ ...draft, name: e.target.value }); setError(""); }}
              onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
              placeholder="e.g. Premium Career"
              className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium ${error ? "border-red-300" : "border-slate-200"}`}
            />
            {error && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">Category (optional)</label>
            <input
              value={draft.category}
              onChange={e => setDraft({ ...draft, category: e.target.value })}
              placeholder="e.g. LinkedIn, Sales"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">Notes / Terms (optional)</label>
            <textarea
              value={draft.notes}
              onChange={e => setDraft({ ...draft, notes: e.target.value })}
              placeholder="Any terms or notes..."
              rows={2}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={handleSubmit} className="px-5 py-2.5 text-sm font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
            Create Type
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SubscriptionManagement() {
  const { showToast } = useToast();
  useLocalization();
  const [types, setTypes] = useState<ManagedSubscriptionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const loadTypes = async () => {
    setLoading(true);
    try {
      const data = await db.getSubscriptionTypes();
      setTypes(data);
    } catch {
      showToast("Failed to load subscription types", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTypes(); }, []);

  const handleAdd = async (type: ManagedSubscriptionType) => {
    try {
      await db.saveSubscriptionType(type);
      showToast(`"${type.name}" created successfully`, "success");
      loadTypes();
    } catch {
      showToast("Failed to save", "error");
    }
  };

  const handleSave = async (type: ManagedSubscriptionType) => {
    try {
      await db.saveSubscriptionType(type);
      showToast("Saved successfully", "success");
      setTypes(prev => prev.map(t => t.id === type.id ? type : t));
    } catch {
      showToast("Failed to save", "error");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await db.deleteSubscriptionType(id);
      showToast("Deleted successfully", "success");
      setTypes(prev => prev.filter(t => t.id !== id));
    } catch {
      showToast("Failed to delete", "error");
    }
  };

  const filtered = types.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeCount = types.filter(t => t.active).length;
  const totalDurations = types.reduce((sum, t) => sum + t.durations.filter(d => d.active).length, 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-indigo-500" />
            Subscription Products
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage subscription types and available durations. Changes reflect immediately across all forms.</p>
        </div>
        <button
          onClick={() => setAddModalOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-indigo-200"
        >
          <Plus className="w-4 h-4" />
          Add Subscription Type
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Types", value: types.length, icon: <Tag className="w-4 h-4 text-indigo-500" />, bg: "bg-indigo-50" },
          { label: "Active Types", value: activeCount, icon: <ToggleRight className="w-4 h-4 text-emerald-500" />, bg: "bg-emerald-50" },
          { label: "Active Durations", value: totalDurations, icon: <Clock className="w-4 h-4 text-amber-500" />, bg: "bg-amber-50" },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
            <div className={`w-10 h-10 ${stat.bg} rounded-xl flex items-center justify-center`}>{stat.icon}</div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
              <p className="text-2xl font-black text-slate-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 border border-slate-100 shadow-sm">
        <X className="w-4 h-4 text-slate-300" />
        <input
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search subscription types..."
          className="flex-1 text-sm outline-none text-slate-700 placeholder:text-slate-400"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm("")} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Types List */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 text-sm">Loading products...</div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-slate-700 font-bold">
            {searchTerm ? "No results found" : "No subscription types yet"}
          </h3>
          <p className="text-slate-400 text-sm mt-1">
            {searchTerm ? "Try a different search." : "Click \"Add Subscription Type\" to create your first product."}
          </p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-3">
            {filtered.map(type => (
              <TypeCard
                key={type.id}
                type={type}
                onSave={handleSave}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* Add Modal */}
      <AnimatePresence>
        {addModalOpen && (
          <AddTypeModal
            isOpen={addModalOpen}
            existingNames={types.map(t => t.name)}
            onClose={() => setAddModalOpen(false)}
            onAdd={handleAdd}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
