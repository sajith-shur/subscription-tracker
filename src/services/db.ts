/**
 * db.ts — Async Firestore service
 * Replaces the synchronous localStorage storage.ts for all data collections.
 * All methods return Promises and operate on Firestore documents.
 */
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  Customer,
  Subscription,
  Reminder,
  RenewalHistory,
  ActivityLog,
  IntakeRequest,
  ManagedSubscriptionType,
  USDTPurchase,
  InventoryItem,
} from "../types/index";

// ─── Customers ───────────────────────────────────────────────────────────────

export const getCustomers = async (): Promise<Customer[]> => {
  const snap = await getDocs(query(collection(db, "customers"), orderBy("createdAt", "desc")));
  return snap.docs.map(d => d.data() as Customer);
};

export const getCustomer = async (id: string): Promise<Customer | undefined> => {
  const snap = await getDoc(doc(db, "customers", id));
  return snap.exists() ? (snap.data() as Customer) : undefined;
};

export const saveCustomer = async (customer: Customer): Promise<void> => {
  await setDoc(doc(db, "customers", customer.id), customer);
};

export const deleteCustomer = async (id: string): Promise<void> => {
  const batch = writeBatch(db);

  // Delete customer document
  batch.delete(doc(db, "customers", id));

  // Delete related subscriptions
  const subsSnap = await getDocs(query(collection(db, "subscriptions"), where("customerId", "==", id)));
  subsSnap.docs.forEach(d => batch.delete(d.ref));

  // Delete related reminders
  const remSnap = await getDocs(query(collection(db, "reminders"), where("customerId", "==", id)));
  remSnap.docs.forEach(d => batch.delete(d.ref));

  // Delete related renewal history
  const histSnap = await getDocs(query(collection(db, "renewal_history"), where("customerId", "==", id)));
  histSnap.docs.forEach(d => batch.delete(d.ref));

  // Delete related activity logs
  const logSnap = await getDocs(query(collection(db, "activity_logs"), where("customerId", "==", id)));
  logSnap.docs.forEach(d => batch.delete(d.ref));

  await batch.commit();
};

// ─── Subscriptions ────────────────────────────────────────────────────────────

export const getSubscriptions = async (): Promise<Subscription[]> => {
  const snap = await getDocs(collection(db, "subscriptions"));
  return snap.docs.map(d => d.data() as Subscription);
};

export const getSubscription = async (id: string): Promise<Subscription | undefined> => {
  const snap = await getDoc(doc(db, "subscriptions", id));
  return snap.exists() ? (snap.data() as Subscription) : undefined;
};

export const getCustomerSubscriptions = async (customerId: string): Promise<Subscription[]> => {
  const snap = await getDocs(query(collection(db, "subscriptions"), where("customerId", "==", customerId)));
  return snap.docs.map(d => d.data() as Subscription);
};

export const saveSubscription = async (subscription: Subscription): Promise<void> => {
  await setDoc(doc(db, "subscriptions", subscription.id), subscription);
};

// ─── Reminders ────────────────────────────────────────────────────────────────

export const getReminders = async (): Promise<Reminder[]> => {
  const snap = await getDocs(collection(db, "reminders"));
  return snap.docs.map(d => d.data() as Reminder);
};

export const saveReminder = async (reminder: Reminder): Promise<void> => {
  await setDoc(doc(db, "reminders", reminder.id), reminder);
};

export const deleteReminder = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, "reminders", id));
};

// ─── Renewal History ──────────────────────────────────────────────────────────

export const getRenewalHistory = async (): Promise<RenewalHistory[]> => {
  const snap = await getDocs(query(collection(db, "renewal_history"), orderBy("renewedOn", "desc")));
  return snap.docs.map(d => d.data() as RenewalHistory);
};

export const saveRenewalHistory = async (history: RenewalHistory): Promise<void> => {
  await setDoc(doc(db, "renewal_history", history.id), history);
};

export const logTransaction = async (subscription: Subscription): Promise<void> => {
  // Check if a transaction for this subscription already exists on the same start date
  const snap = await getDocs(
    query(collection(db, "renewal_history"), where("subscriptionId", "==", subscription.id))
  );
  const subDate = new Date(subscription.startDate).toISOString().split("T")[0];
  const exists = snap.docs.some(
    d => new Date((d.data() as RenewalHistory).renewedOn).toISOString().split("T")[0] === subDate
  );

  if (!exists) {
    const history: RenewalHistory = {
      id: `h_${Date.now()}`,
      customerId: subscription.customerId,
      subscriptionId: subscription.id,
      oldPlan: subscription.planDuration,
      newPlan: subscription.planDuration,
      amount: subscription.price,
      renewedOn: subscription.startDate,
      paymentMethod: "Other",
      notes: `Initial subscription: ${subscription.subscriptionType ?? ""}`,
      createdAt: new Date().toISOString(),
    };
    await saveRenewalHistory(history);
  }
};

