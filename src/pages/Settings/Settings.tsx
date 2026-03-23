import { useState } from "react";
import { 
  Bell, MessageSquare, Shield, Globe, Save, Download, 
  Database, Link2, CreditCard, Users, Zap, 
  AlertCircle, Trash2, Smartphone, 
  Mail, Settings as SettingsIcon, LayoutDashboard, ChevronRight
} from "lucide-react";
import { storage } from "../../services/storage";
import * as db from "../../services/db";
import { useToast } from "../../components/ui/Toast";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useLocalization } from "../../contexts/LocalizationContext";
import type { AppSettings, AutoSendMode } from "../../types/index";

export function SettingsPage() {
  const { showToast } = useToast();
  const { updateSettings, formatDate: locFormatDate } = useLocalization();
  const [settings, setSettings] = useState<AppSettings>(storage.getSettings());
  const [activeTab, setActiveTab] = useState<'Overview' | 'General' | 'Automation' | 'Notifications' | 'Integrations' | 'Data' | 'Billing' | 'Team'>('Overview');
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const handleSave = () => {
    updateSettings(settings);
    showToast("Settings saved successfully!", "success");
  };

  const handleResetSystem = async () => {
    try {
      await db.resetSystem();
      storage.clearAll();
      showToast("System reset complete. Data cleared.", "success");
      setIsResetConfirmOpen(false);
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error("Reset failed:", error);
      showToast("System reset failed. Please try again.", "error");
    }
  };

  const handleExportCSV = async (filter: 'all' | 'active' | 'expiring7' | 'expired' | string) => {
    try {
      const [allCustomers, allSubscriptions] = await Promise.all([
        db.getCustomers(),
        db.getSubscriptions()
      ]);
      const today = new Date();
      const in7Days = new Date(today);
      in7Days.setDate(today.getDate() + 7);

      const subMap = new Map<string, (typeof allSubscriptions)[0]>();
      allSubscriptions.forEach(s => {
        const existing = subMap.get(s.customerId);
        if (!existing || new Date(s.createdAt) > new Date(existing.createdAt)) {
          subMap.set(s.customerId, s);
        }
      });

      let customers = allCustomers;
      if (filter === 'active') {
        customers = allCustomers.filter(c => subMap.get(c.id)?.status === 'Active');
      } else if (filter === 'expiring7') {
        customers = allCustomers.filter(c => {
          const sub = subMap.get(c.id);
          if (!sub) return false;
          const renewal = new Date(sub.renewalDate);
          return renewal >= today && renewal <= in7Days;
        });
      } else if (filter === 'expired') {
        customers = allCustomers.filter(c => subMap.get(c.id)?.status === 'Expired');
      } else if (filter !== 'all') {
        customers = allCustomers.filter(c => c.leadSource === filter);
      }

      if (customers.length === 0) { showToast('No records match this filter.', 'error'); return; }

      const formatDate = (iso?: string) => iso ? locFormatDate(iso) : '';
      const headers = ['Customer ID', 'Full Name', 'Email', 'WhatsApp', 'Lead Source', 'Status', 'Customer Created Date', 'Start Date', 'Renewal Date', 'Subscription Type', 'Subscription Status', 'Subscription Period', 'Sold Price', 'Payment Method', 'Payment Status', 'Notes', 'Last Contacted'];
      const rows = customers.map(c => {
        const sub = subMap.get(c.id);
        const notes = Array.isArray(c.notes) ? (c.notes as any[]).map((n: any) => n.text).join(' | ') : String(c.notes ?? '');
        return [c.id, c.fullName, c.email, c.whatsappNumber, c.leadSource, c.status, formatDate(c.createdAt), formatDate(sub?.startDate), formatDate(sub?.renewalDate), sub?.subscriptionType ?? '', sub?.status ?? '', sub?.planDuration ?? '', sub ? sub.price.toFixed(2) : '', sub?.paymentStatus ?? '', notes, formatDate(sub?.lastContactedAt)];
      });
      const escape = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;
      const csvContent = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `crm_export_${filter}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast(`Exported ${customers.length} record(s) successfully!`, 'success');
    } catch {
      showToast('Export failed. Please try again.', 'error');
    }
  };


  const handleBackup = async () => {
    try {
      const [customers, subscriptions, reminders, history] = await Promise.all([
        db.getCustomers(),
        db.getSubscriptions(),
        db.getReminders(),
        db.getRenewalHistory()
      ]);
      const data = {
        customers, subscriptions, reminders, history,
        settings: storage.getSettings(),
        version: "1.1.0",
        exportedAt: new Date().toISOString()
      };
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `crm_full_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      showToast("Backup generated successfully!", "success");
    } catch {
      showToast("Failed to generate backup.", "error");
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-indigo-600" />
            Settings
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">Configure your CRM preferences and business automation.</p>
        </div>
        {activeTab !== 'Overview' && (
          <button 
            onClick={handleSave}
            className="inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-2xl font-bold text-sm transition-all shadow-lg shadow-indigo-100"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Nav */}
        <div className="lg:col-span-1 space-y-1 bg-white p-2 rounded-3xl border border-slate-100 shadow-sm h-fit">
          <SettingsTab icon={<LayoutDashboard className="w-4 h-4" />} label="Overview" active={activeTab === 'Overview'} onClick={() => setActiveTab('Overview')} />
          <div className="h-px bg-slate-50 my-2 mx-4" />
          <SettingsTab icon={<Globe className="w-4 h-4" />} label="General" active={activeTab === 'General'} onClick={() => setActiveTab('General')} />
          <SettingsTab icon={<Zap className="w-4 h-4" />} label="Automation" active={activeTab === 'Automation'} onClick={() => setActiveTab('Automation')} />
          <SettingsTab icon={<Bell className="w-4 h-4" />} label="Notifications" active={activeTab === 'Notifications'} onClick={() => setActiveTab('Notifications')} />
          <SettingsTab icon={<Link2 className="w-4 h-4" />} label="Integrations" active={activeTab === 'Integrations'} onClick={() => setActiveTab('Integrations')} />
          <SettingsTab icon={<Shield className="w-4 h-4" />} label="Data & Security" active={activeTab === 'Data'} onClick={() => setActiveTab('Data')} />
          <SettingsTab icon={<CreditCard className="w-4 h-4" />} label="Billing" active={activeTab === 'Billing'} onClick={() => setActiveTab('Billing')} />
          <SettingsTab icon={<Users className="w-4 h-4" />} label="Team" active={activeTab === 'Team'} onClick={() => setActiveTab('Team')} />
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3 min-h-[600px] animate-in fade-in slide-in-from-right-4 duration-500">
          {activeTab === 'Overview' && <OverviewDashboard settings={settings} onNavigate={setActiveTab} />}
          {activeTab === 'General' && <GeneralSettings settings={settings} setSettings={setSettings} />}
          {activeTab === 'Automation' && <AutomationSettings settings={settings} setSettings={setSettings} />}
          {activeTab === 'Notifications' && <NotificationSettings settings={settings} setSettings={setSettings} />}
          {activeTab === 'Integrations' && <IntegrationSettings settings={settings} />}
          {activeTab === 'Data' && <DataSettings onBackup={handleBackup} onReset={() => setIsResetConfirmOpen(true)} onExport={handleExportCSV} />}
          {activeTab === 'Billing' && <BillingPlaceholder />}
          {activeTab === 'Team' && <TeamPlaceholder />}
        </div>
      </div>

      <ConfirmDialog 
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={handleResetSystem}
        title="Reset Entire CRM?"
        message="This will permanently delete all customers, subscriptions, and history. This action cannot be undone."
      />
    </div>
  );
}

function SettingsTab({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3 text-sm font-bold rounded-2xl transition-all group
      ${active 
        ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100/50' 
        : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600 text-slate-500'}`}
    >
      <div className="flex items-center gap-3">
        {icon}
        {label}
      </div>
      {active && <ChevronRight className="w-4 h-4 opacity-50" />}
    </button>
  );
}

function OverviewDashboard({ settings, onNavigate }: { settings: AppSettings, onNavigate: (t: any) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="md:col-span-2 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-3xl p-8 text-white shadow-xl shadow-indigo-100 flex items-center justify-between">
        <div className="space-y-2">
          <h2 className="text-xl font-bold">CRM Health: Good</h2>
          <p className="text-indigo-100 text-sm max-w-md">Your automation is currently active and processing reminders. All connected integrations are reporting healthy status.</p>
        </div>
        <div className="hidden md:block">
           <Zap className="w-16 h-16 text-indigo-300 opacity-50" />
        </div>
      </div>

      <OverviewCard 
        title="Automation" 
        status={settings.autoSendMode === 'ON' ? 'Active' : settings.autoSendMode} 
        description="Renewal reminders processing"
        icon={<Zap className="w-5 h-5" />}
        color="indigo"
        onClick={() => onNavigate('Automation')}
      />
      <OverviewCard 
        title="Notifications" 
        status="Enabled" 
        description="Receiving real-time alerts"
        icon={<Bell className="w-5 h-5" />}
        color="emerald"
        onClick={() => onNavigate('Notifications')}
      />
      <OverviewCard 
        title="Integrations" 
        status="2 Connected" 
        description="WhatsApp & SMTP Active"
        icon={<Link2 className="w-5 h-5" />}
        color="blue"
        onClick={() => onNavigate('Integrations')}
      />
      <OverviewCard 
        title="Last Backup" 
        status="Recent" 
        description="Today at 10:00 AM"
        icon={<Database className="w-5 h-5" />}
        color="slate"
        onClick={() => onNavigate('Data')}
      />
    </div>
  );
}

function OverviewCard({ title, status, description, icon, color, onClick }: any) {
  const colors: any = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    slate: 'bg-slate-50 text-slate-600'
  };

  return (
    <div 
      onClick={onClick}
      className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-2xl ${colors[color]}`}>{icon}</div>
        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${colors[color]} bg-opacity-20`}>
          {status}
        </span>
      </div>
      <h3 className="font-bold text-slate-800">{title}</h3>
      <p className="text-xs text-slate-400 mt-1">{description}</p>
    </div>
  );
}

function GeneralSettings({ settings, setSettings }: { settings: AppSettings, setSettings: (s: AppSettings) => void }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">Organization Profile</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Company Name</label>
            <input 
              type="text" 
              value={settings.organizationName}
              onChange={(e) => setSettings({ ...settings, organizationName: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-500/10 text-sm font-medium"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Contact Email</label>
            <input 
              type="email" 
              value={settings.organizationEmail}
              onChange={(e) => setSettings({ ...settings, organizationEmail: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-500/10 text-sm font-medium"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">Localization</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Currency</label>
            <select 
              value={settings.currency}
              onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-500/10 text-sm font-bold appearance-none"
            >
              <option value="GBP">GBP (£)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Timezone</label>
            <select 
              value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-500/10 text-sm font-bold appearance-none"
            >
              <option>Europe/London</option>
              <option>UTC</option>
              <option>America/New_York</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Date Format</label>
            <select 
              value={settings.dateFormat}
              onChange={(e) => setSettings({ ...settings, dateFormat: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-500/10 text-sm font-bold appearance-none"
            >
              <option>DD/MM/YYYY</option>
              <option>MM/DD/YYYY</option>
              <option>YYYY/MM/DD</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

function AutomationSettings({ settings, setSettings }: { settings: AppSettings, setSettings: (s: AppSettings) => void }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Renewal Reminders</h3>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {(['ON', 'OFF', 'Manual Approval'] as AutoSendMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setSettings({ ...settings, autoSendMode: mode })}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  settings.autoSendMode === mode 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Thresholds</label>
              <div className="space-y-2">
                {[7, 3, 1].map(days => (
                  <label key={days} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-transparent hover:border-indigo-100 cursor-pointer transition-all">
                    <input type="checkbox" checked={settings.reminderThresholds.includes(days)} className="w-4 h-4 rounded-lg border-slate-200 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-sm font-medium text-slate-700">{days} days before renewal</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Delivery Channels</label>
              <div className="space-y-2">
                {['WhatsApp', 'Email', 'SMS'].map(ch => (
                  <label key={ch} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-transparent hover:border-indigo-100 cursor-pointer transition-all">
                    <input type="checkbox" checked={settings.automationChannels.includes(ch as any)} className="w-4 h-4 rounded-lg border-slate-200 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-sm font-medium text-slate-700">{ch}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Message Template</label>
            <textarea 
              value={settings.whatsappTemplate}
              onChange={(e) => setSettings({ ...settings, whatsappTemplate: e.target.value })}
              rows={4}
              className="w-full px-6 py-4 bg-indigo-50/30 border-none rounded-3xl focus:ring-4 focus:ring-indigo-500/10 text-sm font-medium text-slate-700 placeholder:text-slate-300 transition-all leading-relaxed"
            />
            <div className="flex flex-wrap gap-2">
              {['customer_name', 'plan_name', 'days', 'renewal_date', 'price', 'payment_link'].map(tag => (
                <span key={tag} className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100/50">
                  {`{${tag}}`}
                </span>
              ))}
            </div>
          </div>
          
          <button className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all shadow-xl shadow-slate-100 flex items-center justify-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Send Test Message
          </button>
        </div>
      </div>
    </div>
  );
}

function NotificationSettings({ settings, setSettings }: { settings: AppSettings, setSettings: (s: AppSettings) => void }) {
  const togglePref = (key: keyof typeof settings.notificationPreferences) => {
    const prefs = { ...settings.notificationPreferences };
    (prefs[key] as any) = !prefs[key];
    setSettings({ ...settings, notificationPreferences: prefs });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">Alert Preferences</h3>
        <div className="space-y-3">
          <ToggleItem label="Customer Alerts" sub="New, updated, or deleted customers" active={settings.notificationPreferences.customerAlerts} onToggle={() => togglePref('customerAlerts')} />
          <ToggleItem label="System Alerts" sub="Backups, exports, and security audits" active={settings.notificationPreferences.systemAlerts} onToggle={() => togglePref('systemAlerts')} />
          <ToggleItem label="Daily Summary" sub="Receive a daily morning report" active={settings.notificationPreferences.dailySummary} onToggle={() => togglePref('dailySummary')} />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">Delivery Channels</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['In-App', 'Email', 'WhatsApp'].map(ch => (
             <button key={ch} className="flex flex-col items-center gap-4 p-6 bg-slate-50 rounded-3xl border-2 border-transparent hover:border-indigo-100 hover:bg-white transition-all">
                <div className={`p-4 rounded-2xl ${ch === 'In-App' ? 'bg-indigo-100 text-indigo-600' : ch === 'Email' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                  {ch === 'In-App' ? <Bell className="w-6 h-6" /> : ch === 'Email' ? <Mail className="w-6 h-6" /> : <Smartphone className="w-6 h-6" />}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-800">{ch}</span>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-200 animate-pulse" />
                </div>
             </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function IntegrationSettings({ settings }: { settings: AppSettings }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-8">Active Integrations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <IntegrationCard 
             name="WhatsApp API" 
             status={settings.integrations.whatsapp} 
             description="Messaging engine for outreach"
             icon={<MessageSquare className="w-6 h-6 text-emerald-600" />}
          />
          <IntegrationCard 
             name="Stripe" 
             status={settings.integrations.stripe} 
             description="Payment & Invoice processing"
             icon={<CreditCard className="w-6 h-6 text-indigo-600" />}
          />
          <IntegrationCard 
             name="Email SMTP" 
             status={settings.integrations.smtp} 
             description="Transactional email delivery"
             icon={<Mail className="w-6 h-6 text-blue-600" />}
          />
          <IntegrationCard 
             name="PayPal" 
             status={settings.integrations.paypal} 
             description="Secondary payment gateway"
             icon={<Link2 className="w-6 h-6 text-amber-600" />}
          />
        </div>
      </div>
      
      <div className="bg-slate-50 border border-slate-100 border-dashed rounded-3xl p-8 text-center">
         <Link2 className="w-8 h-8 text-slate-300 mx-auto mb-3" />
         <p className="text-sm font-bold text-slate-500">Need more integrations?</p>
         <p className="text-xs text-slate-400 mt-1">Visit our documentation to enable Custom Webhooks.</p>
      </div>
    </div>
  );
}

function IntegrationCard({ name, status, description, icon }: any) {
  return (
    <div className="p-6 bg-slate-50/50 rounded-3xl border border-slate-100 hover:bg-white hover:shadow-md transition-all group">
      <div className="flex items-start justify-between">
        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${status === 'connected' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
          {status}
        </span>
      </div>
      <div className="mt-4">
        <h4 className="font-bold text-slate-800">{name}</h4>
        <p className="text-[10px] text-slate-400 font-medium mt-1 leading-relaxed">{description}</p>
      </div>
      <button className="w-full mt-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-600 hover:text-white transition-all">
        {status === 'connected' ? 'Manage' : 'Connect'}
      </button>
    </div>
  );
}

function DataSettings({ onBackup, onReset, onExport }: { onBackup: () => void, onReset: () => void, onExport: (filter: string) => void }) {
  const allCustomers = storage.getCustomers();
  const leadSources = Array.from(new Set(allCustomers.map(c => c.leadSource).filter(Boolean)));

  const EXPORT_PRESETS = [
    {
      id: 'all',
      label: 'Export All Customers',
      desc: 'All customers with subscription details',
      color: 'indigo'
    },
    {
      id: 'active',
      label: 'Export Active Customers',
      desc: 'Customers with an active subscription',
      color: 'emerald'
    },
    {
      id: 'expiring7',
      label: 'Export Expiring in 7 Days',
      desc: 'Subscriptions renewing within 7 days',
      color: 'amber'
    },
    {
      id: 'expired',
      label: 'Export Expired Customers',
      desc: 'Customers whose subscriptions have expired',
      color: 'rose'
    },
  ];

  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-600 hover:text-white',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-600 hover:text-white',
    amber: 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-600 hover:text-white',
    rose: 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-600 hover:text-white',
  };

  return (
    <div className="space-y-6">
      {/* Export Centre */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-indigo-50 rounded-2xl"><Download className="w-5 h-5 text-indigo-600" /></div>
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Export Centre</h3>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">17-column CSV with full subscription details</p>
          </div>
        </div>

        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Export Presets</div>
        <div className="space-y-2 mb-6">
          {EXPORT_PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => onExport(p.id)}
              className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border text-left transition-all group ${colorMap[p.color]}`}
            >
              <div>
                <p className="text-sm font-bold">{p.label}</p>
                <p className="text-[10px] font-medium opacity-70 mt-0.5">{p.desc}</p>
              </div>
              <Download className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-4" />
            </button>
          ))}
        </div>

        {leadSources.length > 0 && (
          <>
            <div className="h-px bg-slate-100 mb-6" />
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Export by Lead Source</div>
            <div className="flex flex-wrap gap-2">
              {leadSources.map(src => (
                <button
                  key={src}
                  onClick={() => onExport(src)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-indigo-600 hover:text-white hover:border-transparent transition-all"
                >
                  <Download className="w-3 h-3" />
                  {src}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Columns Included</p>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            Customer ID · Full Name · Email · WhatsApp · Lead Source · Status · Customer Created Date · Start Date · Renewal Date · Subscription Type · Subscription Status · Subscription Period · Sold Price · Payment Method · Payment Status · Notes · Last Contacted
          </p>
        </div>
      </div>

      {/* Full Backup */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-blue-50 rounded-2xl"><Database className="w-5 h-5 text-blue-600" /></div>
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Full Backup</h3>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Download complete JSON archive of all CRM data</p>
          </div>
        </div>
        <button onClick={onBackup} className="w-full py-3.5 bg-slate-900 text-white rounded-2xl text-sm font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-100 flex items-center justify-center gap-2">
          <Database className="w-4 h-4" />
          Generate Full Backup
        </button>
      </div>

      {/* Danger Zone */}
      <div className="bg-rose-50 rounded-3xl border border-rose-100/50 p-8">
        <div className="flex items-center gap-3 text-rose-600 mb-4">
           <AlertCircle className="w-5 h-5" />
           <h3 className="text-sm font-black uppercase tracking-widest">Danger Zone</h3>
        </div>
        <p className="text-xs text-rose-500 font-medium mb-6 leading-relaxed">Resetting the system will erase all data permanently. This includes customers, subscriptions, reminder logs, and history. Please ensure you have a backup.</p>
        <button onClick={onReset} className="inline-flex items-center gap-2 px-6 py-3 bg-rose-600 text-white rounded-2xl text-xs font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-100">
           <Trash2 className="w-4 h-4" />
           Reset System
        </button>
      </div>
    </div>
  );
}

function BillingPlaceholder() {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 space-y-8 animate-in zoom-in-95 duration-300">
       <div className="flex items-center justify-between">
          <div><h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Current Plan</h3><p className="text-xs text-slate-400 mt-1">Manage your SaaS billing and usage</p></div>
          <span className="px-4 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">Active</span>
       </div>
       
       <div className="p-8 rounded-[40px] bg-gradient-to-br from-slate-900 to-slate-800 text-white relative overflow-hidden">
          <Zap className="absolute -right-8 -bottom-8 w-48 h-48 opacity-10 rotate-12" />
          <div className="relative z-10">
             <h4 className="text-3xl font-black">Pro Plan</h4>
             <p className="text-slate-400 text-sm mt-2">£49 / month</p>
             <div className="mt-8 pt-8 border-t border-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex gap-4">
                   <div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Billing Cycle</p><p className="text-sm font-bold">Annual</p></div>
                   <div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Next Payment</p><p className="text-sm font-bold">Apr 15, 2026</p></div>
                </div>
                <button className="px-6 py-2.5 bg-white text-slate-900 rounded-2xl text-xs font-black shadow-lg">Upgrade Plan</button>
             </div>
          </div>
       </div>
       
       <div className="space-y-4">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment Method</h4>
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
             <div className="flex items-center gap-4"><div className="w-12 h-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center font-bold text-xs italic">VISA</div><p className="text-sm font-bold text-slate-700">•••• 4242</p></div>
             <button className="text-xs font-bold text-indigo-600 hover:underline">Update</button>
          </div>
       </div>
    </div>
  );
}

function TeamPlaceholder() {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 space-y-8 animate-in zoom-in-95 duration-300">
       <div className="flex items-center justify-between">
          <div><h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Team Members</h3><p className="text-xs text-slate-400 mt-1">Add colleagues to your workspace</p></div>
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-2xl text-xs font-bold shadow-lg shadow-indigo-100">Invite Member</button>
       </div>

       <div className="divide-y divide-slate-50 border border-slate-100 rounded-3xl overflow-hidden">
          <TeamRow name="Admin" email="admin@crmsync.com" role="Super Admin" />
          <TeamRow name="John Smith" email="john@crmsync.com" role="Sales Agent" />
          <TeamRow name="Sarah Lee" email="sarah@crmsync.com" role="Marketing" />
       </div>
    </div>
  );
}

function TeamRow({ name, email, role }: any) {
  return (
    <div className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
       <div className="flex items-center gap-4 text-left">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400 text-xs">{name[0]}</div>
          <div><p className="text-sm font-bold text-slate-900">{name}</p><p className="text-[10px] text-slate-400">{email}</p></div>
       </div>
       <div className="flex items-center gap-6">
          <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-bold uppercase tracking-tight">{role}</span>
          <button className="text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
       </div>
    </div>
  );
}

function ToggleItem({ label, sub, active, onToggle }: any) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-transparent hover:border-indigo-100 transition-all">
       <div className="text-left">
          <h4 className="text-sm font-bold text-slate-800">{label}</h4>
          <p className="text-[10px] text-slate-400 font-medium">{sub}</p>
       </div>
       <button 
         onClick={onToggle}
         className={`w-10 h-5 rounded-full transition-all relative ${active ? 'bg-indigo-600' : 'bg-slate-200'}`}
       >
          <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${active ? 'left-6' : 'left-1'}`} />
       </button>
    </div>
  );
}

