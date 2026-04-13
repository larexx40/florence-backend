import { OrderStatus, PaymentStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';

// ── Types ──────────────────────────────────────────────────────────────────────

export type ReceiptOrder = Prisma.OrderGetPayload<{
  include: {
    items: true;
    shippingAddress: true;
    logistics: { select: { id: true; name: true; phone: true } };
    user: { select: { id: true; email: true; firstName: true; lastName: true; phone: true } };
  };
}>;

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number | string | { toString(): string }): string {
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING: '#f59e0b',
  CONFIRMED: '#3b82f6',
  PROCESSING: '#8b5cf6',
  SHIPPED: '#06b6d4',
  DELIVERED: '#22c55e',
  CANCELLED: '#ef4444',
  PARTIALLY_FULFILLED: '#f97316',
  REFUNDED: '#64748b',
};

const PAY_STATUS_COLORS: Record<PaymentStatus, string> = {
  UNPAID: '#ef4444',
  PAID: '#22c55e',
  PARTIAL: '#f59e0b',
  REFUNDED: '#64748b',
  CREDITED: '#3b82f6',
};

const PAYMENT_LABEL: Record<string, string> = {
  PAYSTACK: 'Paystack (Online)',
  BANK_TRANSFER: 'Bank Transfer',
  CASH_ON_DELIVERY: 'Cash on Delivery',
};

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Builds a fully self-contained HTML page sized for an 80mm thermal printer.
 * The logo is passed as a base64 data URI so the page works offline and prints
 * correctly without any external HTTP requests.
 */
export function buildReceiptHtml(order: ReceiptOrder, logoDataUri: string): string {
  const placedAt = new Date(order.placedAt).toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const customer =
    [order.user.firstName, order.user.lastName].filter(Boolean).join(' ') || order.user.email;

  const addr = order.shippingAddress;
  const addressLine = [addr.addressLine1, addr.addressLine2, addr.city, addr.state]
    .filter(Boolean)
    .join(', ');

  const itemRows = order.items
    .map(
      (item) => `
      <tr>
        <td class="item-name">${item.productName}<br><small>${item.variantName} — ${item.sku}</small></td>
        <td class="qty">${item.quantity}</td>
        <td class="price">₦${fmt(item.unitPrice)}</td>
        <td class="price">₦${fmt(item.lineTotal)}</td>
      </tr>`,
    )
    .join('');

  const discountRow =
    Number(order.discountAmount) > 0
      ? `<div class="totals-row"><span>Discount</span><span>-₦${fmt(order.discountAmount)}</span></div>`
      : '';

  const shippingRow =
    Number(order.shippingFee) > 0
      ? `<div class="totals-row"><span>Shipping (${order.logistics?.name ?? ''})</span><span>₦${fmt(order.shippingFee)}</span></div>`
      : '';

  const storeCreditRow =
    Number(order.storeCreditApplied) > 0
      ? `<div class="totals-row"><span>Store Credit</span><span>-₦${fmt(order.storeCreditApplied)}</span></div>`
      : '';

  const notesSection = order.notes
    ? `<div class="divider"></div>
       <div class="section-title">Notes</div>
       <div style="font-size:9px">${order.notes}</div>`
    : '';

  const logisticsLine = order.logistics
    ? `<div style="font-size:9px">Via: ${order.logistics.name}</div>`
    : '';

  const phoneLineUser = order.user.phone
    ? `<div style="font-size:9px">${order.user.phone}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Receipt — ${order.orderNumber}</title>
  <style>
    /* 80mm roll: ~72mm usable at 4mm side margins */
    @page {
      size: 80mm auto;
      margin: 4mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      color: #000;
      width: 72mm;
    }
    .center { text-align: center; }
    .bold   { font-weight: bold; }

    img.logo {
      display: block;
      margin: 0 auto 4px;
      /* scale to fit 80mm roll; thermal printers render at ~203dpi */
      width: 48mm;
      height: auto;
    }

    .shop-name { font-size: 13px; font-weight: bold; letter-spacing: 1px; }
    .divider { border-top: 1px dashed #000; margin: 5px 0; }
    .section-title {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin: 4px 0 2px;
    }

    table { width: 100%; border-collapse: collapse; }
    th { font-size: 9px; text-align: left; border-bottom: 1px solid #000; padding-bottom: 2px; }
    th.price, td.price { text-align: right; }
    th.qty,   td.qty   { text-align: center; width: 24px; }
    td { padding: 2px 0; vertical-align: top; }
    td.item-name small { font-size: 9px; color: #444; }

    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 1px 0;
    }
    .totals-row.grand {
      font-size: 13px;
      font-weight: bold;
      border-top: 1px solid #000;
      padding-top: 3px;
      margin-top: 2px;
    }

    .footer { font-size: 10px; margin-top: 6px; }
    .barcode { font-size: 9px; letter-spacing: 2px; margin-top: 4px; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>

  <!-- Print button — hidden when actually printing -->
  <div class="no-print" style="margin-bottom:10px">
    <button onclick="window.print()" style="padding:6px 16px;cursor:pointer;font-size:13px">
      🖨️ Print Receipt
    </button>
  </div>

  <!-- Logo -->
  <img class="logo" src="${logoDataUri}" alt="Everything Florence">

  <!-- Shop name -->
  <div class="center">
    <div class="shop-name">Everything Florence</div>
    <div style="font-size:9px;margin-top:1px">Your Style, Delivered.</div>
  </div>

  <div class="divider"></div>

  <!-- Order meta -->
  <div class="section-title">Order</div>
  <div class="totals-row"><span class="bold">${order.orderNumber}</span><span>${placedAt}</span></div>
  <div class="totals-row">
    <span>Status:</span>
    <span style="color:${STATUS_COLORS[order.status]};font-weight:bold">${order.status.replace(/_/g, ' ')}</span>
  </div>
  <div class="totals-row">
    <span>Payment:</span>
    <span style="color:${PAY_STATUS_COLORS[order.paymentStatus]};font-weight:bold">${order.paymentStatus}</span>
  </div>
  <div class="totals-row">
    <span>Method:</span>
    <span>${PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}</span>
  </div>

  <div class="divider"></div>

  <!-- Customer -->
  <div class="section-title">Customer</div>
  <div class="bold">${customer}</div>
  <div style="font-size:9px">${order.user.email}</div>
  ${phoneLineUser}

  <div class="divider"></div>

  <!-- Delivery -->
  <div class="section-title">Delivery Address</div>
  <div class="bold">${addr.fullName}</div>
  <div style="font-size:9px">${addr.phone}</div>
  <div style="font-size:9px">${addressLine}</div>
  ${logisticsLine}

  <div class="divider"></div>

  <!-- Items -->
  <div class="section-title">Items</div>
  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th class="qty">Qty</th>
        <th class="price">Price</th>
        <th class="price">Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="divider"></div>

  <!-- Totals -->
  <div class="totals-row"><span>Subtotal</span><span>₦${fmt(order.subtotal)}</span></div>
  ${discountRow}
  ${shippingRow}
  ${storeCreditRow}
  <div class="totals-row grand"><span>TOTAL</span><span>₦${fmt(order.total)}</span></div>

  ${notesSection}

  <div class="divider"></div>

  <!-- Footer -->
  <div class="footer center">
    <div>Thank you for shopping with us!</div>
    <div class="barcode">${order.orderNumber}</div>
    <div style="font-size:9px;margin-top:4px">Printed ${new Date().toLocaleString('en-NG')}</div>
  </div>

</body>
</html>`;
}
