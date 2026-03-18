import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Save, User, Phone, Bell, MessageSquare, Linkedin, Globe, CreditCard, Calendar as CalendarIcon } from "lucide-react";
import { addMonths, format, parseISO, isValid } from "date-fns";
import * as db from "../../services/db";
import { useToast } from "../../components/ui/Toast";
import type { Customer, Subscription, SubscriptionType } from "../../types/index";

const DEFAULT_PRICES: Record<SubscriptionType, string> = {
  'Premium Career': '25.00',
  'Premium Business': '25.00',
  'Premium Company Page': '35.00',
  'Recruiter Lite': '125.00',
  'Sales Navigator Core': '75.00',
  'Sales Navigator Advanced': '115.00',
  'Sales Navigator Advanced Plus': '135.00'
};

export function CustomerForm() {
  const { showToast } = useToast();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;

  const [formData, setFormData] = useState<Partial<Customer>>({
    fullName: "",
    whatsappNumber: "",
    email: "",
    linkedinUrl: "",
    country: "",
    leadSource: "",
    notes: [],
    status: "New",
    reminderPreferences: {
      days: [7, 3, 1],
      channel: 'WhatsApp'
    }
  });

  const [subData, setSubData] = useState({
    subscriptionType: "" as SubscriptionType | "",
    durationMonths: 1,
    price: "",
    startDate: format(new Date(), 'yyyy-MM-dd'),
    renewalDate: ""
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isEditing && id) {
      (async () => {
        const existingCustomer = await db.getCustomer(id);
        if (existingCustomer) {
          setFormData(existingCustomer);
          const subs = await db.getCustomerSubscriptions(id);
          if (subs.length > 0) {
            const latest = subs[subs.length - 1];
            setSubData({
              subscriptionType: latest.subscriptionType || ("" as any),
              durationMonths: latest.durationMonths || 1,
              price: latest.price.toString(),
              startDate: latest.startDate.split('T')[0],
              renewalDate: latest.renewalDate.split('T')[0]
            });
          }
        } else {
          navigate("/customers");
        }
      })();
    }
  }, [id, isEditing, navigate]);

  // Auto-calculate renewal date
  useEffect(() => {
    if (subData.startDate && subData.durationMonths && isValid(parseISO(subData.startDate))) {
      const start = parseISO(subData.startDate);
      const renewal = addMonths(start, subData.durationMonths);
      setSubData(prev => ({ ...prev, renewalDate: format(renewal, 'yyyy-MM-dd') }));
    }
  }, [subData.startDate, subData.durationMonths]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checkbox = e.target as HTMLInputElement;
      const val = parseInt(value);
      const currentDays = formData.reminderPreferences?.days || [];
      const newDays = checkbox.checked 
        ? [...currentDays, val].sort((a, b) => b - a)
        : currentDays.filter(d => d !== val);
      
      setFormData(prev => ({
        ...prev,
        reminderPreferences: {
          ...prev.reminderPreferences!,
          days: newDays
        }
      }));
      return;
    }

    if (name === 'reminderChannel') {
      setFormData(prev => ({
        ...prev,
        reminderPreferences: {
          ...prev.reminderPreferences!,
          channel: value as any
        }
      }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'subscriptionType' && value) {
      const defaultPrice = DEFAULT_PRICES[value as SubscriptionType] || "0.00";
      setSubData(prev => ({ 
        ...prev, 
        subscriptionType: value as SubscriptionType,
        price: defaultPrice
      }));
      return;
    }

    setSubData(prev => ({ 
      ...prev, 
      [name]: name === 'durationMonths' ? parseInt(value) || 0 : value 
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    // Validation
    if (!formData.fullName) {
      showToast("Customer name is required.", "error");
      return;
    }
    
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      showToast("Please enter a valid email address.", "error");
      return;
    }

    if (formData.whatsappNumber && !/^\+?[0-9\s-]{8,}$/.test(formData.whatsappNumber)) {
      showToast("Please enter a valid phone number.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();
      
      const customer: Customer = {
        ...formData,
        status: subData.subscriptionType ? 'Active' : formData.status || 'New',
        id: isEditing ? (id as string) : `c_${Date.now()}`,
        createdAt: isEditing ? (formData.createdAt as string) : now,
        updatedAt: now,
        notes: typeof formData.notes === 'string' 
          ? [{ id: `n_${Date.now()}`, date: now, text: formData.notes }]
          : formData.notes || []
      } as Customer;

      await db.saveCustomer(customer);

      // Save/Update Subscription if type is selected
      if (subData.subscriptionType) {
        const existingSubs = await db.getCustomerSubscriptions(customer.id);
        const subId = (isEditing && existingSubs.length > 0) ? existingSubs[existingSubs.length - 1].id : `s_${Date.now()}`;
        
        const subscription: Subscription = {
          id: subId,
          customerId: customer.id,
          subscriptionType: subData.subscriptionType as SubscriptionType,
          durationMonths: subData.durationMonths,
          planDuration: `${subData.durationMonths}M` as any,
          price: parseFloat(subData.price) || 0,
          startDate: new Date(subData.startDate).toISOString(),
          renewalDate: new Date(subData.renewalDate).toISOString(),
          paymentStatus: 'Paid',
          status: 'Active',
          autoRenew: false,
          updatedAt: now,
          createdAt: (isEditing && existingSubs.length > 0) ? existingSubs[existingSubs.length - 1].createdAt : now
        };
        
        await db.saveSubscription(subscription);
        await db.logTransaction(subscription);
      }

      showToast(isEditing ? "Customer updated successfully" : "Customer created successfully", "success");
      navigate(`/customers/${customer.id}`);
    } catch (err) {
      console.error("Save failed:", err);
      showToast("Failed to save. Please try again.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link 
          to={isEditing ? `/customers/${id}` : "/customers"}
          className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            {isEditing ? "Edit Customer" : "Add New Customer"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {isEditing ? "Update customer details and preferences." : "Enter the details for your new customer."}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 space-y-8">
          
          {/* Section: Basic Info */}
          <section>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-[0.15em] mb-6 flex items-center gap-2 border-b border-slate-100 pb-3">
              <User className="w-4 h-4 text-indigo-500" />
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Full Name *</label>
                <input 
                  type="text" 
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  placeholder="e.g. John Smith"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Status</label>
                <select 
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-white"
                >
                  <option value="New">New</option>
                  <option value="In Follow-up">In Follow-up</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Lead Source</label>
                <select 
                  name="leadSource"
                  value={formData.leadSource}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-white"
                >
                  <option value="">Select Source</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Reddit">Reddit</option>
                  <option value="Referral">Referral</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Website">Website</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </section>

          {/* Section: Contact Details */}
          <section>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-[0.15em] mb-6 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Phone className="w-4 h-4 text-indigo-500" />
              Contact Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">WhatsApp Number</label>
                <div className="relative">
                  <input 
                    type="text" 
                    name="whatsappNumber"
                    value={formData.whatsappNumber}
                    onChange={handleChange}
                    placeholder="+44 7700 900000"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <MessageSquare className="w-4 h-4 text-slate-300" />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Email Address</label>
                <input 
                  type="email" 
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="email@example.com"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Country</label>
                <div className="relative">
                  <input 
                    type="text" 
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    placeholder="e.g. UAE"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                  <Globe className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">LinkedIn URL</label>
                <div className="relative group">
                  <input 
                    type="url" 
                    name="linkedinUrl"
                    value={formData.linkedinUrl}
                    onChange={handleChange}
                    placeholder="https://linkedin.com/..."
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                  {formData.linkedinUrl && (
                    <a 
                      href={formData.linkedinUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-600 transition-colors"
                      title="Preview Profile"
                    >
                      <Linkedin className="w-4 h-4" />
                    </a>
                  )}
                  {!formData.linkedinUrl && (
                    <Linkedin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Section: Subscription Info */}
          <section>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-[0.15em] mb-6 flex items-center gap-2 border-b border-slate-100 pb-3">
              <CreditCard className="w-4 h-4 text-indigo-500" />
              Subscription Info
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Subscription Type *</label>
                <select 
                  name="subscriptionType"
                  value={subData.subscriptionType}
                  onChange={handleSubChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-white"
                >
                  <option value="">Select Subscription</option>
                  <option value="Premium Career">Premium Career</option>
                  <option value="Premium Business">Premium Business</option>
                  <option value="Premium Company Page">Premium Company Page</option>
                  <option value="Recruiter Lite">Recruiter Lite</option>
                  <option value="Sales Navigator Core">Sales Navigator Core</option>
                  <option value="Sales Navigator Advanced">Sales Navigator Advanced</option>
                  <option value="Sales Navigator Advanced Plus">Sales Navigator Advanced Plus</option>
                </select>
              </div>

              {subData.subscriptionType && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Duration</label>
                    <select 
                      name="durationMonths"
                      value={subData.durationMonths}
                      onChange={handleSubChange}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-white"
                    >
                      <option value={1}>1 month</option>
                      <option value={2}>2 months</option>
                      <option value={3}>3 months</option>
                      <option value={6}>6 months</option>
                      <option value={9}>9 months</option>
                      <option value={12}>12 months</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Price</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">£</span>
                      <input 
                        type="number" 
                        step="0.01"
                        name="price"
                        value={subData.price}
                        onChange={handleSubChange}
                        placeholder="25.00"
                        className="w-full px-8 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Start Date *</label>
                    <div className="relative">
                      <input 
                        type="date" 
                        name="startDate"
                        value={subData.startDate}
                        onChange={handleSubChange}
                        required={!!subData.subscriptionType}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Renewal Date</label>
                    <div className="relative">
                      <input 
                        type="date" 
                        name="renewalDate"
                        value={subData.renewalDate}
                        readOnly
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-500 cursor-not-allowed outline-none"
                      />
                      <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Section: Reminder Preferences */}
          <section>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-[0.15em] mb-6 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Bell className="w-4 h-4 text-indigo-500" />
              Reminder Preferences
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-700">Send Reminders</label>
                <div className="flex flex-wrap gap-4">
                  {[7, 3, 1].map(day => (
                    <label key={day} className="flex items-center gap-2 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        value={day}
                        checked={formData.reminderPreferences?.days.includes(day)}
                        onChange={handleChange}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 transition-all"
                      />
                      <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">{day} days before</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Preferred Channel</label>
                <select 
                  name="reminderChannel"
                  value={formData.reminderPreferences?.channel}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-white"
                >
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Email">Email</option>
                  <option value="SMS">SMS</option>
                </select>
              </div>
            </div>
          </section>

          {/* Section: Notes */}
          <section>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-[0.15em] mb-6 flex items-center gap-2 border-b border-slate-100 pb-3">
              <MessageSquare className="w-4 h-4 text-indigo-500" />
              Customer Notes
            </h3>
            <div className="space-y-2">
              <textarea 
                name="notes"
                value={typeof formData.notes === 'string' ? formData.notes : ''}
                onChange={handleChange}
                rows={4}
                placeholder="Add initial notes or update details..."
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-y"
              />
              <p className="text-[10px] text-slate-400 font-medium italic">Note: Editing here updates the current general note. History is viewed in the profile timeline.</p>
            </div>
          </section>

        </div>
        
        <div className="sticky bottom-0 p-6 border-t border-slate-200 bg-white/95 backdrop-blur-sm flex justify-end gap-3 z-30 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.05)]">
          <Link 
            to={isEditing ? `/customers/${id}` : "/customers"}
            className="px-6 py-2.5 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-bold text-sm transition-all"
          >
            Cancel
          </Link>
          <button 
            type="submit"
            className="inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-200 ring-4 ring-indigo-50"
          >
            <Save className="w-4 h-4 mr-2" />
            {isEditing ? "Save Changes" : "Create Customer"}
          </button>
        </div>
      </form>
    </div>
  );
}
