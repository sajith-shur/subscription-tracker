import { useState, useEffect } from "react";
import { Send, User, CreditCard, CheckCircle2, ShieldCheck, Zap, HeadphonesIcon, AlertCircle, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import * as db from "../../services/db";
import { useLocalization } from "../../contexts/LocalizationContext";
import type { IntakeRequest, ManagedSubscriptionType } from "../../types/index";
export function IntakeForm() {
  const { formatCurrency } = useLocalization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const [managedTypes, setManagedTypes] = useState<ManagedSubscriptionType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [spamError, setSpamError] = useState("");


  useEffect(() => {
    const fetchTypes = async () => {
      try {
        const types = await db.getActiveSubscriptionTypes();
        setManagedTypes(types);
      } catch (err) {
        setLoadError("Could not load subscription products. Please try again later.");
      } finally {
        setLoadingTypes(false);
      }
    };
    fetchTypes();
  }, []);

  const [formData, setFormData] = useState({
    fullName: "",
    preferredContact: "WhatsApp" as "WhatsApp" | "Email" | "Reddit",
    whatsappNumber: "",
    email: "",
    redditUsername: "",
    subscriptionType: "",
    subscriptionPeriod: "",
    notes: ""
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleContactChange = (method: "WhatsApp" | "Email" | "Reddit") => {
    setFormData(prev => ({
      ...prev,
      preferredContact: method,
      whatsappNumber: method === "WhatsApp" ? prev.whatsappNumber : "",
      email: method === "Email" ? prev.email : "",
      redditUsername: method === "Reddit" ? prev.redditUsername : ""
    }));
    
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.whatsappNumber;
      delete newErrors.email;
      delete newErrors.redditUsername;
      return newErrors;
    });
  };

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.fullName.trim()) newErrors.fullName = "Name is required";
    
    if (formData.preferredContact === "WhatsApp") {
      if (!formData.whatsappNumber.trim()) {
        newErrors.whatsappNumber = "WhatsApp number is required";
      } else if (!/^\+?[0-9\s-()]{8,20}$/.test(formData.whatsappNumber)) {
        newErrors.whatsappNumber = "Please enter a valid phone number (digits only)";
      }
    }
    
    if (formData.preferredContact === "Email") {
      if (!formData.email.trim()) {
        newErrors.email = "Email is required";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = "Please enter a valid email address";
      }
    }

    if (formData.preferredContact === "Reddit" && !formData.redditUsername.trim()) {
      newErrors.redditUsername = "Reddit username is required";
    }
    
    if (formData.notes.length > 500) {
      newErrors.notes = "Notes cannot exceed 500 characters";
    }

    if (!formData.subscriptionType) {
      newErrors.subscriptionType = "Please select a subscription type";
    } else {
      const typeObj = managedTypes.find(t => t.name === formData.subscriptionType && t.active);
      if (!typeObj) {
        newErrors.subscriptionType = "Invalid or inactive subscription type selected";
      } else {
        if (!formData.subscriptionPeriod) {
          newErrors.subscriptionPeriod = "Please select a duration";
        } else {
          const durObj = typeObj.durations.find(d => `${d.months}M` === formData.subscriptionPeriod && d.active);
          if (!durObj) {
            newErrors.subscriptionPeriod = "Invalid or inactive duration selected";
          }
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSpamError("");
    
    // Abuse protection cooldown check
    const lastSubmitTime = sessionStorage.getItem("crm_last_submit_time");
    if (lastSubmitTime && Date.now() - parseInt(lastSubmitTime) < 60 * 1000) {
      setSpamError("Please wait 60 seconds before submitting another request.");
      return;
    }

    if (!validate() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();
      const typeObj = managedTypes.find(t => t.name === formData.subscriptionType);
      const durObj = typeObj?.durations.find(d => `${d.months}M` === formData.subscriptionPeriod);

      const request: Omit<IntakeRequest, "id"> & { id: string } = {
        id: `req_${Date.now()}`,
        ...formData,
        subscriptionType: formData.subscriptionType,
        subscriptionPeriod: formData.subscriptionPeriod,
        subscriptionTypeId: typeObj?.id,
        subscriptionTypeName: typeObj?.name,
        durationMonths: durObj?.months,
        durationLabel: durObj?.label,
        status: "Pending",
        createdAt: now,
        updatedAt: now
      };

      await db.saveRequest(request as IntakeRequest);
      sessionStorage.setItem("crm_last_submit_time", Date.now().toString());
      setIsSuccess(true);
    } catch (error) {
      console.error("Failed to submit request:", error);
      alert("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-3xl p-8 md:p-12 shadow-xl border border-slate-100 text-center"
        >
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-4">Request Received!</h2>
          <p className="text-slate-500 leading-relaxed mb-8">
            Thank you for your interest, {formData.fullName}. We have received your subscription request and will be in touch via {formData.preferredContact} shortly to process your setup.
          </p>
          <button
            onClick={() => {
              setIsSuccess(false);
              setFormData({
                fullName: "", preferredContact: "WhatsApp", whatsappNumber: "", 
                email: "", redditUsername: "", subscriptionType: "", subscriptionPeriod: "6M", notes: ""
              });
            }}
            className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20"
          >
            Submit Another Request
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-950 via-slate-900 to-slate-50">
      {/* Admin access bar */}
      <div className="flex justify-end px-6 py-3">
        <Link
          to="/"
          className="text-xs font-bold text-indigo-300/60 hover:text-indigo-300 transition-colors"
        >
          Admin Panel →
        </Link>
      </div>

      {/* Hero */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-14 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="inline-block text-xs font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full px-4 py-1.5 uppercase tracking-widest mb-6">
            LinkedIn Premium Access
          </span>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-[1.15] mb-5">
            Get Your Subscription<br />
            <span className="text-indigo-400">Activated Today</span>
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed max-w-lg mx-auto mb-10">
            Fill in your details and we'll get you set up with premium access — fast, secure, and hassle-free.
          </p>
          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8">
            <div className="flex items-center gap-2 text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold">Secure & Encrypted</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-semibold">Fast Activation</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <HeadphonesIcon className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-semibold">Expert Support</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Form card */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-20">

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 md:p-10 shadow-xl border border-slate-100 space-y-8">
          
          {/* Personal Details */}
          <div className="space-y-6">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <User className="w-4 h-4" /> Personal Details
            </h3>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Full Name <span className="text-rose-500">*</span></label>
              <input
                type="text"
                value={formData.fullName}
                onChange={e => handleChange('fullName', e.target.value)}
                className={`w-full bg-slate-50 border ${errors.fullName ? 'border-red-300 focus:ring-red-500' : 'border-slate-200 focus:ring-indigo-500'} rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2`}
                placeholder="John Doe"
              />
              {errors.fullName && <p className="text-red-500 text-xs mt-1 font-medium">{errors.fullName}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Preferred Contact <span className="text-rose-500">*</span></label>
                <select
                  value={formData.preferredContact}
                  onChange={e => handleContactChange(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium appearance-none"
                  style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\' /%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.25rem' }}
                >
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Email">Email</option>
                  <option value="Reddit">Reddit</option>
                </select>
              </div>

              {formData.preferredContact === "WhatsApp" && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                  <label className="block text-sm font-bold text-slate-700 mb-2">WhatsApp Number <span className="text-rose-500">*</span></label>
                  <input
                    type="tel"
                    value={formData.whatsappNumber}
                    onChange={e => handleChange('whatsappNumber', e.target.value)}
                    className={`w-full bg-slate-50 border ${errors.whatsappNumber ? 'border-red-300 focus:ring-red-500' : 'border-slate-200 focus:ring-indigo-500'} rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2`}
                    placeholder="+1 234 567 8900"
                  />
                  {errors.whatsappNumber && <p className="text-red-500 text-xs mt-1 font-medium">{errors.whatsappNumber}</p>}
                </motion.div>
              )}

              {formData.preferredContact === "Email" && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Email Address <span className="text-rose-500">*</span></label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => handleChange('email', e.target.value)}
                    className={`w-full bg-slate-50 border ${errors.email ? 'border-red-300 focus:ring-red-500' : 'border-slate-200 focus:ring-indigo-500'} rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2`}
                    placeholder="john@example.com"
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-1 font-medium">{errors.email}</p>}
                </motion.div>
              )}

              {formData.preferredContact === "Reddit" && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Reddit Username <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={formData.redditUsername}
                    onChange={e => handleChange('redditUsername', e.target.value)}
                    className={`w-full bg-slate-50 border ${errors.redditUsername ? 'border-red-300 focus:ring-red-500' : 'border-slate-200 focus:ring-indigo-500'} rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2`}
                    placeholder="u/username"
                  />
                  {errors.redditUsername && <p className="text-red-500 text-xs mt-1 font-medium">{errors.redditUsername}</p>}
                </motion.div>
              )}
            </div>
            
            {/* Show other contact fields as optional if not preferred */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
               {formData.preferredContact !== "WhatsApp" && (
                 <div>
                   <label className="block text-sm font-bold text-slate-700 mb-2">WhatsApp Number (Optional)</label>
                   <input
                     type="tel"
                     value={formData.whatsappNumber}
                     onChange={e => setFormData({...formData, whatsappNumber: e.target.value})}
                     className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                     placeholder="+1 234 567 8900"
                   />
                 </div>
               )}
               {formData.preferredContact !== "Email" && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Email Address (Optional)</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => handleChange('email', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="john@example.com"
                  />
                </div>
               )}
               {formData.preferredContact !== "Reddit" && (
                 <div>
                   <label className="block text-sm font-bold text-slate-700 mb-2">Reddit Username (Optional)</label>
                   <input
                     type="text"
                     value={formData.redditUsername}
                     onChange={e => handleChange('redditUsername', e.target.value)}
                     className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                     placeholder="u/username"
                   />
                 </div>
               )}
             </div>
          </div>

          {/* Subscription Details */}
          <div className="space-y-6 pt-8 border-t border-slate-100">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> Subscription Request
            </h3>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Subscription Type <span className="text-rose-500">*</span></label>
              
              {loadingTypes ? (
                <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-400 flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin"></div>
                  Loading options...
                </div>
              ) : loadError ? (
                <div className="w-full bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {loadError}
                </div>
              ) : (
                <select
                  value={formData.subscriptionType}
                  onChange={e => {
                    const newType = e.target.value;
                    const typeObj = managedTypes.find(t => t.name === newType);
                    const defaultDur = typeObj?.durations.find(d => d.isDefault && d.active);
                    const firstActive = typeObj?.durations.find(d => d.active);
                    const defaultPeriod = defaultDur ? `${defaultDur.months}M` : firstActive ? `${firstActive.months}M` : "";
                    
                    setFormData(prev => ({ 
                      ...prev, 
                      subscriptionType: newType,
                      subscriptionPeriod: prev.subscriptionType === newType ? prev.subscriptionPeriod : defaultPeriod
                    }));
                    if (errors.subscriptionType) {
                      setErrors(prev => { const e = {...prev}; delete e.subscriptionType; return e; });
                    }
                  }}
                  className={`w-full bg-slate-50 border ${errors.subscriptionType ? 'border-red-300 focus:ring-red-500' : 'border-slate-200 focus:ring-indigo-500'} rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 font-medium appearance-none`}
                  style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\' /%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.25rem' }}
                >
                  <option value="">Select a subscription...</option>
                  {managedTypes.map(type => (
                    <option key={type.id} value={type.name}>{type.name}</option>
                  ))}
                </select>
              )}
              {errors.subscriptionType && <p className="text-red-500 text-xs mt-1 font-medium">{errors.subscriptionType}</p>}
            </div>

            <AnimatePresence>
              {formData.subscriptionType && !loadingTypes && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <label className="block text-sm font-bold text-slate-700 mb-3 pt-2">Duration <span className="text-rose-500">*</span></label>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-3">
                    {managedTypes
                      .find(t => t.name === formData.subscriptionType)
                      ?.durations.filter(d => d.active)
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map(dur => {
                        const val = `${dur.months}M`;
                        const isSelected = formData.subscriptionPeriod === val;
                        return (
                          <button
                            key={dur.id}
                            type="button"
                            onClick={() => handleChange('subscriptionPeriod', val)}
                            className={`relative py-3 px-4 rounded-xl border flex flex-col items-center justify-center gap-1 ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/20'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/50'
                            } transition-all`}
                          >
                            {dur.isMostPopular && (
                              <span className={`absolute -top-2.5 bg-amber-400 text-amber-950 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm`}>
                                <Star className="w-2.5 h-2.5" /> Popular
                              </span>
                            )}
                            <span className="font-bold">{dur.label}</span>
                            {dur.badgeText && (
                              <span className={`text-[10px] uppercase font-bold tracking-widest ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                                {dur.badgeText}
                              </span>
                            )}
                            {dur.defaultPrice > 0 && (
                              <span className={`text-xs font-semibold ${isSelected ? 'text-white' : 'text-slate-900'} mt-0.5`}>
                                {formatCurrency(dur.defaultPrice)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                  </div>
                  
                  {(!managedTypes.find(t => t.name === formData.subscriptionType)?.durations.filter(d => d.active).length) && (
                    <div className="bg-amber-50 text-amber-600 p-3 rounded-lg text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      No duration options available for this product.
                    </div>
                  )}

                  {errors.subscriptionPeriod && <p className="text-red-500 text-xs mt-1 font-medium">{errors.subscriptionPeriod}</p>}
                </motion.div>
              )}
            </AnimatePresence>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Additional Notes (Optional)</label>
              <textarea
                value={formData.notes}
                onChange={e => handleChange('notes', e.target.value)}
                maxLength={500}
                className={`w-full bg-slate-50 border ${errors.notes ? 'border-red-300 focus:ring-red-500' : 'border-slate-200 focus:ring-indigo-500'} rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 min-h-[100px] resize-y`}
                placeholder="Any special requests or details..."
              />
              {errors.notes && <p className="text-red-500 text-xs mt-1 font-medium">{errors.notes}</p>}
            </div>
          </div>

          <div className="pt-8 border-t border-slate-100">
            {spamError && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {spamError}
              </div>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white font-bold py-4 px-8 rounded-xl hover:bg-indigo-700 transition-colors shadow-xl shadow-indigo-600/20 disabled:opacity-70"
            >
              {isSubmitting ? (
                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Submit Request
                </>
              )}
            </button>
            <p className="text-center text-xs text-slate-400 mt-4 font-medium">
              By submitting this form, you request a subscription setup. We will contact you to finalize the payment and activation.
            </p>
          </div>

        </form>
      </div>
    </div>
  );
}
