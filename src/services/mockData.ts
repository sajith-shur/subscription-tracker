import type { Customer, Subscription, Reminder, RenewalHistory } from '../types/index';
import { storage } from './storage';
import { addDays, subDays } from 'date-fns';

export const seedMockData = () => {
  const today = new Date();

  const customers: Customer[] = [
    {
      id: 'c1',
      fullName: 'John Smith',
      whatsappNumber: '+44 7700 900000',
      email: 'john@example.com',
      linkedinUrl: 'https://linkedin.com/in/john',
      country: 'UK',
      leadSource: 'Reddit',
      notes: 'Interested in annual plan later.',
      status: 'Active',
      createdAt: subDays(today, 30).toISOString(),
      updatedAt: subDays(today, 30).toISOString(),
    },
    {
      id: 'c2',
      fullName: 'Maya Ali',
      whatsappNumber: '+971 50 123 4567',
      email: 'maya@example.com',
      linkedinUrl: '',
      country: 'UAE',
      leadSource: 'WhatsApp',
      notes: '',
      status: 'Active',
      createdAt: subDays(today, 10).toISOString(),
      updatedAt: subDays(today, 10).toISOString(),
    },
    {
      id: 'c3',
      fullName: 'Alex Jones',
      whatsappNumber: '+1 555 019 923',
      email: 'alex@example.com',
      linkedinUrl: '',
      country: 'USA',
      leadSource: 'Referral',
      notes: '',
      status: 'Active',
      createdAt: subDays(today, 90).toISOString(),
      updatedAt: subDays(today, 90).toISOString(),
    }
  ];

  const subscriptions: Subscription[] = [
    {
      id: 's1',
      customerId: 'c1',
      planDuration: '1M',
      price: 25,
      startDate: subDays(today, 28).toISOString(),
      renewalDate: addDays(today, 2).toISOString(), // Due in 2 days
      paymentStatus: 'Paid',
      status: 'Active',
      autoRenew: false,
      createdAt: subDays(today, 28).toISOString(),
      updatedAt: subDays(today, 28).toISOString(),
    },
    {
      id: 's2',
      customerId: 'c2',
      planDuration: '3M',
      price: 60,
      startDate: subDays(today, 5).toISOString(),
      renewalDate: addDays(today, 85).toISOString(), // Due way later
      paymentStatus: 'Paid',
      status: 'Active',
      autoRenew: false,
      createdAt: subDays(today, 5).toISOString(),
      updatedAt: subDays(today, 5).toISOString(),
    },
    {
      id: 's3',
      customerId: 'c3',
      planDuration: '3M',
      price: 55,
      startDate: subDays(today, 95).toISOString(),
      renewalDate: subDays(today, 5).toISOString(), // Expired 5 days ago
      paymentStatus: 'Paid',
      status: 'Expired',
      autoRenew: false,
      createdAt: subDays(today, 95).toISOString(),
      updatedAt: subDays(today, 95).toISOString(),
    }
  ];

  const reminders: Reminder[] = [
    {
      id: 'r1',
      customerId: 'c1',
      subscriptionId: 's1',
      reminderType: '3-day',
      channel: 'WhatsApp',
      scheduledFor: addDays(today, 2).toISOString(),
      status: 'Pending',
      messagePreview: "Hi John, your standard Monthly plan is renewing in 2 days. Reply with YES to keep it active.",
      createdAt: subDays(today, 1).toISOString(),
    },
    {
      id: 'r2',
      customerId: 'c3',
      subscriptionId: 's3',
      reminderType: 'expired-follow-up',
      channel: 'WhatsApp',
      scheduledFor: today.toISOString(),
      status: 'Pending',
      messagePreview: "Hi Alex, we noticed your Premium Quarterly plan expired 5 days ago. We've paused your service but you can reconnect anytime.",
      createdAt: today.toISOString(),
    }
  ];

  const history: RenewalHistory[] = [
    {
      id: 'h1',
      customerId: 'c1',
      subscriptionId: 's1',
      oldPlan: '1M',
      newPlan: '1M',
      amount: 49,
      renewedOn: subDays(today, 30).toISOString(),
      paymentMethod: 'Stripe',
      notes: 'Monthly renewal',
      createdAt: subDays(today, 30).toISOString(),
    },
    {
      id: 'h2',
      customerId: 'c2',
      subscriptionId: 's2',
      oldPlan: '3M',
      newPlan: '3M',
      amount: 129,
      renewedOn: subDays(today, 60).toISOString(),
      paymentMethod: 'PayPal',
      notes: 'Quarterly renewal',
      createdAt: subDays(today, 60).toISOString(),
    }
  ];

  // Seed storage
  if (storage.getCustomers().length === 0) {
    customers.forEach(storage.saveCustomer);
  }
  if (storage.getSubscriptions().length === 0) {
    subscriptions.forEach(storage.saveSubscription);
  }
  if (storage.getReminders().length === 0) {
    reminders.forEach(storage.saveReminder);
  }
  if (storage.getRenewalHistory().length === 0) {
    history.forEach(storage.saveRenewalHistory);
  }
};
