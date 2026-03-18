import { useState, useEffect } from "react";
import { Search, Filter, Plus, User, Mail, Phone, MoreHorizontal, Trash2, Calendar } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import * as db from "../../services/db";
import { useToast } from "../../components/ui/Toast";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { getDaysLeft } from "../../utils/dateUtils";
import type { Customer, Subscription } from "../../types/index";

export function CustomerList() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(() => {
    return sessionStorage.getItem('crm_customer_filter') || "All";
  });
  
  // Modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<{id: string, name: string} | null>(null);

  // Search persistence with debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      const current = searchParams.get("search") || "";
      if (searchTerm !== current) {
        if (searchTerm) {
          setSearchParams({ search: searchTerm }, { replace: true });
        } else {
          setSearchParams({}, { replace: true });
        }
      }
    }, 400);

    return () => clearTimeout(handler);
  }, [searchTerm, searchParams, setSearchParams]);

  useEffect(() => {
    (async () => {
      const [customers, subscriptions] = await Promise.all([
        db.getCustomers(),
        db.getSubscriptions()
      ]);
      setCustomers(customers);
      setSubscriptions(subscriptions);
    })();
  }, []);


  useEffect(() => {
    sessionStorage.setItem('crm_customer_filter', statusFilter);
  }, [statusFilter]);

  const initiateDelete = (id: string, name: string) => {
    setCustomerToDelete({ id, name });
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!customerToDelete) return;
    try {
      await db.deleteCustomer(customerToDelete.id);
      setCustomers(prev => prev.filter(c => c.id !== customerToDelete.id));
      showToast(`${customerToDelete.name} deleted successfully`, "success");
    } catch (error) {
      console.error("Deletion failed:", error);
      showToast("Failed to delete customer", "error");
    } finally {
      setCustomerToDelete(null);
    }
  };

  const getCustomerStatus = (customerId: string) => {
    const sub = subscriptions.find(s => s.customerId === customerId);
    if (!sub) return { label: 'No Subscription', color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-300' };
    
    if (sub.status === 'Cancelled') return { label: 'Cancelled', color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' };
    
    const daysLeft = getDaysLeft(sub.renewalDate);
    
    if (daysLeft < 0 || sub.status === 'Expired') {
      return { label: 'Expired', color: 'bg-rose-50 text-rose-700', dot: 'bg-rose-500' };
    }
    if (daysLeft <= 7) {
      return { label: 'Due Soon', color: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' };
    }
    return { label: 'Active', color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' };
  };

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.whatsappNumber.includes(searchTerm);
    const matchesFilter = statusFilter === "All" || c.leadSource === statusFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">Customers</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your customer database and lead sources.</p>
        </div>
        <Link 
          to="/customers/new" 
          className="inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm shadow-indigo-100"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Customer
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-50 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name, email or phone..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select 
              className="bg-slate-50 border-none rounded-xl text-sm py-2 pl-3 pr-8 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium text-slate-600"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Sources</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Reddit">Reddit</option>
              <option value="Direct">Direct</option>
              <option value="Referral">Referral</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Subscription</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contact Info</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    <User className="w-12 h-12 mx-auto mb-3 opacity-10" />
                    <p className="font-medium italic">No customers found matching your criteria</p>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => {
                  const status = getCustomerStatus(customer.id);
                  const sub = subscriptions.find(s => s.customerId === customer.id);
                  
                  return (
                    <tr key={customer.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm shadow-sm ring-1 ring-indigo-100 italic">
                            {customer.fullName.charAt(0)}
                          </div>
                          <div>
                            <Link to={`/customers/${customer.id}`} className="font-bold text-slate-900 hover:text-indigo-600 transition-colors">
                              {customer.fullName}
                            </Link>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">{customer.leadSource}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${status.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {sub ? (
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                              <Calendar className="w-4 h-4 text-slate-400" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-700">{sub.planDuration} Plan</div>
                              <div className="text-[10px] font-medium text-slate-400">Renews {new Date(sub.renewalDate).toLocaleDateString()}</div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-slate-300 italic">No plan active</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                            <Mail className="w-3.5 h-3.5 text-slate-300" />
                            {customer.email}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                            <Phone className="w-3.5 h-3.5 text-slate-300" />
                            {customer.whatsappNumber}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link 
                            to={`/customers/${customer.id}/edit`}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Edit Customer"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Link>
                          <button 
                            onClick={() => initiateDelete(customer.id, customer.fullName)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete Customer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Customer"
        message={`Are you sure you want to delete ${customerToDelete?.name}? This action cannot be undone and will remove all their records.`}
        confirmLabel="Delete Customer"
        isDestructive={true}
      />
    </div>
  );
}
