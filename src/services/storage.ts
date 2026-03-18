import type { Customer, Subscription, Reminder, RenewalHistory, ActivityLog, AppSettings } from '../types/index';

// Simple prefix to isolate our app's data in localStorage
const PREFIX = 'subcrm_';

function getItems<T>(key: string): T[] {
  const data = localStorage.getItem(PREFIX + key);
  return data ? JSON.parse(data) : [];
}

function setItems<T>(key: string, items: T[]): void {
  localStorage.setItem(PREFIX + key, JSON.stringify(items));
}

const DEFAULT_SETTINGS: AppSettings = {
  organizationName: 'CRM Sync Ltd',
  organizationEmail: 'admin@company.com',
  currency: 'GBP',
  timezone: 'Europe/London',
  dateFormat: 'DD/MM/YYYY',
  autoSendMode: 'Manual Approval',
  reminderThresholds: [7, 3, 1],
  whatsappTemplate: "Hi {customer_name}, your {plan_name} subscription renews in {days} days on {renewal_date}. Price: £{price}. Pay here: {payment_link}",
  automationChannels: ['WhatsApp'],
  notificationPreferences: {
    customerAlerts: true,
    systemAlerts: true,
    dailySummary: false,
    summaryTime: '09:00',
    channels: ['In-App', 'Email']
  },
  integrations: {
    whatsapp: 'connected',
    stripe: 'disconnected',
    paypal: 'disconnected',
    smtp: 'connected'
  }
};

