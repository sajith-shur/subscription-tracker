import { useState, useEffect } from "react";
import { Clock, Search, Filter, Send, Calendar, MessageSquare, AlertCircle, Phone, Mail, XCircle, ShieldAlert, MoreHorizontal, Trash2, CheckCircle2 } from "lucide-react";
import * as db from "../../services/db";
import { automation } from "../../services/automation";
import { useToast } from "../../components/ui/Toast";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import type { Reminder, Customer, Subscription } from "../../types/index";

export function ReminderCentre() {
  const { showToast } = useToast();
  const [reminders, setReminders] = useState<(Reminder & { customer?: Customer, subscription?: Subscription })[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [automationResult, setAutomationResult] = useState<{new: number, skipped: number} | null>(null);
  
  // Confirmation state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<(Reminder & { customer?: Customer }) | null>(null);

  // Menu state
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const loadRemindersByData = async () => {
    const [allReminders, customers, subscriptions] = await Promise.all([
      db.getReminders(),
      db.getCustomers(),
      db.getSubscriptions()
    ]);
    const customerMap = new Map(customers.map(c => [c.id, c]));
    const subMap = new Map(subscriptions.map(s => [s.id, s]));
    const enrichedReminders = allReminders
      .map(rem => ({
        ...rem,
        customer: customerMap.get(rem.customerId),
        subscription: subMap.get(rem.subscriptionId)
      }))
      .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
    setReminders(enrichedReminders);
  };

  useEffect(() => {
    loadRemindersByData();
  }, []);

  const filteredReminders = reminders.filter(r => {
    const matchesSearch = (r.customer?.fullName || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (r.customer?.whatsappNumber || "").includes(searchTerm);
    const matchesStatus = statusFilter === "All" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleRunAutomation = async () => {
    const result = await automation.checkAndGenerateReminders();
    setAutomationResult(result);
    loadRemindersByData();
    
    if (result.new > 0) {
      showToast(`Generated ${result.new} new reminders!`, 'success');
    } else {
      showToast('No new reminders to generate.', 'info');
    }
    
    setTimeout(() => setAutomationResult(null), 5000);
  };

  const handleInitiateSend = (reminder: Reminder & { customer?: Customer }) => {
    setSelectedReminder(reminder);
    setConfirmOpen(true);
  };

  const handleConfirmSend = async () => {
    if (!selectedReminder || !selectedReminder.customer?.whatsappNumber) {
      showToast("Could not send reminder.", "error");
      setConfirmOpen(false);
      return;
    }

    const reminder = selectedReminder;
    const phone = reminder.customer?.whatsappNumber?.replace(/[^0-9]/g, '') || '';
    const text = encodeURIComponent(reminder.messagePreview);
    const waUrl = `https://wa.me/${phone}?text=${text}`;
    
    window.open(waUrl, '_blank');

    const updatedReminder: Reminder = { 
      ...reminder, 
      status: 'Sent', 
      sentAt: new Date().toISOString() 
    };
    await db.saveReminder(updatedReminder);

    loadRemindersByData();
    showToast(`Reminder marked as sent to ${reminder.customer?.fullName}`, 'success');
    setConfirmOpen(false);
    setSelectedReminder(null);
  };

  const handleDeleteReminder = async (id: string) => {
    await db.deleteReminder(id);
    loadRemindersByData();
    showToast("Reminder removed.", "info");
    setActiveMenu(null);
  };

  const handleUpdateStatus = async (reminder: Reminder, newStatus: Reminder['status']) => {
    await db.saveReminder({ ...reminder, status: newStatus });
    loadRemindersByData();
    showToast(`Status updated to ${newStatus}`, "success");
    setActiveMenu(null);
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'WhatsApp': return <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />;
      case 'Email': return <Mail className="w-3.5 h-3.5 text-blue-500" />;
      case 'SMS': return <Phone className="w-3.5 h-3.5 text-indigo-500" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">Reminder Centre</h2>
          <p className="text-slate-500 text-sm mt-1">Manage and send upcoming subscription renewal notices.</p>
        </div>
        <button 
          onClick={handleRunAutomation}
          className="inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-2xl font-bold text-sm transition-all shadow-lg shadow-indigo-100 ring-4 ring-indigo-50"
        >
          <Clock className="w-4 h-4 mr-2" />
          Run Automation Check
        </button>
      </div>

      <ConfirmDialog 
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmSend}
        title="Send Reminder?"
        message={`This will open WhatsApp to send a message to ${selectedReminder?.customer?.fullName}. Continue?`}
      />

      {automationResult && (
        <div className="bg-white border border-indigo-100 rounded-2xl p-4 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-indigo-600" />
             </div>
             <div>
               <p className="text-sm font-bold text-slate-800">Scan Complete</p>
               <p className="text-xs text-slate-400 font-medium">Generated {automationResult.new} new reminders. {automationResult.skipped} existing skipped.</p>
             </div>
          </div>
          <button onClick={() => setAutomationResult(null)} className="text-slate-300 hover:text-slate-500 transition-colors p-2 font-black">
            &times;
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Pending</p>
          <div className="flex items-end justify-between">
            <p className="text-2xl font-black text-slate-900">
              {reminders.filter(r => r.status === 'Pending').length}
            </p>
            <div className="p-2 bg-amber-50 rounded-lg">
              <AlertCircle className="w-4 h-4 text-amber-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Waitlisted</p>
          <div className="flex items-end justify-between">
            <p className="text-2xl font-black text-slate-900">
              {reminders.filter(r => r.status === 'Manual Approval').length}
            </p>
            <div className="p-2 bg-indigo-50 rounded-lg">
              <ShieldAlert className="w-4 h-4 text-indigo-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Scheduled</p>
          <div className="flex items-end justify-between">
            <p className="text-2xl font-black text-slate-900">
              {reminders.filter(r => r.status === 'Scheduled').length}
            </p>
            <div className="p-2 bg-blue-50 rounded-lg">
              <Calendar className="w-4 h-4 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Sent</p>
          <div className="flex items-end justify-between">
            <p className="text-2xl font-black text-slate-900">
              {reminders.filter(r => r.status === 'Sent').length}
            </p>
            <div className="p-2 bg-emerald-50 rounded-lg">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Failed</p>
          <div className="flex items-end justify-between">
            <p className="text-2xl font-black text-slate-900">
              {reminders.filter(r => r.status === 'Failed').length}
            </p>
            <div className="p-2 bg-rose-50 rounded-lg">
              <XCircle className="w-4 h-4 text-rose-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
        <div className="p-4 border-b border-white bg-slate-50/50 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by customer..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-100 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-2.5 pl-3 pr-8 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 focus:ring-4 focus:ring-indigo-500/10 outline-none min-w-[180px] appearance-none"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\' /%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1rem' }}
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending (Action)</option>
              <option value="Manual Approval">Manual Approval</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Sent">Sent</option>
              <option value="Failed">Failed</option>
            </select>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left align-middle">
            <thead className="bg-white text-slate-400 border-b border-slate-50">
              <tr>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest">Customer</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-center">Channel</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest">Type</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest">Message</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredReminders.map((reminder) => (
                <tr key={reminder.id} className="hover:bg-slate-50/30 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {reminder.customer?.fullName || 'Unknown'}
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                      {new Date(reminder.scheduledFor).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center justify-center">
                      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-white group-hover:scale-110 transition-all">
                        {getChannelIcon(reminder.channel)}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-tight bg-slate-50 text-slate-600 border border-slate-100 italic">
                      {reminder.reminderType}
                    </span>
                  </td>
                  <td className="px-6 py-5 max-w-xs">
                    <p className="text-xs text-slate-400 font-medium truncate group-hover:whitespace-normal group-hover:text-slate-600 group-hover:bg-slate-50 group-hover:p-2 group-hover:rounded-xl group-hover:shadow-sm transition-all duration-300">
                      {reminder.messagePreview}
                    </p>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border
                      ${reminder.status === 'Sent' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 
                        reminder.status === 'Pending' ? 'bg-amber-50 border-amber-100 text-amber-600' :
                        reminder.status === 'Scheduled' ? 'bg-blue-50 border-blue-100 text-blue-600' :
                        reminder.status === 'Failed' ? 'bg-rose-50 border-rose-100 text-rose-600' :
                        'bg-indigo-50 border-indigo-100 text-indigo-600'}`}>
                      {reminder.status}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right relative">
                    <div className="flex items-center justify-end gap-2">
                       {(reminder.status === 'Pending' || reminder.status === 'Manual Approval' || reminder.status === 'Failed') && (
                         <button 
                           onClick={() => handleInitiateSend(reminder)}
                           className="inline-flex items-center justify-center bg-white border border-slate-200 hover:bg-emerald-50 hover:border-emerald-100 hover:text-emerald-700 text-slate-700 px-3 py-1.5 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all shadow-sm"
                         >
                           <Send className="w-3.5 h-3.5 mr-1" />
                           Send
                         </button>
                       )}
                       
                       <div className="relative">
                         <button 
                           onClick={() => setActiveMenu(activeMenu === reminder.id ? null : reminder.id)}
                           className="p-1.5 text-slate-300 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-all"
                         >
                           <MoreHorizontal className="w-5 h-5" />
                         </button>
                         
                         {activeMenu === reminder.id && (
                           <>
                             <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)} />
                             <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                               <button 
                                 onClick={() => handleUpdateStatus(reminder, 'Scheduled')}
                                 className="w-full flex items-center px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                               >
                                 <Clock className="w-3.5 h-3.5 mr-2" />
                                 Schedule
                               </button>
                               <button 
                                 onClick={() => handleUpdateStatus(reminder, 'Sent')}
                                 className="w-full flex items-center px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-emerald-600 transition-colors"
                               >
                                 <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
                                 Mark as Sent
                               </button>
                               <div className="h-px bg-slate-50 my-1" />
                               <button 
                                 onClick={() => handleDeleteReminder(reminder.id)}
                                 className="w-full flex items-center px-4 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 transition-colors"
                               >
                                 <Trash2 className="w-3.5 h-3.5 mr-2" />
                                 Delete
                               </button>
                             </div>
                           </>
                         )}
                       </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredReminders.length === 0 && (
            <div className="p-12 text-center rounded-3xl">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <MessageSquare className="h-8 w-8 text-slate-200" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 italic">No Reminders Found</h3>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
