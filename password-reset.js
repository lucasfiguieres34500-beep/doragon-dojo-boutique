'use strict';
const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);
const TTL = 30 * 60 * 1000;

function sign(payload, user) {
  return crypto
    .createHmac('sha256', Buffer.from(user.hash, 'hex'))
    .update('doragon-reset-v1:' + payload)
    .digest();
}

function makeToken(user, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({
      id: user.id,
      exp: now + TTL,
      nonce: crypto.randomBytes(24).toString('hex'),
    }),
  ).toString('base64url');
  return payload + '.' + sign(payload, user).toString('base64url');
}

function parseToken(token, now) {
  if (typeof token !== 'string' || token.length > 2048 || !/^[\w-]+\.[\w-]+$/.test(token))
    throw new Error('Lien invalide ou expiré. Demandez un nouveau lien.');
  const [payload, signature] = token.split('.');
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString());
  } catch {
    throw new Error('Lien invalide ou expiré. Demandez un nouveau lien.');
  }
  if (
    !data ||
    typeof data.id !== 'string' ||
    !Number.isFinite(data.exp) ||
    data.exp <= now ||
    data.exp > now + TTL ||
    typeof data.nonce !== 'string'
  )
    throw new Error('Lien invalide ou expiré. Demandez un nouveau lien.');
  return { data, payload, signature };
}

function createPasswordReset({ db, mailer, siteUrl, invalidateSessions, now = Date.now }) {
  let queue = Promise.resolve();
  async function request(email) {
    const user = await db.findUserByEmail(email);
    if (!user?.hash) return;
    const link = new URL(siteUrl);
    link.hash = 'reset-password=' + makeToken(user, now());
    const result = await mailer.sendPasswordResetEmail(user, link.href);
    if (!result.sent) throw new Error('Email de récupération non envoyé.');
  }
  async function reset(token, password) {
    const work = async () => {
      if (
        typeof password !== 'string' ||
        password.length < 8 ||
        password.length > 128 ||
        password.trim() !== password
      )
        throw new Error(
          'Choisissez un mot de passe de 8 à 128 caractères, sans espace au début ni à la fin.',
        );
      const { data, payload, signature } = parseToken(token, now());
      const user = await db.findUserById(data.id);
      const supplied = Buffer.from(signature, 'base64url');
      const expected = user?.hash ? sign(payload, user) : Buffer.alloc(32);
      if (
        !user?.hash ||
        supplied.length !== expected.length ||
        !crypto.timingSafeEqual(supplied, expected)
      )
        throw new Error('Lien invalide ou déjà utilisé. Demandez un nouveau lien.');
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = (await scrypt(password, salt, 64)).toString('hex');
      if (!(await db.replacePassword(user.id, user.hash, { salt, hash })))
        throw new Error('Lien déjà utilisé. Demandez un nouveau lien.');
      invalidateSessions(user.id);
      mailer.sendPasswordChangedEmail(user).catch(() => {});
      return true;
    };
    const result = queue.then(work, work);
    queue = result.catch(() => {});
    return result;
  }
  return { request, reset };
}

function createRateLimiter(now = Date.now) {
  const counters = new Map();
  return (key, limit, duration) => {
    const time = now();
    for (const [id, entry] of counters) if (entry.until <= time) counters.delete(id);
    const entry = counters.get(key) || { count: 0, until: time + duration };
    if (entry.count >= limit || (!counters.has(key) && counters.size >= 10000)) return false;
    entry.count++;
    counters.set(key, entry);
    return true;
  };
}

module.exports = { createPasswordReset, createRateLimiter, makeToken, TTL };
