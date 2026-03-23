import type { Customer, Subscription } from "../types";

export function getFulfilmentWhatsAppText(customer: Customer, subscription: Subscription, codeOrLink: string) {
  const { fullName } = customer;
  const product = subscription.subscriptionType || "Subscription";
  const duration = subscription.planDuration || "";
  
  return `Hi ${fullName.split(' ')[0]}, here is your ${product} ${duration} activation link/code:

${codeOrLink}

Please confirm once activated. Thank you!`;
}
