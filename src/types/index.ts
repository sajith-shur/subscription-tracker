export type CustomerStatus = 'New' | 'Active' | 'In Follow-up' | 'Inactive';
export type SubscriptionStatus = 'Active' | 'Due Soon' | 'Due Today' | 'Expired' | 'Renewed' | 'Cancelled';
export type ReminderStatus = 'Pending' | 'Scheduled' | 'Sent' | 'Failed' | 'Skipped' | 'Manual Approval';
export type RequestStatus = 'Pending' | 'Approved' | 'Rejected';
export type PlanDuration = '1M' | '2M' | '3M' | '4M' | '6M' | '9M' | '12M';
export type AutoSendMode = 'ON' | 'OFF' | 'Manual Approval';

// ─── Managed Subscription Products ────────────────────────────────────────────

export interface USDTPurchase {
  id: string;
  date: string;
  gbpSpent: number;
  usdtReceived: number;
  exchangeRate: number; // GBP / USDT
  notes: string;
}

export interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  durationMonths: number;
  durationLabel: string;
  codeOrLink: string;
  vendorCostUsdt: number;
  gbpCost: number;
  batchId?: string; // Reference to USDTPurchase id
  status: 'Available' | 'Assigned' | 'Used';
  assignedCustomerId?: string;
  assignedSubscriptionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionDuration {
  id: string;
  label: string;       // e.g. "1 Month", "6 Months"
  months: number;      // numeric value
  active: boolean;
  isDefault: boolean;
  isMostPopular: boolean;
  badgeText: string;   // e.g. "Best Value", "Most Popular"
  defaultPrice: number;
  vendorCostUsdt?: number; // Added for profit calculation
  sortOrder: number;
}

export interface ManagedSubscriptionType {
  id: string;
  name: string;
  category: string;
  active: boolean;
  notes: string;
  durations: SubscriptionDuration[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomerNote {
  id: string;
  date: string;
  text: string;
}

export interface Customer {
  id: string;
  fullName: string;
  whatsappNumber: string;
  email: string;
  linkedinUrl: string;
  country: string;
  leadSource: string;
  notes: string | CustomerNote[]; // Supporting both temporarily for migration
  reminderPreferences?: {
    days: number[];
    channel: 'WhatsApp' | 'Email' | 'SMS';
  };
  status: CustomerStatus;
  createdAt: string;
  updatedAt: string;
}

export type SubscriptionType = 
  | 'Premium Career' 
  | 'Premium Business' 
  | 'Premium Company Page' 
  | 'Recruiter Lite' 
  | 'Sales Navigator Core' 
  | 'Sales Navigator Advanced' 
  | 'Sales Navigator Advanced Plus';

export interface Subscription {
  id: string;
  customerId: string;
  subscriptionType?: SubscriptionType;
  subscriptionTypeId?: string; // Reference to ManagedSubscriptionType
  durationMonths?: number;
  planDuration: PlanDuration;
  price: number;
  startDate: string; // ISO format
  renewalDate: string; // ISO format
  paymentStatus: 'Paid' | 'Pending' | 'Partial';
  status: SubscriptionStatus;
  autoRenew: boolean;
  paymentLink?: string;
  lastContactedAt?: string;
  lastRenewed?: string;
  
  // Inventory and Profit Fields
  inventoryItemId?: string;
  costUsdt?: number;
  costGbp?: number;
  salePriceGbp?: number;
  profitGbp?: number;
  vendorBatchId?: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface Reminder {
  id: string;
  customerId: string;
  subscriptionId: string;
  reminderType: '7-day' | '3-day' | '1-day' | 'due-today' | 'expired-follow-up' | 'manual';
  channel: 'WhatsApp' | 'Email' | 'SMS';
  scheduledFor: string;
  sentAt?: string;
  status: ReminderStatus;
  messagePreview: string;
  createdAt: string;
}

export interface RenewalHistory {
  id: string;
  customerId: string;
  subscriptionId: string;
  oldPlan: PlanDuration | '';
  newPlan: PlanDuration | '';
  amount: number;
  renewedOn: string;
  paymentMethod: string;
  notes: string;
  createdAt: string;
}

export interface IntakeRequest {
  id: string;
  fullName: string;
  preferredContact: 'WhatsApp' | 'Email' | 'Reddit';
  whatsappNumber: string;
  email: string;
  redditUsername?: string;
  subscriptionType: SubscriptionType | string | '';
  subscriptionPeriod: PlanDuration | string | '';
  subscriptionTypeId?: string;
  subscriptionTypeName?: string;
  durationMonths?: number;
  durationLabel?: string;
  notes: string;
  
  // Admin-added fields during processing
  soldPrice?: number;
  internalNotes?: string;
  startDate?: string;
  renewalDate?: string;
  paymentStatus?: 'Paid' | 'Pending' | 'Partial';
  
  status: RequestStatus;
  archived?: boolean;
  deletedAt?: string;
  customerId?: string;      // Linked customer after approval
  subscriptionId?: string;  // Linked subscription after approval
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  customerId: string;
  activityType: string;
  description: string;
  createdAt: string;
}

export interface AppSettings {
  // General
  organizationName: string;
  organizationEmail: string;
  currency: string;
  timezone: string;
  dateFormat: string;
  
  // Automation
  autoSendMode: AutoSendMode;
  reminderThresholds: number[];
  whatsappTemplate: string;
  automationChannels: ('WhatsApp' | 'Email' | 'SMS')[];
  
  // Notifications
  notificationPreferences: {
    customerAlerts: boolean;
    systemAlerts: boolean;
    dailySummary: boolean;
    summaryTime: string;
    channels: ('In-App' | 'Email' | 'WhatsApp')[];
  };
  
  // Integrations
  integrations: {
    whatsapp: 'connected' | 'disconnected';
    stripe: 'connected' | 'disconnected';
    paypal: 'connected' | 'disconnected';
    smtp: 'connected' | 'disconnected';
  };
}

