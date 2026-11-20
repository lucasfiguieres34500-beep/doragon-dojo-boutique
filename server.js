const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Stripe = require('stripe');
let sharp = null;
try {
  sharp = require('sharp');
} catch (_) {
  sharp = null;
}

loadEnv(path.join(__dirname, '.env'));

const STRIPE_SECRET_KEY = (process.env.STRIPE_SECRET_KEY || '').trim();
const STRIPE_PUBLISHABLE_KEY = (process.env.STRIPE_PUBLISHABLE_KEY || '').trim();
let stripe = null;
try {
  if (STRIPE_SECRET_KEY) {
    stripe = new Stripe(STRIPE_SECRET_KEY);
    console.log('[Stripe] Passerelle initialisée avec succès');
  } else {
    console.log('[Stripe] En attente de configuration de STRIPE_SECRET_KEY');
  }
} catch (err) {
  console.error('[Stripe] Erreur initialisation :', err.message);
}

const db = require('./db.js');
const mailer = require('./mailer.js');
const {
  OrderError,
  buildItems,
  totalCents,
  paymentMetadata,
  createOrderService,
} = require('./orders.js');
const orderService = createOrderService({ db, mailer });
const { createShopOperations } = require('./shop-operations.js');
const { createPasswordReset, createRateLimiter } = require('./password-reset.js');
const { lowStockItems } = require('./order-workflow.js');
const configuredThreshold = Number.parseInt(process.env.LOW_STOCK_THRESHOLD ?? '2', 10);
const operations = createShopOperations({
  db,
  mailer,
  orderService,
  threshold: Number.isFinite(configuredThreshold) ? Math.max(0, Math.min(100, configuredThreshold)) : 2,
});
const resetService = createPasswordReset({
  db,
  mailer,
  siteUrl: mailer.getSiteUrl(),
  invalidateSessions(userId) {
    for (const [token, session] of activeMemberSessions)
      if (session.userId === userId) activeMemberSessions.delete(token);
  },
});
const rateAllowed = createRateLimiter();
function runMaintenance() {
  const now = Date.now();
  for (const [token, expiresAt] of activeSessions) {
    if (now > expiresAt) activeSessions.delete(token);
  }
  for (const [token, session] of activeMemberSessions) {
    if (now > session.expiresAt) activeMemberSessions.delete(token);
  }
  operations
    .tick()
    .catch(() => console.error('[Boutique] Traitement automatique à réessayer.'));
}

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const AUTH_FILE = path.join(DATA_DIR, 'admin-auth.json');
const UPLOADS_DIR = path.join(ROOT_DIR, 'assets', 'uploads');
const SESSION_COOKIE = 'club_admin_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const activeSessions = new Map();
const MEMBER_SESSION_COOKIE = 'doragon_member_token';
const MEMBER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const activeMemberSessions = new Map();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    const value = line
      .slice(eqIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function isSmtpConfigured() {
  return mailer.isSmtpConfigured();
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

async function saveUploadedImage(dataUrl, slug) {
  const match = String(dataUrl || '').match(
    /^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/,
  );
  if (!match) return null;
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 5 * 1024 * 1024) {
    throw new OrderError('Image trop volumineuse (maximum 5 Mo).', 400);
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, '').slice(0, 32) || 'article';

  if (sharp) {
    const filename = `${safeSlug}-${Date.now()}.webp`;
    await sharp(buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(path.join(UPLOADS_DIR, filename));
    return `assets/uploads/${filename}`;
  }

  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const filename = `${safeSlug}-${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
  return `assets/uploads/${filename}`;
}

async function readJsonBody(req) {
  const raw = await readBody(req);
  try {
    return JSON.parse(raw.toString('utf8') || '{}');
  } catch {
    throw new OrderError('JSON invalide.');
  }
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8 * 1024 * 1024) throw new OrderError('Requête trop volumineuse.', 413);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function isSecureConnection(req) {
  return Boolean(
    req?.socket?.encrypted ||
      req?.headers?.['x-forwarded-proto'] === 'https' ||
      process.env.NODE_ENV === 'production' ||
      process.env.RENDER,
  );
}

function getSecurityHeaders(req) {
  const headers = {
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
  if (isSecureConnection(req)) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  }
  return headers;
}

function sendJson(res, statusCode, data, extraHeaders = {}) {
  const sec = getSecurityHeaders(res.req);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...sec,
    ...extraHeaders,
  });
  res.end(JSON.stringify(data));
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const result = {};
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx <= 0) return;
    const key = part.slice(0, idx).trim();
    try {
      result[key] = decodeURIComponent(part.slice(idx + 1).trim());
    } catch {
      /* Cookie malformé ignoré. */
    }
  });
  return result;
}

function isAuthenticated(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return false;
  const expiresAt = activeSessions.get(token);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    activeSessions.delete(token);
    return false;
  }
  return true;
}

function createSessionCookie(res, req) {
  const token = crypto.randomBytes(24).toString('hex');
  activeSessions.set(token, Date.now() + SESSION_TTL_MS);
  const secure = isSecureConnection(req || res?.req) ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${secure}`;
}

function clearSession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) activeSessions.delete(token);
  const secure = isSecureConnection(req) ? '; Secure' : '';
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

function verifyPassword(candidate) {
  const input = String(candidate || '');
  if (!input) return false;

  if (fs.existsSync(AUTH_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
      if (saved && saved.salt && saved.hash) {
        const expected = Buffer.from(saved.hash, 'hex');
        const derived = crypto.scryptSync(input, saved.salt, expected.length);
        return (
          expected.length === derived.length && crypto.timingSafeEqual(expected, derived)
        );
      }
    } catch {
      return false;
    }
  }

  const configured = String(process.env.ADMIN_PASSWORD || 'doragon2026');
  const a = Buffer.from(input, 'utf8');
  const b = Buffer.from(configured, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function saveAdminPassword(newPassword) {
  ensureDataDir();
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(newPassword, salt, 64).toString('hex');
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ salt, hash }, null, 2), 'utf8');
}

