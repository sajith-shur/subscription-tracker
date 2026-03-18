import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Phone, Mail, Globe, Clock, Edit, Trash2, Shield, MessageSquare, TrendingUp, Linkedin, Activity, Plus, Hash } from "lucide-react";
import * as db from "../../services/db";
import { useToast } from "../../components/ui/Toast";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import type { Customer, Subscription, CustomerNote } from "../../types/index";
import { getDaysLeft, formatDaysLeft, getDaysLeftColorClass } from "../../utils/dateUtils";
import { motion } from "framer-motion";

export function CustomerDetail() {
  const { showToast } = useToast();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [lifetimeValue, setLifetimeValue] = useState(0);
  
  // Modal & Input state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);

  useEffect(() => {
    if (id) {
      (async () => {
        const foundCustomer = await db.getCustomer(id);
        if (foundCustomer) {
          setCustomer(foundCustomer);
          const [subs, value] = await Promise.all([
            db.getCustomerSubscriptions(id),
            db.getCustomerValue(id)
          ]);
          setSubscriptions(subs);
          setLifetimeValue(value);
        }
      })();
    }
  }, [id]);

  const handleConfirmDelete = async () => {
    if (!customer) return;
    await db.deleteCustomer(customer.id);
    showToast(`${customer.fullName} deleted successfully`, "success");
    navigate("/customers");
  };

  const handleAddNote = async () => {
    if (!customer || !newNote.trim()) return;

    const note: CustomerNote = {
      id: `n_${Date.now()}`,
      date: new Date().toISOString(),
      text: newNote.trim()
    };

    const updatedCustomer = {
      ...customer,
      notes: Array.isArray(customer.notes) ? [note, ...customer.notes] : [note],
      updatedAt: new Date().toISOString()
    };

    await db.saveCustomer(updatedCustomer);
    setCustomer(updatedCustomer);
    setNewNote("");
    setIsAddingNote(false);
    showToast("Note added to timeline", "success");
  };

  if (!customer) return <div className="p-8 text-center text-slate-500">Loading customer profile...</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate("/customers")}
          className="group flex items-center text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          Back to Customers
        </button>
        <div className="flex items-center gap-3">
          <Link 
            to={`/customers/${customer.id}/edit`}
            className="inline-flex items-center justify-center bg-white border border-slate-200 hover:bg-indigo-50 hover:border-indigo-100 hover:text-indigo-600 text-slate-700 px-4 py-2 rounded-xl font-medium text-sm transition-all shadow-sm"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit Profile
          </Link>
          <button 
            onClick={() => setIsDeleteModalOpen(true)}
            className="inline-flex items-center justify-center bg-white border border-red-100 hover:bg-red-50 text-red-600 px-4 py-2 rounded-xl font-medium text-sm transition-all shadow-sm"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </button>
        </div>
      </div>

      {/* Health Info Indicator */}
      {subscriptions.length > 0 && (
        <div className={`p-6 rounded-3xl border flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm ${getDaysLeftColorClass(getDaysLeft(subscriptions[0].renewalDate))}`}>
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/50 flex items-center justify-center animate-pulse">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest opacity-70">Customer Health</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xl font-black">Active</span>
                  <span className="text-sm font-medium opacity-60">• {subscriptions[0].planDuration} Plan</span>
                </div>
              </div>
           </div>
           <div className="text-left md:text-right">
              <p className="text-xs font-bold uppercase tracking-widest opacity-70">Renewal Status</p>
              <p className="text-lg font-black mt-0.5">
                {formatDaysLeft(getDaysLeft(subscriptions[0].renewalDate))}
              </p>
              <p className="text-[10px] font-bold opacity-50 uppercase">{new Date(subscriptions[0].renewalDate).toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
           </div>
        </div>
      )}

      {/* Main Stats and Contact */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-3xl p-8 border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-center min-h-[220px]">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Shield className="w-32 h-32" />
          </div>
          
          <div className="flex flex-col md:flex-row gap-8 items-center relative z-10 text-center md:text-left">
            <div className="w-24 h-24 rounded-3xl bg-indigo-600 text-white flex items-center justify-center text-3xl font-bold shadow-lg shadow-indigo-200 shrink-0">
              {customer.fullName.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                <h1 className="text-3xl font-bold text-slate-900">{customer.fullName}</h1>
                <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold uppercase tracking-widest border border-indigo-100">{customer.leadSource}</span>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-6 mt-6">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-slate-300" />
                  <span className="text-sm font-semibold text-slate-600">{customer.email}</span>
                </div>
                {customer.linkedinUrl && (
                  <a 
                    href={customer.linkedinUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex items-center gap-3 text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    <Linkedin className="w-4 h-4" />
                    <span className="text-sm font-medium">LinkedIn Profile</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
               <TrendingUp className="w-8 h-8" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Lifetime Value</p>
            <p className="text-4xl font-black text-slate-900">£{lifetimeValue.toFixed(2)}</p>
            <p className="text-[10px] text-slate-400 mt-2 italic">Total revenue generated</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-8">
          {/* Subscriptions section */}
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" />
              Subscription Management
            </h2>
            
            <div className="space-y-4">
              {subscriptions.length === 0 ? (
                <div className="py-12 text-center rounded-2xl border-2 border-dashed border-slate-100">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-8 h-8 text-slate-200" />
                  </div>
                  <p className="text-slate-400 font-medium italic">No active subscriptions found</p>
                </div>
              ) : (
                subscriptions.map(sub => (
                  <div key={sub.id} className="flex items-center justify-between p-6 rounded-2xl bg-slate-50 border border-slate-100 hover:border-indigo-100 transition-colors group">
                    <div className="flex items-center gap-5">
            <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 font-bold group-hover:text-indigo-600 transition-colors shadow-sm">
              £
            </div>
                      <div>
                        <div className="font-bold text-slate-900 text-lg">{sub.subscriptionType || `${sub.planDuration} Plan`}</div>
                        <div className="text-xs text-slate-500 font-medium">{sub.subscriptionType ? `${sub.planDuration} plan • ` : ''}Renewal: {new Date(sub.renewalDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-slate-900 text-xl">£{sub.price}</div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">{sub.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Contact details with quick action */}
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
             <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                <Phone className="w-4 h-4 text-indigo-500" />
                Contact Information
             </h2>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                   <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">WhatsApp Number</div>
                   <div className="flex items-center gap-4">
                      <span className="text-xl font-bold text-slate-900">{customer.whatsappNumber}</span>
                      <a 
                        href={`https://wa.me/${customer.whatsappNumber.replace(/[^0-9]/g, '')}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-100"
                      >
                         <MessageSquare className="w-3.5 h-3.5" />
                         Open Chat
                      </a>
                   </div>
                </div>
                <div className="space-y-4">
                   <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Email Address</div>
                   <div className="text-xl font-bold text-slate-900 truncate">{customer.email}</div>
                </div>
                <div className="space-y-4">
                   <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Market / Country</div>
                   <div className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <Globe className="w-5 h-5 text-slate-300" />
                      {customer.country}
                   </div>
                </div>
                <div className="space-y-4">
                   <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Customer ID</div>
                   <div className="text-xl font-bold text-slate-900 flex items-center gap-2">
                       <Hash className="w-5 h-5 text-slate-300" />
                       {customer.id.replace('c_', '')}
                   </div>
                </div>
             </div>
          </div>
        </div>

        {/* Timeline Notes */}
        <div className="space-y-8">
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm flex flex-col h-full max-h-[800px]">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-500" />
                Timeline Notes
              </h2>
              <button 
                onClick={() => setIsAddingNote(!isAddingNote)}
                className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-xl transition-colors"
              >
                <Plus className={`w-5 h-5 transition-transform ${isAddingNote ? 'rotate-45' : ''}`} />
              </button>
            </div>

            {isAddingNote && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8 p-4 rounded-2xl bg-indigo-50 border border-indigo-100"
              >
                <textarea 
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Type a new note..."
                  className="w-full bg-white border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 min-h-[100px] mb-3"
                />
                <div className="flex justify-end gap-2">
                   <button onClick={() => setIsAddingNote(false)} className="px-3 py-1.5 text-xs font-bold text-slate-500">Cancel</button>
                   <button 
                    onClick={handleAddNote}
                    disabled={!newNote.trim()}
                    className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                   >
                     Add Entry
                   </button>
                </div>
              </motion.div>
            )}
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-8 relative">
               {/* Timeline line */}
               <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-slate-100 z-0"></div>

              {(!customer.notes || (Array.isArray(customer.notes) && customer.notes.length === 0)) ? (
                <div className="text-center py-10 italic text-slate-400 text-sm">No history yet.</div>
              ) : (
                (Array.isArray(customer.notes) ? customer.notes : [{ id: '1', date: customer.createdAt, text: customer.notes as string }]).map((note: CustomerNote) => (
                  <div key={note.id} className="relative z-10 pl-8">
                     <div className="absolute left-0 top-[6px] w-4 h-4 rounded-full bg-white border-4 border-indigo-500"></div>
                     <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        {new Date(note.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                     </div>
                     <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-50">
                        {note.text}
                     </p>
                  </div>
                ))
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-slate-50 text-center">
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer Created</p>
               <p className="text-sm font-bold text-slate-900 mt-1">{new Date(customer.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Customer"
        message={`Are you sure you want to delete ${customer?.fullName}? This action cannot be undone and will remove all their records.`}
        confirmLabel="Delete Customer"
        isDestructive={true}
      />
    </div>
  );
}
