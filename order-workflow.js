'use strict';

const PREFIX = '@doragon-workflow-v1:';
const DAY = 86400000;
const LABELS = {
  preparing: 'À préparer',
  ready: 'Prête au dojo',
  collected: 'Récupérée',
  expired: 'Réservation expirée',
};

function unpackNote(value) {
  if (typeof value === 'string' && value.startsWith(PREFIX)) {
    try {
      const parsed = JSON.parse(value.slice(PREFIX.length));
      if (parsed && typeof parsed.workflow === 'object' && !Array.isArray(parsed.workflow))
        return { memberNote: String(parsed.note || ''), workflow: parsed.workflow };
    } catch {
      /* Les anciennes notes restent lisibles. */
    }
  }
  return { memberNote: String(value || ''), workflow: {} };
}

function packNote(order) {
  return (
    PREFIX + JSON.stringify({ note: order.memberNote || '', workflow: order.workflow || {} })
  );
}

function statusOf(order) {
  return LABELS[order.workflow?.status] ? order.workflow.status : 'preparing';
}

function isPaid(order) {
  return Boolean(
    order.stripePaymentIntent ||
    /en ligne|stripe/i.test(order.paymentMethod || '') ||
    /payé|réglé/i.test(order.paymentStatus || ''),
  );
}

function reservationExpiry(order, now = Date.now()) {
  const value = Date.parse(order.workflow?.expiresAt);
  return !isPaid(order) &&
    ['preparing', 'ready'].includes(statusOf(order)) &&
    Number.isFinite(value)
    ? value
    : null;
}

function lowStockItems(products, stock, threshold = 2) {
  return products.flatMap((product) =>
    (product.sizes || []).flatMap((size) => {
      const qty = Number(stock[product.id]?.[size]);
      return Number.isFinite(qty) && qty <= threshold
        ? [{ id: product.id, name: product.name, size, qty }]
        : [];
    }),
  );
}

module.exports = {
  DAY,
  LABELS,
  packNote,
  unpackNote,
  statusOf,
  isPaid,
  reservationExpiry,
  lowStockItems,
};
