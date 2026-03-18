import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, CheckCircle2, XCircle, User, 
  MessageSquare, CreditCard, FileText,
  Zap, ChevronRight, AlertTriangle
} from "lucide-react";
import { useToast } from "../../components/ui/Toast";
import * as db from "../../services/db";
import type { IntakeRequest, Customer, Subscription, PlanDuration, SubscriptionType } from "../../types/index";
import { jsPDF } from "jspdf";

const SUBSCRIPTION_TYPES: SubscriptionType[] = [
  "Premium Career",
  "Premium Business",
  "Premium Company Page",
  "Recruiter Lite",
  "Sales Navigator Core",
  "Sales Navigator Advanced",
  "Sales Navigator Advanced Plus"
];

export function RequestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const [request, setRequest] = useState<IntakeRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Form state for processing
  const [soldPrice, setSoldPrice] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [renewalDate, setRenewalDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"Paid" | "Pending" | "Partial">("Pending");
  const [internalNotes, setInternalNotes] = useState("");
  const [subscriptionType, setSubscriptionType] = useState<SubscriptionType | "">("");
  const [subscriptionPeriod, setSubscriptionPeriod] = useState<PlanDuration | "">("");
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  useEffect(() => {
    if (id) {
      loadRequest(id);
    }
  }, [id]);

  const loadRequest = async (requestId: string) => {
    setIsLoading(true);
    try {
      const data = await db.getRequest(requestId);
      if (data) {
        setRequest(data);
        if (data.soldPrice) setSoldPrice(data.soldPrice.toString());
        if (data.startDate) setStartDate(data.startDate);
        if (data.renewalDate) setRenewalDate(data.renewalDate);
        if (data.paymentStatus) setPaymentStatus(data.paymentStatus);
        if (data.internalNotes) setInternalNotes(data.internalNotes);
        if (data.subscriptionType) setSubscriptionType(data.subscriptionType);
        if (data.subscriptionPeriod) setSubscriptionPeriod(data.subscriptionPeriod);
        
        // Duplicate check
        const allRequests = await db.getRequests();
        const duplicates = allRequests.filter(r => 
          r.id !== data.id && 
          r.status === "Pending" && 
          ((data.whatsappNumber && r.whatsappNumber === data.whatsappNumber) || 
           (data.email && r.email === data.email) ||
           (data.redditUsername && r.redditUsername === data.redditUsername))
        );
        if (duplicates.length > 0) {
          setDuplicateWarning(true);
        }
        
        // Auto-calculate renewal date if not set
        if (!data.renewalDate && data.subscriptionPeriod) {
          const months = parseInt(data.subscriptionPeriod.replace('M', ''));
          const start = new Date(data.startDate || new Date().toISOString());
          start.setMonth(start.getMonth() + months);
          setRenewalDate(start.toISOString().split('T')[0]);
        }
      } else {
        showToast("Request not found", "error");
        navigate("/requests");
      }
    } catch (error) {
      console.error("Failed to load request:", error);
      showToast("Failed to load request", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCalculateRenewal = () => {
    if (!request?.subscriptionPeriod) return;
    const months = parseInt(request.subscriptionPeriod.replace("M", ""));
    if (isNaN(months)) return;
    
    const start = new Date(startDate);
    start.setMonth(start.getMonth() + months);
    setRenewalDate(start.toISOString().split("T")[0]);
  };

  const handleApproveAndConvert = async () => {
    if (!request || !startDate || !renewalDate) {
      showToast("Please fill in start date and renewal date.", "error");
      return;
    }

    const defaultPrice = parseFloat(soldPrice);
    if (isNaN(defaultPrice) || defaultPrice <= 0) {
      showToast("Price must be greater than 0.", "error");
      return;
    }

    setIsProcessing(true);
    try {
      const now = new Date().toISOString();
      const customerId = `cu_${Date.now()}`;
      
      // 1. Create Customer
      const customer: Customer = {
        id: customerId,
        fullName: request.fullName,
        whatsappNumber: request.whatsappNumber || "",
        email: request.email || "",
        linkedinUrl: "", // Not collected in intake yet
        country: "Unknown", // Can be updated later
        leadSource: request.preferredContact === 'Reddit' ? 'Reddit' : 'Organic', // Heuristic
        notes: request.notes,
        status: "Active",
        createdAt: now,
        updatedAt: now
      };

      // 2. Create Subscription
      const subId = `su_${Date.now()}`;
      const subscription: Subscription = {
        id: subId,
        customerId,
        subscriptionType: (subscriptionType as SubscriptionType) || "Sales Navigator Core",
        planDuration: (subscriptionPeriod as PlanDuration) || "6M",
        price: defaultPrice,
        startDate,
        renewalDate,
        paymentStatus,
        status: "Active",
        autoRenew: true,
        createdAt: now,
        updatedAt: now
      };

      // 3. Mark Request as Approved
      const updatedRequest: IntakeRequest = {
        ...request,
        soldPrice: defaultPrice,
        startDate,
        renewalDate,
        paymentStatus,
        internalNotes,
        status: "Approved",
        updatedAt: now
      };

      // Save everything
      await db.saveCustomer(customer);
      await db.saveSubscription(subscription);
      await db.saveRequest(updatedRequest);
      
      // Log initial transaction implicitly by saving sub and calling logTransaction
      await db.logTransaction(subscription);

      showToast("Request approved and customer created!", "success");
      setRequest(updatedRequest);
      
    } catch (error) {
      console.error("Failed to approve request:", error);
      showToast("Failed to process request.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!request) return;
    if (!window.confirm("Are you sure you want to reject this request?")) return;
    
    setIsProcessing(true);
    try {
      const updatedRequest: IntakeRequest = {
        ...request,
        status: "Rejected",
        updatedAt: new Date().toISOString()
      };
      await db.saveRequest(updatedRequest);
      setRequest(updatedRequest);
      showToast("Request rejected.", "success");
    } catch (error) {
      showToast("Failed to reject request.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const getInvoiceText = () => {
    if (!request || !request.soldPrice) return "";
    return `*INVOICE*
-----------------------------
*Customer:* ${request.fullName}
*Subscription:* ${request.subscriptionType} (${request.subscriptionPeriod} plan)
*Activation Date:* ${new Date(request.startDate || startDate).toLocaleDateString()}
*Renewal Date:* ${new Date(request.renewalDate || renewalDate).toLocaleDateString()}
*Total Amount:* £${request.soldPrice}
*Status:* ${request.paymentStatus}

Thank you for your business!`;
  };

  const handleGenerateInvoice = () => {
    if (!request) return;
    
    const doc = new jsPDF();
    
    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("INVOICE", 20, 30);
    
    doc.setFontSize(12);
    
    const startY = 50;
    const lh = 10;
    
    doc.setFont("helvetica", "bold");
    doc.text("Customer:", 20, startY);
    doc.setFont("helvetica", "normal");
    doc.text(request.fullName, 60, startY);
    
    doc.setFont("helvetica", "bold");
    doc.text("Subscription:", 20, startY + lh);
    doc.setFont("helvetica", "normal");
    doc.text(`${request.subscriptionType} (${request.subscriptionPeriod} plan)`, 60, startY + lh);
    
    doc.setFont("helvetica", "bold");
    doc.text("Activation Date:", 20, startY + lh * 2);
    doc.setFont("helvetica", "normal");
    doc.text(new Date(request.startDate || startDate).toLocaleDateString(), 60, startY + lh * 2);
    
    doc.setFont("helvetica", "bold");
    doc.text("Renewal Date:", 20, startY + lh * 3);
    doc.setFont("helvetica", "normal");
    doc.text(new Date(request.renewalDate || renewalDate).toLocaleDateString(), 60, startY + lh * 3);
    
    doc.setFont("helvetica", "bold");
    doc.text("Total Amount:", 20, startY + lh * 4);
    doc.setFont("helvetica", "normal");
    doc.text(`£${request.soldPrice}`, 60, startY + lh * 4);
    
    doc.setFont("helvetica", "bold");
    doc.text("Status:", 20, startY + lh * 5);
    doc.setFont("helvetica", "normal");
    doc.text(request.paymentStatus || "Pending", 60, startY + lh * 5);
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "italic");
    doc.text("Thank you for your business!", 20, startY + lh * 7);
    
    doc.save(`Invoice_${request.fullName.replace(/\s+/g, "_")}.pdf`);
    showToast("PDF Invoice generated!", "success");
  };

  const handleWhatsAppLink = () => {
    if (!request?.whatsappNumber) {
      showToast("No WhatsApp number provided for this request.", "error");
      return;
    }
    const text = getInvoiceText();
    const cleanNumber = request.whatsappNumber.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!request) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Approved': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Rejected': return 'bg-rose-100 text-rose-700 border-rose-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/requests')}
            className="p-2 hover:bg-slate-200 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Request Details</h1>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(request.status)}`}>
                {request.status}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-500 mt-1">Submitted on {new Date(request.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
        
        {request.status === "Approved" && (
          <div className="flex gap-3">
             <button 
               onClick={handleGenerateInvoice}
               className="px-4 py-2 bg-white text-indigo-600 border border-indigo-200 rounded-xl font-bold flex items-center hover:bg-indigo-50 shadow-sm transition"
             >
               <FileText className="w-4 h-4 mr-2" />
               Download PDF Invoice
             </button>
             <button 
               onClick={handleWhatsAppLink}
               className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold flex items-center shadow-lg hover:bg-emerald-600 hover:shadow-emerald-500/25 transition"
             >
               <MessageSquare className="w-4 h-4 mr-2" />
               WhatsApp Link
             </button>
          </div>
        )}
      </div>

      {duplicateWarning && request.status === "Pending" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-amber-800">Potential Duplicate Detected</h4>
            <p className="text-xs text-amber-700 mt-1">There is another pending request with the same contact information.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Side: Submitted Data */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-6">
              <User className="w-4 h-4" /> Client Information
            </h3>
            
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Full Name</label>
                <div className="text-lg font-bold text-slate-900">{request.fullName}</div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Preferred Contact</label>
                  <div className="font-medium text-slate-700">{request.preferredContact}</div>
                </div>
                {request.whatsappNumber && (
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">WhatsApp</label>
                    <div className="font-medium text-slate-700">{request.whatsappNumber}</div>
                  </div>
                )}
                {request.email && (
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Email</label>
                    <div className="font-medium text-slate-700">{request.email}</div>
                  </div>
                )}
                {request.redditUsername && (
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Reddit</label>
                    <div className="font-medium text-slate-700">{request.redditUsername}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-6">
              <CreditCard className="w-4 h-4" /> Subscription Request
            </h3>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Type</label>
                  {request.status === "Pending" ? (
                    <select
                      value={subscriptionType}
                      onChange={e => setSubscriptionType(e.target.value as any)}
                      className="w-full text-sm font-bold text-indigo-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-indigo-500"
                    >
                      {SUBSCRIPTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  ) : (
                    <div className="font-bold text-indigo-600">{request.subscriptionType || 'N/A'}</div>
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Duration</label>
                  {request.status === "Pending" ? (
                    <select
                      value={subscriptionPeriod}
                      onChange={e => setSubscriptionPeriod(e.target.value as any)}
                      className="w-full text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="1M">1 Month</option>
                      <option value="3M">3 Months</option>
                      <option value="6M">6 Months</option>
                      <option value="12M">12 Months</option>
                    </select>
                  ) : (
                    <div className="font-medium text-slate-700">{request.subscriptionPeriod || 'N/A'} plan</div>
                  )}
                </div>
              </div>
              
              {request.notes && (
                <div className="pt-4 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Customer Notes</label>
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-slate-700 text-sm italic">
                    "{request.notes}"
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Admin Processing */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 flex flex-col h-full">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-6">
            <Zap className="w-4 h-4" /> Processing Workflow
          </h3>
          
          <div className="space-y-6 flex-1">
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Agreed Price (£) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium pb-0.5">£</span>
                    <input
                      type="number"
                      value={soldPrice}
                      onChange={e => setSoldPrice(e.target.value)}
                      disabled={request.status !== "Pending"}
                      className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-inner-spin-button]:appearance-none"
                      placeholder="0.00"
                    />
                  </div>
               </div>
               <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Payment Status *</label>
                  <select
                    value={paymentStatus}
                    onChange={e => setPaymentStatus(e.target.value as any)}
                    disabled={request.status !== "Pending"}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium disabled:opacity-50"
                  >
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                    <option value="Partial">Partial</option>
                  </select>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
               <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Activation Date *</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => {
                      setStartDate(e.target.value);
                      // Don't auto-calculate strictly here as they might want manual control,
                      // but they can click the button
                    }}
                    disabled={request.status !== "Pending"}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold disabled:opacity-50 text-sm"
                  />
               </div>
               <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 flex justify-between items-center">
                    Renewal Date *
                    {request.status === "Pending" && (
                      <button onClick={handleCalculateRenewal} className="text-[10px] text-indigo-600 uppercase hover:underline">Auto-calc</button>
                    )}
                  </label>
                  <input
                    type="date"
                    value={renewalDate}
                    onChange={e => setRenewalDate(e.target.value)}
                    disabled={request.status !== "Pending"}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold disabled:opacity-50 text-sm"
                  />
               </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <label className="block text-sm font-bold text-slate-700 mb-2">Internal Admin Notes</label>
              <textarea
                value={internalNotes}
                onChange={e => setInternalNotes(e.target.value)}
                disabled={request.status !== "Pending"}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px] disabled:opacity-50 text-sm"
                placeholder="Private notes about pricing or negotiations..."
              />
            </div>
          </div>
          
          {request.status === "Pending" && (
            <div className="pt-6 mt-6 border-t border-slate-200 grid grid-cols-2 gap-4">
              <button
                onClick={handleReject}
                disabled={isProcessing}
                className="w-full py-3.5 bg-white border-2 border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 transition disabled:opacity-50"
              >
                Reject Request
              </button>
              <button
                onClick={handleApproveAndConvert}
                disabled={isProcessing}
                className="w-full py-3.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Approve & Convert
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
            </div>
          )}
          
          {request.status === "Approved" && (
            <div className="pt-6 mt-6 border-t border-emerald-100 bg-emerald-50 rounded-xl p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-emerald-800">Request Converted</p>
                <p className="text-xs text-emerald-600 mt-1">This request has been successfully converted into a Customer and Subscription record in your CRM.</p>
              </div>
            </div>
          )}

          {request.status === "Rejected" && (
            <div className="pt-6 mt-6 border-t border-rose-100 bg-rose-50 rounded-xl p-4 flex items-start gap-3">
               <XCircle className="w-5 h-5 text-rose-600 mt-0.5" />
               <div>
                <p className="text-sm font-bold text-rose-800">Request Rejected</p>
                <p className="text-xs text-rose-600 mt-1">This request was rejected and archived.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