export const storage = {
  // App Settings
  getSettings: (): AppSettings => {
    const data = localStorage.getItem(PREFIX + 'settings');
    if (!data) return DEFAULT_SETTINGS;
    
    // Merge existing settings with defaults to handle new fields
    const settings = JSON.parse(data);
    return { ...DEFAULT_SETTINGS, ...settings };
  },
  saveSettings: (settings: AppSettings) => {
    localStorage.setItem(PREFIX + 'settings', JSON.stringify(settings));
  },

  // Migration to ensure currency consistency
  migrateData: () => {
    // 0. One-time purge of hardcoded seed/demo data
    // Runs once per browser using a flag key, then never again
    const purgeKey = PREFIX + 'seed_purged_v1';
    if (!localStorage.getItem(purgeKey)) {
      const seedCustomerIds = ['c1', 'c2', 'c3'];
      const seedSubIds = ['s1', 's2', 's3'];
      const seedReminderIds = ['r1', 'r2'];
      const seedHistoryIds = ['h1', 'h2'];

      const customers = storage.getCustomers().filter(c => !seedCustomerIds.includes(c.id));
      const subs = storage.getSubscriptions().filter(s => !seedSubIds.includes(s.id));
      const remindersFiltered = storage.getReminders().filter(r => !seedReminderIds.includes(r.id));
      const historyFiltered = storage.getRenewalHistory().filter(h => !seedHistoryIds.includes(h.id));

      setItems('customers', customers);
      setItems('subscriptions', subs);
      setItems('reminders', remindersFiltered);
      setItems('renewal_history', historyFiltered);
      localStorage.setItem(purgeKey, '1');
    }

    // 1. Sanitize Settings
    const settings = storage.getSettings();
    if (settings.whatsappTemplate.includes('$')) {
      settings.whatsappTemplate = settings.whatsappTemplate.replace(/\$/g, '£');
      storage.saveSettings(settings);
    }

    // 2. Sanitize Reminders
    const reminders = storage.getReminders();
    let remindersChanged = false;
    reminders.forEach(r => {
      if (r.messagePreview?.includes('$')) {
        r.messagePreview = r.messagePreview.replace(/\$/g, '£');
        remindersChanged = true;
      }
    });
    if (remindersChanged) setItems('reminders', reminders);

    // 3. Sanitize Renewal History
    const history = storage.getRenewalHistory();
    let historyChanged = false;
    history.forEach(h => {
      if (h.notes?.includes('$')) {
        h.notes = h.notes.replace(/\$/g, '£');
        historyChanged = true;
      }
    });
    if (historyChanged) setItems('renewal_history', history);
  },


  // Customers
  getCustomers: (): Customer[] => getItems<Customer>('customers'),
  getCustomer: (id: string): Customer | undefined => storage.getCustomers().find(c => c.id === id),
  saveCustomer: (customer: Customer) => {
    const customers = storage.getCustomers();
    const index = customers.findIndex(c => c.id === customer.id);
    if (index >= 0) {
      customers[index] = customer;
    } else {
      customers.push(customer);
    }
    setItems('customers', customers);
  },
  deleteCustomer: (id: string) => {
    setItems('customers', getItems<Customer>('customers').filter(c => c.id !== id));
    setItems('subscriptions', getItems<Subscription>('subscriptions').filter(s => s.customerId !== id));
    setItems('reminders', getItems<Reminder>('reminders').filter(r => r.customerId !== id));
    setItems('renewal_history', getItems<RenewalHistory>('renewal_history').filter(h => h.customerId !== id));
    setItems('activity_logs', getItems<ActivityLog>('activity_logs').filter(a => a.customerId !== id));
  },

  // Subscriptions
  getSubscriptions: (): Subscription[] => getItems<Subscription>('subscriptions'),
  getSubscription: (id: string): Subscription | undefined => storage.getSubscriptions().find(s => s.id === id),
  getCustomerSubscriptions: (customerId: string): Subscription[] => storage.getSubscriptions().filter(s => s.customerId === customerId),
  saveSubscription: (subscription: Subscription) => {
    const subs = storage.getSubscriptions();
    const index = subs.findIndex(s => s.id === subscription.id);
    if (index >= 0) {
      subs[index] = subscription;
    } else {
      subs.push(subscription);
    }
    setItems('subscriptions', subs);
  },

  // Reminders
  getReminders: (): Reminder[] => getItems<Reminder>('reminders'),
  saveReminder: (reminder: Reminder) => {
    const rems = storage.getReminders();
    const index = rems.findIndex(r => r.id === reminder.id);
    if (index >= 0) {
      rems[index] = reminder;
    } else {
      rems.push(reminder);
    }
    setItems('reminders', rems);
  },
  deleteReminder: (id: string) => {
    setItems('reminders', getItems<Reminder>('reminders').filter(r => r.id !== id));
  },

  // Renewal History
  getRenewalHistory: (): RenewalHistory[] => getItems<RenewalHistory>('renewal_history'),
  saveRenewalHistory: (history: RenewalHistory) => {
    const hists = storage.getRenewalHistory();
    hists.push(history);
    setItems('renewal_history', hists);
  },
  logTransaction: (subscription: Subscription) => {
    // Check if a transaction for this subscription already exists for today/near date to avoid duplicates
    const history = storage.getRenewalHistory();
    const subDate = new Date(subscription.startDate).toISOString().split('T')[0];
    const exists = history.some(h => 
      h.subscriptionId === subscription.id && 
      new Date(h.renewedOn).toISOString().split('T')[0] === subDate
    );

    if (!exists) {
      storage.saveRenewalHistory({
        id: `h_${Date.now()}`,
        customerId: subscription.customerId,
        subscriptionId: subscription.id,
        oldPlan: subscription.planDuration, // For new subs, old and new are the same
        newPlan: subscription.planDuration,
        amount: subscription.price,
        renewedOn: subscription.startDate,
        paymentMethod: 'Other',
        notes: `Initial subscription: ${subscription.subscriptionType}`,
        createdAt: new Date().toISOString()
      });
    }
  },

  // Activity Log
  getActivityLogs: (): ActivityLog[] => getItems<ActivityLog>('activity_logs'),
  logActivity: (log: ActivityLog) => {
    const logs = storage.getActivityLogs();
    logs.push(log);
    setItems('activity_logs', logs);
  },

  // Analytics Helpers
  getCustomerValue: (customerId: string): number => {
    return storage.getRenewalHistory()
      .filter(h => h.customerId === customerId)
      .reduce((sum, h) => sum + h.amount, 0);
  },

  // Reset Data
  clearAll: () => {
    localStorage.removeItem(PREFIX + 'customers');
    localStorage.removeItem(PREFIX + 'subscriptions');
    localStorage.removeItem(PREFIX + 'reminders');
    localStorage.removeItem(PREFIX + 'renewal_history');
    localStorage.removeItem(PREFIX + 'activity_logs');
    localStorage.removeItem(PREFIX + 'settings');
  }
};