// ─── Activity Logs ────────────────────────────────────────────────────────────

export const getActivityLogs = async (): Promise<ActivityLog[]> => {
  const snap = await getDocs(collection(db, "activity_logs"));
  return snap.docs.map(d => d.data() as ActivityLog);
};

export const logActivity = async (log: ActivityLog): Promise<void> => {
  await setDoc(doc(db, "activity_logs", log.id), log);
};

// ─── Analytics Helpers ────────────────────────────────────────────────────────

export const getCustomerValue = async (customerId: string): Promise<number> => {
  const snap = await getDocs(
    query(collection(db, "renewal_history"), where("customerId", "==", customerId))
  );
  return snap.docs.reduce((sum, d) => sum + (d.data() as RenewalHistory).amount, 0);
};

// ─── Requests (Intake) ────────────────────────────────────────────────────────

export const getRequests = async (): Promise<IntakeRequest[]> => {
  const snap = await getDocs(query(collection(db, "requests"), orderBy("createdAt", "desc")));
  return snap.docs.map(d => d.data() as IntakeRequest);
};

export const getRequest = async (id: string): Promise<IntakeRequest | undefined> => {
  const snap = await getDoc(doc(db, "requests", id));
  return snap.exists() ? (snap.data() as IntakeRequest) : undefined;
};

export const saveRequest = async (request: IntakeRequest): Promise<void> => {
  await setDoc(doc(db, "requests", request.id), request);
};

export const deleteRequest = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, "requests", id));
};

// ─── Managed Subscription Types ───────────────────────────────────────────────

export const getSubscriptionTypes = async (): Promise<ManagedSubscriptionType[]> => {
  const snap = await getDocs(query(collection(db, "subscription_types"), orderBy("name", "asc")));
  return snap.docs.map(d => d.data() as ManagedSubscriptionType);
};

export const getActiveSubscriptionTypes = async (): Promise<ManagedSubscriptionType[]> => {
  // We fetch all and filter/sort client-side to avoid requiring a composite index in Firestore
  const snap = await getDocs(collection(db, "subscription_types"));
  const allTypes = snap.docs.map(d => d.data() as ManagedSubscriptionType);
  return allTypes
    .filter(type => type.active)
    .sort((a, b) => a.name.localeCompare(b.name));
};

export const saveSubscriptionType = async (type: ManagedSubscriptionType): Promise<void> => {
  await setDoc(doc(db, "subscription_types", type.id), type);
};

export const deleteSubscriptionType = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, "subscription_types", id));
};

// ─── USDT Purchases ──────────────────────────────────────────────────────────

export const getUSDTPurchases = async (): Promise<USDTPurchase[]> => {
  const snap = await getDocs(query(collection(db, "usdt_purchases"), orderBy("date", "desc")));
  return snap.docs.map(d => d.data() as USDTPurchase);
};

export const saveUSDTPurchase = async (purchase: USDTPurchase): Promise<void> => {
  await setDoc(doc(db, "usdt_purchases", purchase.id), purchase);
};

export const deleteUSDTPurchase = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, "usdt_purchases", id));
};

// ─── Inventory Items ─────────────────────────────────────────────────────────

export const getInventoryItems = async (): Promise<InventoryItem[]> => {
  const snap = await getDocs(query(collection(db, "inventory_items"), orderBy("createdAt", "desc")));
  return snap.docs.map(d => d.data() as InventoryItem);
};

export const getInventoryItem = async (id: string): Promise<InventoryItem | undefined> => {
  const snap = await getDoc(doc(db, "inventory_items", id));
  return snap.exists() ? (snap.data() as InventoryItem) : undefined;
};

export const saveInventoryItem = async (item: InventoryItem): Promise<void> => {
  await setDoc(doc(db, "inventory_items", item.id), item);
};

export const deleteInventoryItem = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, "inventory_items", id));
};

// ─── System Reset ────────────────────────────────────────────────────────────
export const resetSystem = async (): Promise<void> => {
  const collections = [
    "customers",
    "subscriptions",
    "reminders",
    "renewal_history",
    "activity_logs",
    "requests",
    "inventory_items",
    "usdt_purchases",
  ];

  for (const collName of collections) {
    const snap = await getDocs(collection(db, collName));
    if (snap.empty) continue;

    const chunks = [];
    for (let i = 0; i < snap.docs.length; i += 500) {
      chunks.push(snap.docs.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  }
};

