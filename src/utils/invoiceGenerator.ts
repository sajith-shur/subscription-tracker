import { jsPDF } from "jspdf";
import type { Subscription, Customer } from "../types";

export const generateInvoicePDF = (
  customer: Customer, 
  subscription: Subscription,
  formatCurrency: (amount: number) => string,
  formatDate: (date: string | number | Date) => string
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  
  // Helper for right-aligned text
  const rightText = (text: string, y: number) => {
    const textWidth = doc.getTextWidth(text);
    doc.text(text, pageWidth - margin - textWidth, y);
  };

  // 1. Header & Logo
  doc.setFillColor(79, 70, 229); // Indigo 600
  doc.rect(margin, 20, 10, 10, 'F'); // Simple logo square
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59); // Slate 800
  doc.text("UnlockPremium", margin + 14, 27.5);
  
  doc.setFontSize(22);
  rightText("INVOICE", 28);
  
  // 2. Invoice Meta Info
  const invoiceDate = formatDate(new Date());
  const invoiceNum = `#INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // Slate 500
  rightText(invoiceNum, 35);
  rightText(`Date: ${invoiceDate}`, 40);

  // Divider
  doc.setDrawColor(241, 245, 249); // Slate 100
  doc.line(margin, 50, pageWidth - margin, 50);

  // 3. Bill To
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text("BILL TO", margin, 65);
  
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59); // Slate 800
  doc.text(customer.fullName, margin, 72);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(customer.email || "", margin, 77);
  doc.text(customer.whatsappNumber || "", margin, 82);

  // 4. Subscription Details Section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text("SUBSCRIPTION DETAILS", margin, 100);
  
  doc.setDrawColor(241, 245, 249);
  doc.line(margin, 105, pageWidth - margin, 105);
  
  const detailsY = 115;
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(subscription.subscriptionType || "LinkedIn Subscription", margin, detailsY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`${subscription.planDuration} Plan Subscription`, margin, detailsY + 6);
  
  doc.text(`Start Date: ${formatDate(subscription.startDate)}`, margin, detailsY + 16);
  doc.text(`Renewal Date: ${formatDate(subscription.renewalDate)}`, margin, detailsY + 22);

  // 5. Amount Table
  doc.setFont("helvetica", "bold");
  doc.text("AMOUNT", margin, 155);
  
  doc.setDrawColor(241, 245, 249);
  doc.line(margin, 160, pageWidth - margin, 160);
  
  // Table Header
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text("DESCRIPTION", margin, 170);
  rightText("AMOUNT", 170);
  
  // Table Body
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(`${subscription.subscriptionType} (${subscription.planDuration})`, margin, 180);
  rightText(formatCurrency(subscription.price), 180);
  
  doc.line(margin, 185, pageWidth - margin, 185);
  
  // Total
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total", margin, 195);
  rightText(formatCurrency(subscription.price), 195);

  // 6. Status Badge
  const status = subscription.paymentStatus || "Paid";
  let statusColor = [16, 185, 129]; // Emerald 500
  let statusText = "Paid";
  
  if (status === 'Pending') {
    statusColor = [245, 158, 11]; // Amber 500
    statusText = "Pending";
  } else if (status === 'Partial') {
    statusColor = [245, 158, 11]; // Amber 500
    statusText = "Partially Paid";
  }
  
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.roundedRect(margin, 210, pageWidth - (margin * 2), 15, 2, 2, 'F');
  
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Status: `, margin + 5, 219.5);
  
  doc.setFont("helvetica", "bold");
  doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.text(statusText, margin + 20, 219.5);

  // 7. Payment Instructions
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "bold");
  doc.text("PAYMENT INSTRUCTIONS", margin, 245);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Please complete your billing via WhatsApp by contacting our support team.", margin, 252);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("+44 XXXXXXXX", margin, 258);

  // 8. Footer
  doc.setDrawColor(241, 245, 249);
  doc.line(margin, 275, pageWidth - margin, 275);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  const footerText = "Thank you for your business!";
  doc.text(footerText, (pageWidth - doc.getTextWidth(footerText)) / 2, 283);
  
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  const poweredBy = "Powered by CRMSync";
  doc.text(poweredBy, (pageWidth - doc.getTextWidth(poweredBy)) / 2, 288);

  doc.save(`Invoice_${customer.fullName.replace(/\s+/g, "_")}.pdf`);
  return true;
};

export const getInvoiceWhatsAppText = (
  customer: Customer, 
  subscription: Subscription, 
  formatCurrency: (amount: number) => string,
  formatDate: (date: string | number | Date) => string,
  codeOrLink?: string
) => {
  let text = `*INVOICE*
-----------------------------
*Customer:* ${customer.fullName}
*Subscription:* ${subscription.subscriptionType} (${subscription.planDuration} plan)
*Activation Date:* ${formatDate(subscription.startDate)}
*Renewal Date:* ${formatDate(subscription.renewalDate)}
*Total Amount:* ${formatCurrency(subscription.price)}
*Status:* ${subscription.paymentStatus || 'Paid'}`;

  if (codeOrLink) {
    text += `\n\n*Activation Code/Link:*\n${codeOrLink}`;
  }

  text += `\n\nThank you for your business!`;
  return text;
};
