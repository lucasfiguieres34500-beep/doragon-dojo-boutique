'use strict';
const { OrderError } = require('./orders.js');
const {
  DAY,
  statusOf,
  isPaid,
  reservationExpiry,
  lowStockItems,
} = require('./order-workflow.js');

function createShopOperations({ db, mailer, orderService, now = Date.now, threshold = 2 }) {
  let running = null,
    nextRun = 0;

  // Reprise avant toute nouvelle modification de stock, après panne ou redémarrage.
  async function recoverStock() {
    const state = await db.getOperationsState();
    if (!state.stockRecovery) return;
    await db.saveStock(state.stockRecovery.stock, { strict: true });
    await db.updateOrder(state.stockRecovery.order);
    delete state.stockRecovery;
    await db.saveOperationsState(state);
  }
  orderService.setBeforeStockWork(recoverStock);

  async function expireReservations() {
    return orderService.withStockLock(async () => {
      const orders = await db.getAllOrders();
      for (const order of orders) {
        const deadline = reservationExpiry(order);
        if (deadline === null || deadline > now()) continue;
        const stock = await db.getStock();
        for (const item of order.items || []) {
          if (
            Number.isSafeInteger(item.qty) &&
            item.qty > 0 &&
            Number.isFinite(stock[item.id]?.[item.size])
          )
            stock[item.id][item.size] += item.qty;
        }
        const updated = {
          ...order,
          paymentStatus: 'Réservation expirée — non réglée',
          workflow: {
            ...order.workflow,
            status: 'expired',
            updatedAt: new Date(now()).toISOString(),
            stockReleasedAt: new Date(now()).toISOString(),
          },
        };
        const state = await db.getOperationsState();
        state.stockRecovery = { stock, order: updated };
        await db.saveOperationsState(state);
        await recoverStock();
      }
    });
  }

  async function setStatus(ref, status) {
    return orderService.withStockLock(async () => {
      const order = (await db.getAllOrders()).find((order) => order.ref === ref);
      if (!order) throw new OrderError('Commande introuvable.', 404);
      const current = statusOf(order);
      if (!['ready', 'collected'].includes(status)) throw new OrderError('Statut invalide.');
      if (current === status) return order;
      if (['collected', 'expired'].includes(current))
        throw new OrderError('Cette commande est déjà clôturée.', 409);
      const deadline = reservationExpiry(order);
      if (deadline !== null && deadline <= now())
        throw new OrderError('Cette réservation a expiré. Actualisez les commandes.', 409);
      return db.updateOrder({
        ...order,
        paymentStatus:
          status === 'collected' && !isPaid(order) ? 'Réglé au dojo' : order.paymentStatus,
        workflow: { ...order.workflow, status, updatedAt: new Date(now()).toISOString() },
      });
    });
  }

  async function archiveCompleted() {
    return orderService.withStockLock(async () => {
      const orders = await db.getAllOrders();
      for (const order of orders)
        if (['collected', 'expired'].includes(statusOf(order)) && !order.workflow?.archivedAt)
          await db.updateOrder({
            ...order,
            workflow: { ...order.workflow, archivedAt: new Date(now()).toISOString() },
          });
      return (await db.getAllOrders()).filter((order) => !order.workflow?.archivedAt);
    });
  }

  async function sendOrderNotifications() {
    if (!mailer.isSmtpConfigured()) return;
    const orders = await db.getAllOrders();
    for (const order of orders) {
      let kind, marker;
      const status = statusOf(order),
        deadline = reservationExpiry(order);
      if (status === 'ready' && !order.workflow?.readyEmailSentAt) {
        kind = 'ready';
        marker = 'readyEmailSentAt';
      } else if (
        deadline !== null &&
        deadline > now() &&
        deadline - now() <= DAY &&
        !order.workflow?.reminderSentAt
      ) {
        kind = 'reminder';
        marker = 'reminderSentAt';
      } else if (status === 'expired' && !order.workflow?.expiredEmailSentAt) {
        kind = 'expired';
        marker = 'expiredEmailSentAt';
      }
      if (!kind) continue;
      const result = await mailer.sendOrderEventEmail(order, kind);
      if (result.sent)
        await orderService.withStockLock(async () => {
          const current = (await db.getAllOrders()).find((entry) => entry.ref === order.ref);
          if (current)
            await db.updateOrder({
              ...current,
              workflow: { ...current.workflow, [marker]: new Date(now()).toISOString() },
            });
        });
    }
  }

  async function checkLowStock() {
    const items = lowStockItems(await db.getProducts(), await db.getStock(), threshold);
    const state = await db.getOperationsState();
    const sent = state.lowStockSent || {};
    const current = new Map(
      items.map((item) => [
        JSON.stringify([item.id, item.size]),
        item.qty === 0 ? 'out' : 'low',
      ]),
    );
    const retained = Object.fromEntries(
      Object.entries(sent).filter(([key, level]) => current.get(key) === level),
    );
    const due = items.filter((item) => !retained[JSON.stringify([item.id, item.size])]);
    if (due.length && mailer.isSmtpConfigured()) {
      const result = await mailer.sendLowStockEmail(due, threshold);
      if (result.sent)
        for (const item of due) {
          const key = JSON.stringify([item.id, item.size]);
          retained[key] = current.get(key);
        }
    }
    await db.saveOperationsState({
      ...(await db.getOperationsState()),
      lowStockSent: retained,
    });
    return items;
  }

  async function tick({ force = false } = {}) {
    if (running) return running;
    if (!force && now() < nextRun) return;
    running = (async () => {
      await expireReservations();
      await sendOrderNotifications();
      await checkLowStock();
      nextRun = now() + 60000;
    })();
    try {
      return await running;
    } finally {
      running = null;
    }
  }
  return { tick, setStatus, archiveCompleted, expireReservations, recoverStock, threshold };
}
module.exports = { createShopOperations };
