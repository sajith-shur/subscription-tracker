import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, Filter, SearchX, Calendar, ChevronRight, CheckCircle2, XCircle, Clock, ArrowUpDown, Trash2, Archive, RefreshCw, Inbox, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as db from "../../services/db";
import type { IntakeRequest, RequestStatus } from "../../types/index";
import { useToast } from "../../components/ui/Toast";

export function RequestList() {
  const { showToast } = useToast();
  const [requests, setRequests] = useState<IntakeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "All" | "Archived">("All");
  const [contactFilter, setContactFilter] = useState<"All" | "WhatsApp" | "Email" | "Reddit">("All");
  const [sortBy, setSortBy] = useState<"date" | "plan">("date");
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const data = await db.getRequests();
      setRequests(data);
    } catch (error) {
      console.error("Failed to load requests:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredRequests = requests.filter(req => {
    const matchesSearch = 
      req.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.whatsappNumber.includes(searchTerm);
      
    const matchesStatus = 
      statusFilter === "All" ? (!req.archived && req.status !== "Approved") :
      statusFilter === "Archived" ? !!req.archived : 
      (req.status === statusFilter && !req.archived);
      
    const matchesContact = contactFilter === "All" || req.preferredContact === contactFilter;
    
    return matchesSearch && matchesStatus && matchesContact;
  }).sort((a, b) => {
    if (sortBy === "date") {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortDirection === "desc" ? dateB - dateA : dateA - dateB;
    } else {
      const planA = a.subscriptionType || "";
      const planB = b.subscriptionType || "";
      return sortDirection === "desc" ? planB.localeCompare(planA) : planA.localeCompare(planB);
    }
  });

  const toggleSort = (field: "date" | "plan") => {
    if (sortBy === field) {
      setSortDirection(prev => prev === "desc" ? "asc" : "desc");
    } else {
      setSortBy(field);
      setSortDirection("desc");
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredRequests.map(r => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelect = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(i => i !== id));
    }
  };

  const handleBulkReject = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to reject ${selectedIds.length} requests?`)) return;

    setIsProcessingBulk(true);
    try {
      const updates = selectedIds.map(id => {
        const req = requests.find(r => r.id === id);
        if (!req) return Promise.resolve();
        return db.saveRequest({ ...req, status: "Rejected", updatedAt: new Date().toISOString() });
      });
      await Promise.all(updates);
      await loadRequests();
      setSelectedIds([]);
    } catch (error) {
      console.error("Bulk reject failed:", error);
    } finally {
      setIsProcessingBulk(false);
    }
  };

  const handleBulkAction = async (action: 'archive' | 'restore' | 'delete') => {
    if (selectedIds.length === 0) return;
    
    const count = selectedIds.length;
    let message = `Are you sure you want to ${action} ${count} requests?`;
    if (action === 'delete') {
      message = `Are you sure you want to permanently delete ${count} requests? This cannot be undone.`;
    }
    
    if (!window.confirm(message)) return;

    setIsProcessingBulk(true);
    try {
      if (action === 'delete') {
        const deletes = selectedIds.map(id => db.deleteRequest(id));
        await Promise.all(deletes);
        showToast(`${count} requests permanently deleted`, "success");
      } else {
        const updates = selectedIds.map(id => {
          const req = requests.find(r => r.id === id);
          if (!req) return Promise.resolve();
          
          if (action === 'archive') {
            return db.saveRequest({ ...req, archived: true, deletedAt: new Date().toISOString() });
          } else {
            const updatedReq = { ...req, archived: false, status: "Pending" as const, updatedAt: new Date().toISOString() };
            delete updatedReq.deletedAt;
            return db.saveRequest(updatedReq);
          }
        });
        await Promise.all(updates);
        showToast(`${count} requests ${action === 'archive' ? 'archived' : 'restored'}`, "success");
      }
      await loadRequests();
      setSelectedIds([]);
    } catch (error) {
      console.error(`Bulk ${action} failed:`, error);
      showToast(`Bulk ${action} failed`, "error");
    } finally {
      setIsProcessingBulk(false);
    }
  };

  const handleAction = async (id: string, action: 'archive' | 'restore' | 'delete') => {
    const req = requests.find(r => r.id === id);
    if (!req) return;

    try {
      if (action === 'delete') {
        if (!window.confirm("Are you sure you want to permanently delete this request? This cannot be undone.")) return;
        await db.deleteRequest(id);
        showToast("Request permanently deleted", "success");
      } else if (action === 'archive') {
        await db.saveRequest({ ...req, archived: true, deletedAt: new Date().toISOString() });
        showToast("Request moved to archive", "success");
      } else if (action === 'restore') {
        const updatedReq = { ...req, archived: false, status: "Pending" as const, updatedAt: new Date().toISOString() };
        delete updatedReq.deletedAt;
        await db.saveRequest(updatedReq);
        showToast("Request restored to Pending", "success");
      }
      loadRequests();
    } catch (error) {
      console.error(`Failed to ${action} request:`, error);
      showToast(`Failed to ${action} request`, "error");
    }
  };

  const totalReqs = requests.filter(r => !r.archived).length;
  const pendingReqs = requests.filter(r => r.status === "Pending" && !r.archived).length;
  const approvedReqs = requests.filter(r => r.status === "Approved" && !r.archived).length;
  const conversionRate = totalReqs > 0 ? Math.round((approvedReqs / totalReqs) * 100) : 0;

  const getStatusColor = (status: RequestStatus) => {
    switch (status) {
      case 'Pending': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Approved': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Rejected': return 'bg-rose-100 text-rose-700 border-rose-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusIcon = (status: RequestStatus) => {
    switch (status) {
      case 'Pending': return <Clock className="w-3.5 h-3.5" />;
      case 'Approved': return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'Rejected': return <XCircle className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Incoming Requests</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Review and process new subscription requests</p>
        </div>
      </div>

      {!isLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-center">
            <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Total Requests</span>
            <div className="text-3xl font-black text-slate-900 mt-2">{totalReqs}</div>
          </div>
          <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200 shadow-sm flex flex-col justify-center">
            <span className="text-sm font-bold text-amber-600 uppercase tracking-widest">Pending</span>
            <div className="text-3xl font-black text-amber-900 mt-2">{pendingReqs}</div>
          </div>
          <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-200 shadow-sm flex flex-col justify-center">
            <span className="text-sm font-bold text-emerald-600 uppercase tracking-widest">Approved</span>
            <div className="text-3xl font-black text-emerald-900 mt-2">{approvedReqs}</div>
          </div>
          <div className="bg-indigo-50 rounded-2xl p-5 border border-indigo-200 shadow-sm flex flex-col justify-center relative overflow-hidden group">
            <div className="flex justify-between items-start">
              <span className="text-sm font-bold text-indigo-600 uppercase tracking-widest">Conversion</span>
              <div className="flex items-center gap-1 bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tight">
                All-time
              </div>
            </div>
            <div className="text-3xl font-black text-indigo-900 mt-2">{conversionRate}%</div>
            <HelpCircle className="absolute -right-2 -bottom-2 w-12 h-12 text-indigo-500/10" />
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 min-w-max">
          {[
            { id: "All", label: "Inbox (Active)", icon: Inbox },
            { id: "Pending", label: "Pending", icon: Clock },
            { id: "Approved", label: "Converted", icon: CheckCircle2 },
            { id: "Rejected", label: "Rejected", icon: XCircle },
            { id: "Archived", label: "Archived", icon: Archive },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                statusFilter === tab.id
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <tab.icon className={`w-4 h-4 ${statusFilter === tab.id ? "text-white" : "text-slate-400"}`} />
              {tab.label}
              {tab.id === "Pending" && pendingReqs > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                  statusFilter === "Pending" ? "bg-indigo-500 text-white" : "bg-amber-100 text-amber-700"
                }`}>
                  {pendingReqs}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by name, email, or WhatsApp..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900 shadow-sm"
          />
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap hidden lg:block">Filter by:</span>
          <div className="relative w-full md:w-48">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
            <select
              value={contactFilter}
              onChange={(e) => setContactFilter(e.target.value as any)}
              className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 appearance-none cursor-pointer shadow-sm text-sm"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\' /%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1rem' }}
            >
              <option value="All">All Channels</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Email">Email</option>
              <option value="Reddit">Reddit</option>
            </select>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-center justify-between shadow-sm"
          >
            <span className="font-bold text-indigo-900">{selectedIds.length} request(s) selected</span>
            <div className="flex gap-3">
              {statusFilter !== "Archived" ? (
                <>
                  <button 
                    onClick={handleBulkReject}
                    disabled={isProcessingBulk}
                    className="px-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 shadow-sm transition disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    Bulk Reject
                  </button>
                  <button 
                    onClick={() => handleBulkAction('archive')}
                    disabled={isProcessingBulk}
                    className="px-4 py-2 bg-white text-rose-600 border border-rose-200 rounded-xl font-bold flex items-center gap-2 hover:bg-rose-50 shadow-sm transition disabled:opacity-50"
                  >
                    <Archive className="w-4 h-4" />
                    Bulk Archive
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => handleBulkAction('restore')}
                    disabled={isProcessingBulk}
                    className="px-4 py-2 bg-white text-emerald-600 border border-emerald-200 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-50 shadow-sm transition disabled:opacity-50"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Bulk Restore
                  </button>
                  <button 
                    onClick={() => handleBulkAction('delete')}
                    disabled={isProcessingBulk}
                    className="px-4 py-2 bg-rose-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-rose-700 shadow-sm shadow-rose-600/20 transition disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Bulk Delete
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 w-12">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.length === filteredRequests.length && filteredRequests.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                  />
                </th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition group" onClick={() => toggleSort("date")}>
                  <div className="flex items-center">
                    Date
                    <ArrowUpDown className={`w-3.5 h-3.5 ml-2 ${sortBy === 'date' ? 'text-indigo-600' : 'text-slate-300 group-hover:text-slate-500'}`} />
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Name & Contact</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition group" onClick={() => toggleSort("plan")}>
                  <div className="flex items-center">
                    Requested Subscription
                    <ArrowUpDown className={`w-3.5 h-3.5 ml-2 ${sortBy === 'plan' ? 'text-indigo-600' : 'text-slate-300 group-hover:text-slate-500'}`} />
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AnimatePresence>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
                        <p className="font-medium">Loading requests...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredRequests.length === 0 ? (
                  <motion.tr
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center space-y-3 max-w-md mx-auto">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                          <SearchX className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="font-bold text-slate-900 text-lg">
                          {searchTerm ? "No matching requests found" : 
                           statusFilter === "All" ? "Your inbox is clear!" :
                           `No ${statusFilter.toLowerCase()} requests found`}
                        </p>
                        <p className="text-sm">
                          {searchTerm ? "Try adjusting your search terms or filters." :
                           statusFilter === "All" ? "All active requests have been processed. Try checking Converted or Rejected folders." :
                           `There are currently no requests with "${statusFilter}" status.`}
                        </p>
                        {!searchTerm && statusFilter === "All" && (
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => setStatusFilter("Approved")} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">View Converted</button>
                            <button onClick={() => setStatusFilter("Pending")} className="text-xs font-bold text-amber-600 hover:text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg transition-colors">View Pending</button>
                          </div>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ) : (
                  filteredRequests.map((request) => (
                    <motion.tr 
                      key={request.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`hover:bg-slate-50/80 transition-colors group ${selectedIds.includes(request.id) ? 'bg-indigo-50/30' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.includes(request.id)}
                          onChange={(e) => handleSelect(request.id, e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap cursor-pointer" onClick={() => handleSelect(request.id, !selectedIds.includes(request.id))}>
                        <div className="flex items-center text-sm font-medium text-slate-600">
                          <Calendar className="w-4 h-4 mr-2 text-slate-400" />
                          {new Date(request.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-slate-900">{request.fullName}</div>
                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                          <span className="font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] uppercase">
                            {request.preferredContact}
                          </span>
                          {request.preferredContact === 'WhatsApp' ? request.whatsappNumber :
                           request.preferredContact === 'Email' ? request.email :
                           request.redditUsername}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-slate-900">{request.subscriptionType}</div>
                        <div className="text-xs text-slate-500 mt-0.5 font-medium">{request.subscriptionPeriod} plan</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(request.status)}`}>
                          <span className="mr-1.5">{getStatusIcon(request.status)}</span>
                          {request.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {request.archived ? (
                            <>
                              <button 
                                onClick={() => handleAction(request.id, 'restore')}
                                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Restore to Pending"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleAction(request.id, 'delete')}
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Permanently Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          ) : request.status === 'Rejected' ? (
                            <>
                              <button 
                                onClick={() => handleAction(request.id, 'restore')}
                                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Restore to Pending"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleAction(request.id, 'archive')}
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Archive Request"
                              >
                                <Archive className="w-4 h-4" />
                              </button>
                            </>
                          ) : null}
                          <Link 
                            to={`/requests/${request.id}`}
                            className="inline-flex items-center justify-center px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm group-hover:shadow group-hover:border-indigo-200"
                          >
                            Review
                            <ChevronRight className="w-4 h-4 ml-1 opacity-50 group-hover:opacity-100" />
                          </Link>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
