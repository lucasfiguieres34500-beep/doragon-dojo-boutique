'use strict';
const crypto = require('crypto');

class OrderError extends Error {
  constructor(message, status = 400, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

function buildItems(requested, products, stock) {
  if (!Array.isArray(requested) || !requested.length || requested.length > 50) {
    throw new OrderError('Le panier doit contenir entre 1 et 50 lignes.');
  }
  const grouped = new Map();
  for (const line of requested) {
    const product = products.find((p) => p.id === line?.id);
    if (!product || !product.sizes.includes(line.size))
      throw new OrderError('Produit ou taille invalide.');
    if (!Number.isSafeInteger(line.qty) || line.qty < 1 || line.qty > 999)
      throw new OrderError('Quantité invalide.');
    const cents = Math.round(Number(product.price) * 100);
    if (!Number.isSafeInteger(cents) || cents <= 0)
      throw new OrderError('Prix du produit invalide.');
    const key = JSON.stringify([product.id, line.size]);
    const item = grouped.get(key) || {
      id: product.id,
      name: product.name,
      size: line.size,
      qty: 0,
      price: cents / 100,
      image: product.image,
    };
    item.qty += line.qty;
    item.lineTotal = (cents * item.qty) / 100;
    const available = stock[product.id]?.[line.size];
    if (!Number.isFinite(available) || available < item.qty) {
      throw new OrderError(`Stock insuffisant pour ${product.name} (${line.size}).`, 409, {
        stock,
      });
    }
    grouped.set(key, item);
  }
  return [...grouped.values()];
}

function totalCents(items) {
  return items.reduce((sum, item) => sum + Math.round(item.lineTotal * 100), 0);
}

function paymentMetadata(items, member) {
  const metadata = {
    ref: 'CLUB-' + crypto.randomBytes(8).toString('hex').toUpperCase(),
    memberId: String(member.id),
    memberName: member.name,
    memberEmail: member.email,
    memberPhone: member.phone || '',
    orderVersion: '2',
  };
  const chunks = Array.from(JSON.stringify(items)).reduce((parts, char) => {
    if (!parts.length || parts[parts.length - 1].length + char.length > 450) parts.push('');
    parts[parts.length - 1] += char;
    return parts;
  }, []);
  if (chunks.length > 40)
    throw new OrderError('Panier trop volumineux. Réduisez le nombre d’articles.');
  chunks.forEach((chunk, index) => {
    metadata['order_items_' + index] = chunk;
  });
  return metadata;
}

function readPaymentItems(metadata) {
  let text = '';
  for (let index = 0; metadata['order_items_' + index] !== undefined; index++)
    text += metadata['order_items_' + index];
  let items;
  try {
    items = JSON.parse(text || metadata.itemsJson || 'null');
  } catch {
    throw new OrderError('Détail du paiement incomplet. Contactez le club.', 409);
  }
  if (
    !Array.isArray(items) ||
    !items.length ||
    items.some(
      (i) =>
        !i ||
        typeof i.id !== 'string' ||
        typeof i.size !== 'string' ||
        !Number.isSafeInteger(i.qty) ||
        i.qty < 1 ||
        !Number.isFinite(i.lineTotal) ||
        i.lineTotal <= 0,
    )
  ) {
    throw new OrderError('Détail du paiement invalide.', 409);
  }
  return items;
}

function createOrderService({ db, mailer }) {
  let queue = Promise.resolve();
  function withStockLock(work) {
    const result = queue.then(work, work);
    queue = result.catch(() => {});
    return result;
  }

  async function commit(order) {
    const result = await withStockLock(async () => {
      const orders = await db.getAllOrders();
      const existing = orders.find(
        (o) =>
          o.ref === order.ref ||
          (order.stripePaymentIntent && o.stripePaymentIntent === order.stripePaymentIntent),
      );
      if (existing) return { ok: true, order: existing, alreadyProcessed: true };
      const stock = await db.getStock();
      const original = JSON.parse(JSON.stringify(stock));
      for (const item of order.items) {
        if (
          !order.stripePaymentIntent &&
          (!Number.isFinite(stock[item.id]?.[item.size]) ||
            stock[item.id][item.size] < item.qty)
        )
          throw new OrderError('Stock insuffisant.', 409, { stock });
        if (stock[item.id] && Number.isFinite(stock[item.id][item.size]))
          stock[item.id][item.size] = Math.max(0, stock[item.id][item.size] - item.qty);
      }
      const updated = await db.saveStock(stock);
      try {
        await db.saveOrder(order);
      } catch (error) {
        await db.saveStock(original);
        throw error;
      }
      return { ok: true, order, stock: updated };
    });
    if (!result.alreadyProcessed) {
      try {
        const mail = await mailer.sendOrderConfirmationEmail(
          order,
          process.env.CLUB_NAME || 'DORAGON DOJO CLUB',
        );
        result.emailSent = Boolean(mail?.sent);
      } catch {
        result.emailSent = false;
      }
    }
    return result;
  }

  async function confirmPayment(intent, member) {
    if (intent.status !== 'succeeded')
      throw new OrderError(
        intent.status === 'processing'
          ? 'Paiement en cours de traitement par la banque.'
          : 'Paiement non confirmé.',
        409,
        { paymentStatus: intent.status },
      );
    if (member && intent.metadata?.memberId !== String(member.id))
      throw new OrderError('Ce paiement ne correspond pas à votre compte.', 403);
    const metadata = intent.metadata || {};
    if (!metadata.memberId || !metadata.ref)
      throw new OrderError('Paiement sans commande associée.', 409);
    const items = readPaymentItems(metadata);
    if (intent.currency !== 'eur' || totalCents(items) !== intent.amount_received)
      throw new OrderError('Le montant reçu ne correspond pas à la commande.', 409);
    return commit({
      ref: metadata.ref,
      memberId: metadata.memberId,
      memberName: metadata.memberName,
      memberEmail: metadata.memberEmail,
      memberPhone: metadata.memberPhone || '',
      memberNote: metadata.memberNote || '',
      createdAt: new Date().toISOString(),
      dateLabel: new Date().toLocaleString('fr-FR'),
      paymentMethod: 'Paiement en ligne (Stripe)',
      paymentStatus: 'Payé en ligne (Stripe)',
      stripePaymentIntent: intent.id,
      total: intent.amount_received / 100,
      items,
    });
  }

  async function reserve(body, member) {
    if (!/^[\w-]{16,80}$/.test(body.requestId || ''))
      throw new OrderError('Identifiant de réservation invalide.');
    const ref =
      'CLUB-' +
      crypto
        .createHash('sha256')
        .update(String(member.id) + ':' + body.requestId)
        .digest('hex')
        .slice(0, 16)
        .toUpperCase();
    const existing = (await db.getAllOrders()).find((order) => order.ref === ref);
    if (existing) return { ok: true, order: existing, alreadyProcessed: true };
    const items = buildItems(body.items, await db.getProducts(), await db.getStock());
    return commit({
      ref,
      memberId: member.id,
      memberName: member.name,
      memberEmail: member.email,
      memberPhone: member.phone || '',
      createdAt: new Date().toISOString(),
      dateLabel: new Date().toLocaleString('fr-FR'),
      paymentMethod: 'Retrait au dojo (Réservation - Paiement sur place)',
      paymentStatus: 'À régler au dojo',
      memberNote: '',
      total: totalCents(items) / 100,
      items,
    });
  }

  return { withStockLock, confirmPayment, reserve };
}

module.exports = {
  OrderError,
  buildItems,
  totalCents,
  paymentMetadata,
  readPaymentItems,
  createOrderService,
};
