import { startOfDay, parseISO, differenceInDays } from 'date-fns';
import * as db from './db';
import type { Subscription, Reminder, Customer, SubscriptionStatus } from '../types/index';

export const automation = {
  /**
   * Scans all active subscriptions and generates reminders 
   * based on configured thresholds (e.g., 7, 3, 1 days before).
   */
  checkAndGenerateReminders: async () => {
    const subscriptions = await db.getSubscriptions();
    const customers = await db.getCustomers();
    const existingReminders = await db.getReminders();
    const today = startOfDay(new Date());

    // Default thresholds
    const thresholds = [7, 3, 1, 0]; 
    const generatedCount = { new: 0, skipped: 0 };

    subscriptions.forEach((sub: Subscription) => {
      // Create a stable reference to sub.status to avoid lint issues if necessary
      const status: SubscriptionStatus = sub.status;
      if (status !== 'Active' && status !== 'Due Soon') return;

      const customer = customers.find((c: Customer) => c.id === sub.customerId);
      if (!customer) return;

      const renewalDate = startOfDay(parseISO(sub.renewalDate));
      const daysUntilRenewal = differenceInDays(renewalDate, today);

      if (daysUntilRenewal < 0) {
        // Handle expired case if needed in future
        return;
      }

      thresholds.forEach(threshold => {
        // If we are at exactly 'threshold' days before renewal
        if (daysUntilRenewal === threshold) {
          const reminderType = threshold === 0 ? 'due-today' : `${threshold}-day`;
          
          // Check if this specific reminder already exists for this sub
          const alreadyExists = existingReminders.find((r: Reminder) => 
            r.subscriptionId === sub.id && 
            r.reminderType === reminderType
          );

          if (!alreadyExists) {
            const newReminder: Reminder = {
              id: `rem_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              customerId: sub.customerId,
              subscriptionId: sub.id,
              reminderType: reminderType as any,
              channel: 'WhatsApp',
              scheduledFor: today.toISOString(),
              status: 'Pending',
              messagePreview: automation.generateMessage(customer, sub, threshold),
              createdAt: new Date().toISOString()
            };

            db.saveReminder(newReminder); // fire and forget inside the loop is okay for now, or we can await inside a for-of. Let's just do fire-and-forget for speed here, or actually do await later if needed. Wait, fire and forget is fine.

            generatedCount.new++;
          } else {
            generatedCount.skipped++;
          }
        }
      });
    });

    return generatedCount;
  },

  generateMessage: (customer: Customer, sub: Subscription, days: number) => {
    const name = customer.fullName;
    const plan = sub.planDuration === '1M' ? 'Monthly' : 
                 sub.planDuration === '3M' ? 'Quarterly' : 'Annual';
    
    if (days === 0) {
      return `Hi ${name}, your ${plan} plan is due for renewal TODAY! Please reply with YES to renew.`;
    }
    return `Hi ${name}, your ${plan} plan is renewing in ${days} days. Please let us know if you'd like to continue!`;
  }
};