function sanitizeUser(user) {
  if (!user) return null;
  const { salt, hash, ...safe } = user;
  return safe;
}

function hashMemberPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyMemberPassword(password, salt, hash) {
  try {
    const expected = Buffer.from(hash, 'hex');
    const derived = crypto.scryptSync(password, salt, expected.length);
    return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}

async function getAuthenticatedMember(req) {
  const cookies = parseCookies(req);
  const token = cookies[MEMBER_SESSION_COOKIE];
  if (!token) return null;
  const session = activeMemberSessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    activeMemberSessions.delete(token);
    return null;
  }
  const user = await db.findUserById(session.userId);
  if (!user || user.hash !== session.passwordHash) {
    activeMemberSessions.delete(token);
    return null;
  }
  return user;
}

function createMemberSession(userId, passwordHash, req) {
  const token = crypto.randomBytes(32).toString('hex');
  activeMemberSessions.set(token, {
    userId,
    passwordHash,
    expiresAt: Date.now() + MEMBER_SESSION_TTL_MS,
  });
  const secure = isSecureConnection(req) ? '; Secure' : '';
  return `${MEMBER_SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${MEMBER_SESSION_TTL_MS / 1000}${secure}`;
}

function clearMemberSession(req) {
  const token = parseCookies(req)[MEMBER_SESSION_COOKIE];
  if (token) activeMemberSessions.delete(token);
  const secure = isSecureConnection(req) ? '; Secure' : '';
  return `${MEMBER_SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

function serveStatic(reqPath, res) {
  let decoded;
  try {
    decoded = decodeURIComponent(reqPath);
  } catch {
    res.writeHead(400);
    return res.end('Bad request');
  }
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const publicFiles = new Set([
    'index.html',
    'gestion.html',
    'styles.css',
    'mobile.css',
    'app.js',
    'gestion.js',
    'catalog.js',
    'dragon_follow_feu.gif',
  ]);
  const isAsset = /^assets\/[\w./-]+\.(?:png|jpe?g|webp|gif|svg)$/i.test(relative);
  const fullPath = path.resolve(ROOT_DIR, relative);
  if (
    (!publicFiles.has(relative) && !isAsset) ||
    relative.split(/[\\/]/).includes('..') ||
    !fullPath.startsWith(ROOT_DIR + path.sep)
  ) {
    res.writeHead(404);
    return res.end('Not found');
  }
  fs.stat(fullPath, (error, stat) => {
    if (error || !stat.isFile()) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const etag =
      '"' + stat.size.toString(16) + '-' + Math.trunc(stat.mtimeMs).toString(16) + '"';
    if (res.req?.headers['if-none-match'] === etag) {
      res.writeHead(304);
      return res.end();
    }
    const sec = getSecurityHeaders(res.req);
    res.writeHead(200, {
      'Content-Type':
        MIME_TYPES[path.extname(fullPath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': isAsset ? 'public, max-age=3600' : 'no-cache',
      ETag: etag,
      ...sec,
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob:; frame-src 'self' https://js.stripe.com https://hooks.stripe.com; connect-src 'self' https://api.stripe.com https://*.supabase.co wss://*.supabase.co;",
    });
    const stream = fs.createReadStream(fullPath);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  });
}

async function handleRequest(req, res) {
  const urlPath = (req.url || '/').split('?')[0];
  if (
    [
      '/api/products',
      '/api/stock',
      '/api/orders',
      '/api/member/me',
      '/api/create-payment-intent',
      '/api/admin/orders/status',
    ].includes(urlPath)
  )
    await operations.expireReservations();
  if (urlPath.startsWith('/api/')) runMaintenance();

  if (req.method === 'POST' && urlPath === '/api/member/forgot-password') {
    const client = req.socket?.remoteAddress || 'unknown';
    if (!rateAllowed('forgot-ip:' + client, 100, 15 * 60000))
      return sendJson(res, 429, {
        ok: false,
        error: 'Trop de demandes. Réessayez plus tard.',
      });
    if (!mailer.isSmtpConfigured())
      return sendJson(res, 503, {
        ok: false,
        error:
          'La récupération par email est temporairement indisponible. Contactez le club.',
      });
    const body = await readJsonBody(req);
    const email = String(body.email || '')
      .trim()
      .toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return sendJson(res, 400, { ok: false, error: 'Saisissez une adresse email valide.' });
    const emailKey = crypto.createHash('sha256').update(email).digest('hex');
    const allowed = rateAllowed('forgot-email:' + emailKey, 3, 60 * 60000);
    sendJson(res, 200, {
      ok: true,
      message:
        'Si un compte correspond à cette adresse, vous recevrez un lien valable 30 minutes. Pensez à vérifier vos courriers indésirables.',
    });
    if (allowed)
      resetService
        .request(email)
        .catch(() => console.error('[Compte] Envoi du lien de récupération indisponible.'));
    return;
  }

  if (req.method === 'POST' && urlPath === '/api/member/reset-password') {
    if (!rateAllowed('reset:' + (req.socket?.remoteAddress || 'unknown'), 20, 15 * 60000))
      return sendJson(res, 429, {
        ok: false,
        error: 'Trop de tentatives. Réessayez plus tard.',
      });
    try {
      const body = await readJsonBody(req);
      await resetService.reset(body.token, body.password);
      return sendJson(res, 200, { ok: true }, { 'Set-Cookie': clearMemberSession(req) });
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: error.message });
    }
  }

  if (req.method === 'GET' && urlPath === '/api/admin/alerts') {
    if (!isAuthenticated(req))
      return sendJson(res, 401, { ok: false, error: 'Authentification requise.' });
    return sendJson(res, 200, {
      ok: true,
      threshold: operations.threshold,
      reservationDays: 7,
      emailConfigured: mailer.isSmtpConfigured(),
      webhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
      items: lowStockItems(await db.getProducts(), await db.getStock(), operations.threshold),
    });
  }

  if (req.method === 'POST' && urlPath === '/api/admin/orders/status') {
    if (!isAuthenticated(req))
      return sendJson(res, 401, { ok: false, error: 'Authentification requise.' });
    try {
      const body = await readJsonBody(req);
      const order = await operations.setStatus(String(body.ref || ''), body.status);
      operations
        .tick({ force: true })
        .catch(() => console.error('[Boutique] Notification en attente.'));
      return sendJson(res, 200, {
        ok: true,
        order,
        emailConfigured: mailer.isSmtpConfigured(),
      });
    } catch (error) {
      return sendJson(res, error.status || 500, { ok: false, error: error.message });
    }
  }

  if (req.method === 'POST' && urlPath === '/api/jobs') {
    const expected = process.env.JOBS_SECRET || '';
    const actual = String(req.headers.authorization || '').replace(/^Bearer /, '');
    if (
      !expected ||
      Buffer.byteLength(actual) !== Buffer.byteLength(expected) ||
      !crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
    )
      return sendJson(res, 401, { ok: false });
    await operations.tick({ force: true });
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET' && urlPath === '/api/health') {
    const admin = isAuthenticated(req);
    const base = { ok: true, status: 'healthy' };
    if (!admin) return sendJson(res, 200, base);
    return sendJson(res, 200, {
      ...base,
      emailConfigured: isSmtpConfigured(),
      stripeConfigured: Boolean(stripe),
      database: db.isSupabaseConfigured() ? 'supabase' : 'local-json',
    });
  }

  // Fichier officiel de vérification de domaine Apple Pay (requis par Apple pour activer Apple Pay)
  if (
    req.method === 'GET' &&
    urlPath === '/.well-known/apple-developer-merchantid-domain-association'
  ) {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    const file = path.join(
      ROOT_DIR,
      '.well-known',
      'apple-developer-merchantid-domain-association',
    );
    if (fs.existsSync(file)) {
      return fs.createReadStream(file).pipe(res);
    }
    try {
      return res.end(require('./apple-pay-token.js'));
    } catch (_) {
      return res.destroy();
    }
  }

  // --- Endpoints Stripe (Paiements sécurisés en ligne) ---
  if (req.method === 'GET' && urlPath === '/api/stripe-config') {
    return sendJson(res, 200, {
      ok: true,
      enabled: Boolean(stripe),
      publishableKey: STRIPE_PUBLISHABLE_KEY,
    });
  }

  if (req.method === 'POST' && urlPath === '/api/create-payment-intent') {
    const member = await getAuthenticatedMember(req);
    if (!member)
      return sendJson(res, 401, { ok: false, error: 'Connectez-vous avant de commander.' });
    if (!stripe)
      return sendJson(res, 503, {
        ok: false,
        error: 'Paiement en ligne indisponible. Choisissez le paiement au club.',
      });
    try {
      const body = await readJsonBody(req);
      const items = buildItems(body.items, await db.getProducts(), await db.getStock());
      const metadata = paymentMetadata(items, member);
      const intent = await stripe.paymentIntents.create({
        amount: totalCents(items),
        currency: 'eur',
        automatic_payment_methods: { enabled: true },
        receipt_email: member.email,
        metadata,
      });
      return sendJson(res, 200, {
        ok: true,
        clientSecret: intent.client_secret,
        paymentIntentId: intent.id,
        ref: metadata.ref,
      });
    } catch (error) {
      return sendJson(res, error.status || 500, {
        ok: false,
        error: error.status ? error.message : 'Impossible de préparer le paiement.',
        ...error.extra,
      });
    }
  }

  if (req.method === 'POST' && urlPath === '/api/confirm-order') {
    const member = await getAuthenticatedMember(req);
    if (!member)
      return sendJson(res, 401, {
        ok: false,
        error: 'Connectez-vous pour retrouver votre commande.',
      });
    if (!stripe)
      return sendJson(res, 503, { ok: false, error: 'Paiement en ligne indisponible.' });
    try {
      const body = await readJsonBody(req);
      if (!/^pi_[a-zA-Z0-9]+$/.test(body.paymentIntentId || ''))
        throw new OrderError('Identifiant de paiement invalide.');
      const intent = await stripe.paymentIntents.retrieve(body.paymentIntentId);
      return sendJson(res, 200, await orderService.confirmPayment(intent, member));
    } catch (error) {
      return sendJson(res, error.status || 500, {
        ok: false,
        error: error.status
          ? error.message
          : 'Impossible de confirmer la commande. Votre paiement sera revérifié.',
        ...error.extra,
      });
    }
  }

  // Compatibilité avec les sessions créées avant cette mise à jour.
  if (req.method === 'GET' && urlPath === '/api/verify-checkout-session') {
    const member = await getAuthenticatedMember(req);
    if (!member)
      return sendJson(res, 401, {
        ok: false,
        error: 'Connectez-vous pour retrouver votre commande.',
      });
    if (!stripe)
      return sendJson(res, 503, { ok: false, error: 'Paiement en ligne indisponible.' });
    try {
      const id = new URL(req.url, 'http://localhost').searchParams.get('session_id');
      if (!/^cs_[a-zA-Z0-9_]+$/.test(id || '')) throw new OrderError('Session invalide.');
      const session = await stripe.checkout.sessions.retrieve(id);
      if (session.metadata?.memberId !== String(member.id))
        throw new OrderError('Cette commande ne correspond pas à votre compte.', 403);
      if (session.payment_status !== 'paid')
        throw new OrderError('Paiement en attente de confirmation.', 409);
      const intent = await stripe.paymentIntents.retrieve(session.payment_intent);
      intent.metadata = { ...session.metadata, ...intent.metadata };
      return sendJson(res, 200, await orderService.confirmPayment(intent, member));
    } catch (error) {
      return sendJson(res, error.status || 500, {
        ok: false,
        error: error.status ? error.message : 'Impossible de vérifier ce paiement.',
      });
    }
  }

  if (req.method === 'POST' && urlPath === '/api/stripe/webhook') {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripe || !secret)
      return sendJson(res, 503, { ok: false, error: 'Webhook non configuré.' });
    let event;
    try {
      const raw = await readBody(req);
      event = stripe.webhooks.constructEvent(raw, req.headers['stripe-signature'], secret);
    } catch {
      return sendJson(res, 400, { ok: false, error: 'Signature Stripe invalide.' });
    }
    try {
      if (event.type === 'payment_intent.succeeded')
        await orderService.confirmPayment(event.data.object);
      return sendJson(res, 200, { received: true });
    } catch (error) {
      console.error('[Stripe] Commande à retraiter :', error.message);
      return sendJson(res, 500, { ok: false, error: 'La commande sera retraitée.' });
    }
  }

  if (req.method === 'GET' && urlPath === '/api/admin/session') {
    return sendJson(res, 200, { ok: true, authenticated: isAuthenticated(req) });
  }

  if (req.method === 'POST' && urlPath === '/api/admin/login') {
    const client = req.socket?.remoteAddress || 'unknown';
    if (!rateAllowed('admin-login-ip:' + client, 10, 15 * 60000)) {
      return sendJson(res, 429, {
        ok: false,
        error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.',
      });
    }
    try {
      const body = await readJsonBody(req);
      if (!verifyPassword(body.password)) {
        return sendJson(res, 401, { ok: false, error: 'Mot de passe incorrect.' });
      }
      const cookie = createSessionCookie(res, req);
      return sendJson(res, 200, { ok: true, authenticated: true }, { 'Set-Cookie': cookie });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  if (req.method === 'POST' && urlPath === '/api/admin/logout') {
    const cookie = clearSession(req);
    return sendJson(res, 200, { ok: true, authenticated: false }, { 'Set-Cookie': cookie });
  }

  // --- Espace Adhérent Auth Endpoints ---
  if (req.method === 'GET' && urlPath === '/api/member/me') {
    const member = await getAuthenticatedMember(req);
    if (!member) {
      return sendJson(res, 200, { ok: true, authenticated: false, user: null, orders: [] });
    }
    const memberOrders = await db.getOrdersForMember(member.id, member.email);
    return sendJson(res, 200, {
      ok: true,
      authenticated: true,
      user: sanitizeUser(member),
      orders: memberOrders,
    });
  }

  if (req.method === 'POST' && urlPath === '/api/member/register') {
    try {
      const body = await readJsonBody(req);
      const email = String(body.email || '')
        .trim()
        .toLowerCase();
      const password = String(body.password || '').trim();
      const name = String(body.name || '').trim();
      const phone = String(body.phone || '').trim();
      const favoriteRashguardSize = String(body.favoriteRashguardSize || 'M').trim();
      const favoriteGlovesSize = String(body.favoriteGlovesSize || 'L/XL').trim();

      if (!name || name.length < 2) {
        return sendJson(res, 400, {
          ok: false,
          error: 'Nom et prénom requis (au moins 2 caractères).',
        });
      }
      if (!email || !email.includes('@')) {
        return sendJson(res, 400, { ok: false, error: 'Adresse email valide requise.' });
      }
      if (!password || password.length < 8) {
        return sendJson(res, 400, {
          ok: false,
          error: 'Le mot de passe doit comporter au moins 8 caractères.',
        });
      }

      const existing = await db.findUserByEmail(email);
      if (existing) {
        return sendJson(res, 400, {
          ok: false,
          error: 'Cet email est déjà associé à un compte adhérent.',
        });
      }

      const { salt, hash } = hashMemberPassword(password);
      const newUser = {
        id: 'usr_' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex'),
        name,
        email,
        phone,
        favoriteRashguardSize,
        favoriteGlovesSize,
        salt,
        hash,
        createdAt: new Date().toISOString(),
      };

      await db.saveUser(newUser);

      // Envoi du mail de bienvenue / confirmation de compte (en tâche de fond)
      mailer
        .sendWelcomeEmail(newUser)
        .catch((e) => console.error('[Mailer] Erreur welcome:', e.message));

      const cookie = createMemberSession(newUser.id, newUser.hash, req);
      return sendJson(
        res,
        200,
        {
          ok: true,
          authenticated: true,
          user: sanitizeUser(newUser),
          orders: [],
        },
        { 'Set-Cookie': cookie },
      );
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  if (req.method === 'POST' && urlPath === '/api/member/login') {
    const client = req.socket?.remoteAddress || 'unknown';
    if (!rateAllowed('member-login-ip:' + client, 30, 15 * 60000)) {
      return sendJson(res, 429, {
        ok: false,
        error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.',
      });
    }
    try {
      const body = await readJsonBody(req);
      const email = String(body.email || '')
        .trim()
        .toLowerCase();
      const password = String(body.password || '').trim();

      if (!email || !password) {
        return sendJson(res, 400, { ok: false, error: 'Email et mot de passe requis.' });
      }

      const emailHash = crypto.createHash('sha256').update(email).digest('hex').slice(0, 16);
      if (!rateAllowed('member-login-acc:' + emailHash, 10, 15 * 60000)) {
        return sendJson(res, 429, {
          ok: false,
          error: 'Trop de tentatives infructueuses sur ce compte. Réessayez dans 15 minutes.',
        });
      }

      const user = await db.findUserByEmail(email);
      if (
        !user ||
        !user.salt ||
        !user.hash ||
        !verifyMemberPassword(password, user.salt, user.hash)
      ) {
        return sendJson(res, 401, { ok: false, error: 'Email ou mot de passe incorrect.' });
      }

      const cookie = createMemberSession(user.id, user.hash, req);
      const memberOrders = await db.getOrdersForMember(user.id, user.email);

      return sendJson(
        res,
        200,
        {
          ok: true,
          authenticated: true,
          user: sanitizeUser(user),
          orders: memberOrders,
        },
        { 'Set-Cookie': cookie },
      );
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  if (req.method === 'POST' && urlPath === '/api/member/logout') {
    const cookie = clearMemberSession(req);
    return sendJson(res, 200, { ok: true, authenticated: false }, { 'Set-Cookie': cookie });
  }

  if (req.method === 'POST' && urlPath === '/api/member/update-profile') {
    const member = await getAuthenticatedMember(req);
    if (!member) {
      return sendJson(res, 401, { ok: false, error: 'Authentification requise.' });
    }
    try {
      const body = await readJsonBody(req);
      const updated = await db.updateUserProfile(member.id, {
        name: body.name ? String(body.name).trim() : undefined,
        phone: body.phone !== undefined ? String(body.phone).trim() : undefined,
        favoriteRashguardSize: body.favoriteRashguardSize
          ? String(body.favoriteRashguardSize).trim()
          : undefined,
        favoriteGlovesSize: body.favoriteGlovesSize
          ? String(body.favoriteGlovesSize).trim()
          : undefined,
      });

      return sendJson(res, 200, { ok: true, user: sanitizeUser(updated) });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  if (req.method === 'GET' && urlPath === '/api/admin/members') {
    if (!isAuthenticated(req)) {
      return sendJson(res, 401, { ok: false, error: 'Authentification requise.' });
    }
    const users = (await db.getUsers()).map(sanitizeUser);
    const orders = (await db.getAllOrders()).filter((order) => !order.workflow?.archivedAt);
    const membersWithStats = users.map((u) => {
      const uOrders = orders.filter(
        (o) =>
          (o.memberId && o.memberId === u.id) ||
          (o.memberEmail && o.memberEmail.toLowerCase() === u.email.toLowerCase()),
      );
      const totalSpent = uOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
      return {
        ...u,
        ordersCount: uOrders.length,
        totalSpent,
      };
    });
    return sendJson(res, 200, { ok: true, members: membersWithStats });
  }

  if (req.method === 'POST' && urlPath === '/api/admin/password') {
    if (!isAuthenticated(req)) {
      return sendJson(res, 401, { ok: false, error: 'Authentification requise.' });
    }
    try {
      const body = await readJsonBody(req);
      const currentPassword = String(body.currentPassword || '');
      const newPassword = String(body.newPassword || '');
      if (!verifyPassword(currentPassword)) {
        return sendJson(res, 400, { ok: false, error: 'Mot de passe actuel incorrect.' });
      }
      if (newPassword.length < 8) {
        return sendJson(res, 400, {
          ok: false,
          error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.',
        });
      }
      saveAdminPassword(newPassword);
      activeSessions.clear();
      const cookie = createSessionCookie(res, req);
      return sendJson(res, 200, { ok: true }, { 'Set-Cookie': cookie });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  if (req.method === 'GET' && urlPath === '/api/orders') {
    if (!isAuthenticated(req)) {
      return sendJson(res, 401, { ok: false, error: 'Authentification requise.' });
    }
    const orders = await db.getAllOrders();
    return sendJson(res, 200, { ok: true, orders });
  }

  if (req.method === 'DELETE' && urlPath === '/api/orders') {
    if (!isAuthenticated(req)) {
      return sendJson(res, 401, { ok: false, error: 'Authentification requise.' });
    }
    const orders = await operations.archiveCompleted();
    return sendJson(res, 200, { ok: true, orders });
  }

  if (req.method === 'GET' && urlPath === '/api/products') {
    const products = await db.getProducts();
    return sendJson(res, 200, { ok: true, products });
  }

  if (req.method === 'POST' && urlPath === '/api/products') {
    if (!isAuthenticated(req)) {
      return sendJson(res, 401, { ok: false, error: 'Authentification requise.' });
    }
    try {
      const body = await readJsonBody(req);
      const name = String(body.name || '').trim();
      const price = Number(body.price);
      const category = body.category === 'gants' ? 'gants' : 'rashguard';
      const categoryLabel = category === 'gants' ? 'Gants MMA' : 'Rashguard';
      const rawSizes = Array.isArray(body.sizes)
        ? body.sizes
        : String(body.sizes || '').split(',');
      const sizes = rawSizes.map((s) => String(s).trim()).filter(Boolean);
      const initialStock = Math.max(0, Math.floor(Number(body.initialStock ?? 5) || 0));

      if (!name || !Number.isFinite(price) || price <= 0 || sizes.length === 0) {
        return sendJson(res, 400, {
          ok: false,
          error: 'Nom, prix valide et au moins une taille requis.',
        });
      }

      const slug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const id = `${slug || 'article'}-${crypto.randomBytes(6).toString('hex')}`;

      let image = 'assets/logo.jpg';
      if (body.imageDataUrl) {
        const savedImg = await saveUploadedImage(body.imageDataUrl, slug);
        if (savedImg) image = savedImg;
      }

      const newProduct = {
        id,
        category,
        categoryLabel,
        name,
        price,
        image,
        shortDesc: String(body.shortDesc || 'Équipement officiel DORAGON DOJO CLUB.').trim(),
        sizeLabel: 'Taille',
        sizes,
        defaultSize: sizes[0],
        specs: String(body.shortDesc || '').trim()
          ? [String(body.shortDesc).trim(), 'Équipement officiel du club']
          : ['Équipement officiel du club'],
      };

      return await orderService.withStockLock(async () => {
        const products = await db.getProducts();
        products.push(newProduct);
        await db.saveProducts(products);

        const stock = await db.getStock();
        stock[id] = {};
        sizes.forEach((s) => {
          stock[id][s] = initialStock;
        });
        const updatedStock = await db.saveStock(stock);

        return sendJson(res, 200, {
          ok: true,
          product: newProduct,
          products,
          stock: updatedStock,
        });
      });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  if (req.method === 'POST' && urlPath === '/api/products/delete') {
    if (!isAuthenticated(req)) {
      return sendJson(res, 401, { ok: false, error: 'Authentification requise.' });
    }
    try {
      const body = await readJsonBody(req);
      const id = String(body.id || '').trim();
      return await orderService.withStockLock(async () => {
        const products = (await db.getProducts()).filter((p) => p.id !== id);
        await db.saveProducts(products);
        const stock = await db.getStock();
        delete stock[id];
        const updatedStock = await db.saveStock(stock);
        return sendJson(res, 200, { ok: true, products, stock: updatedStock });
      });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  if (req.method === 'GET' && urlPath === '/api/stock') {
    const stock = await db.getStock();
    return sendJson(res, 200, { ok: true, stock });
  }

  if (req.method === 'POST' && urlPath === '/api/stock') {
    if (!isAuthenticated(req)) {
      return sendJson(res, 401, { ok: false, error: 'Authentification requise.' });
    }
    try {
      const body = await readJsonBody(req);
      return await orderService.withStockLock(async () => {
        let stock = await db.getStock();

        if (body.stock && typeof body.stock === 'object') {
          stock = await db.saveStock(body.stock);
          return sendJson(res, 200, { ok: true, stock });
        }

        const productId = String(body.productId || '');
        const size = String(body.size || '');
        if (!stock[productId] || !(size in stock[productId])) {
          return sendJson(res, 400, { ok: false, error: 'Produit ou taille invalide.' });
        }

        if (
          typeof body.qty === 'number' ||
          (typeof body.qty === 'string' && body.qty !== '')
        ) {
          const nextQty = Math.max(0, Math.floor(Number(body.qty) || 0));
          stock[productId][size] = nextQty;
        } else if (typeof body.delta === 'number') {
          stock[productId][size] = Math.max(
            0,
            stock[productId][size] + Math.trunc(body.delta),
          );
        }

        stock = await db.saveStock(stock);
        return sendJson(res, 200, { ok: true, stock });
      });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  if (req.method === 'POST' && urlPath === '/api/orders') {
    const member = await getAuthenticatedMember(req);
    if (!member)
      return sendJson(res, 401, { ok: false, error: 'Connectez-vous avant de commander.' });
    try {
      const body = await readJsonBody(req);
      if (
        String(body.paymentMethod || '')
          .toLowerCase()
          .includes('en ligne')
      )
        throw new OrderError('Les paiements en ligne doivent être confirmés par Stripe.');
      return sendJson(res, 200, await orderService.reserve(body, member));
    } catch (error) {
      return sendJson(res, error.status || 500, {
        ok: false,
        error: error.status ? error.message : 'La réservation n’a pas été enregistrée.',
        ...error.extra,
      });
    }
  }

  if (req.method === 'GET') {
    const mappedPath = urlPath === '/gestion' ? '/gestion.html' : urlPath;
    return serveStatic(mappedPath, res);
  }

  res.writeHead(405);
  res.end('Method Not Allowed');
}
const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error('[HTTP]', error.message);
    if (!res.headersSent)
      sendJson(res, 500, { ok: false, error: 'Erreur du serveur. Réessayez.' });
    else res.destroy();
  });
});
if (require.main === module) {
  if (
    (process.env.NODE_ENV === 'production' || process.env.RENDER) &&
    (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === 'doragon2026')
  ) {
    console.warn(
      '[SÉCURITÉ] ADMIN_PASSWORD utilise la valeur par défaut ou est absent. Définissez un mot de passe fort sur Render.',
    );
  }
  runMaintenance();
  const timer = setInterval(runMaintenance, 60000);
  timer.unref();
  server.on('close', () => clearInterval(timer));
  server.listen(PORT, HOST, () =>
    console.log('Serveur DORAGON DOJO CLUB prêt sur http://' + HOST + ':' + PORT),
  );
}
module.exports = server;
