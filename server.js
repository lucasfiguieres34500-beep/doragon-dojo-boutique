const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { PRODUCTS: DEFAULT_PRODUCTS, createDefaultStock, normalizeStock } = require('./catalog.js');

loadEnv(path.join(__dirname, '.env'));

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const STOCK_FILE = path.join(DATA_DIR, 'stock.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const AUTH_FILE = path.join(DATA_DIR, 'admin-auth.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const UPLOADS_DIR = path.join(ROOT_DIR, 'assets', 'uploads');
const LOGO_PATH = path.join(ROOT_DIR, 'assets', 'logo.jpg');
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
  '.svg': 'image/svg+xml'
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
    const value = line.slice(eqIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function isSmtpConfigured() {
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  return Boolean(
    user &&
    pass &&
    !user.includes('votre.email@') &&
    !pass.includes('votre-mot-de-passe')
  );
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 465,
    secure: String(process.env.SMTP_SECURE || 'true').toLowerCase() === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatEuro(amount) {
  return `${Number(amount).toFixed(2).replace('.', ',')} €`;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readOrders() {
  try {
    if (!fs.existsSync(ORDERS_FILE)) return [];
    const raw = fs.readFileSync(ORDERS_FILE, 'utf8');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveOrder(order) {
  ensureDataDir();
  const orders = readOrders();
  orders.unshift(order);
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
}

function readProducts() {
  try {
    if (!fs.existsSync(PRODUCTS_FILE)) {
      saveProducts(DEFAULT_PRODUCTS);
      return DEFAULT_PRODUCTS;
    }
    const raw = fs.readFileSync(PRODUCTS_FILE, 'utf8');
    const parsed = raw ? JSON.parse(raw) : DEFAULT_PRODUCTS;
    return Array.isArray(parsed) ? parsed : DEFAULT_PRODUCTS;
  } catch {
    return DEFAULT_PRODUCTS;
  }
}

function saveProducts(products) {
  ensureDataDir();
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf8');
  return products;
}

function saveUploadedImage(dataUrl, slug) {
  const match = String(dataUrl || '').match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const buffer = Buffer.from(match[2], 'base64');
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, '').slice(0, 32) || 'article';
  const filename = `${safeSlug}-${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
  return `assets/uploads/${filename}`;
}

function readStock() {
  const products = readProducts();
  try {
    if (!fs.existsSync(STOCK_FILE)) {
      const initial = createDefaultStock(5, products);
      saveStock(initial);
      return initial;
    }
    const raw = fs.readFileSync(STOCK_FILE, 'utf8');
    return normalizeStock(raw ? JSON.parse(raw) : null, products);
  } catch {
    return createDefaultStock(5, products);
  }
}

function saveStock(stock) {
  ensureDataDir();
  const products = readProducts();
  const normalized = normalizeStock(stock, products);
  fs.writeFileSync(STOCK_FILE, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

function buildReceiptEmail(order, clubName) {
  const safeClub = escapeHtml(clubName);
  const safeName = escapeHtml(order.memberName);
  const safeRef = escapeHtml(order.ref);
  const safeDate = escapeHtml(order.dateLabel);
  const safePayment = escapeHtml(order.paymentMethod);

  const itemsRowsHtml = order.items.map((item) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#0d1526;font-weight:600;">
        ${escapeHtml(item.name)}<br/>
        <span style="font-size:12px;color:#64748b;font-weight:400;">Taille / Poids : ${escapeHtml(item.size)}</span>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center;color:#4a5568;">${item.qty}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;color:#0e2d6b;font-weight:700;">${formatEuro(item.lineTotal)}</td>
    </tr>
  `).join('');

  const html = `
  <!DOCTYPE html>
  <html lang="fr">
  <head><meta charset="UTF-8" /></head>
  <body style="margin:0;padding:24px;background-color:#f7f8fb;font-family:Arial,Helvetica,sans-serif;color:#0d1526;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
      <tr>
        <td style="padding:24px 28px;border-bottom:1px solid #e2e8f0;text-align:center;background:#ffffff;">
          ${fs.existsSync(LOGO_PATH) ? '<img src="cid:club-logo" alt="' + safeClub + '" width="96" style="display:block;margin:0 auto 12px;" />' : ''}
          <div style="font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#b22d25;">Reçu de commande adhérent</div>
          <h1 style="margin:6px 0 0;font-size:22px;color:#0d1526;">Merci d'avoir passé commande !</h1>
          <p style="margin:6px 0 0;font-size:14px;color:#4a5568;">${safeClub}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 28px;">
          <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#334155;">
            Bonjour <strong>${safeName}</strong>,<br/>
            Votre commande <strong>${safeRef}</strong> du ${safeDate} a bien été enregistrée. Voici votre reçu récapitulatif :
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:18px;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#64748b;">Article</th>
                <th style="padding:10px 12px;text-align:center;font-size:12px;text-transform:uppercase;color:#64748b;">Qté</th>
                <th style="padding:10px 12px;text-align:right;font-size:12px;text-transform:uppercase;color:#64748b;">Prix</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRowsHtml}
              <tr style="background:#f8fafc;">
                <td colspan="2" style="padding:12px;font-weight:700;font-size:15px;">Total (retrait au club offert)</td>
                <td style="padding:12px;text-align:right;font-weight:800;font-size:16px;color:#0e2d6b;">${formatEuro(order.total)}</td>
              </tr>
            </tbody>
          </table>

          <div style="background:#f7f8fb;border-radius:10px;padding:14px 16px;font-size:13px;color:#475569;line-height:1.6;">
            <div><strong>Mode de règlement :</strong> ${safePayment}</div>
            ${order.memberPhone ? `<div><strong>Téléphone :</strong> ${escapeHtml(order.memberPhone)}</div>` : ''}
            ${order.memberNote ? `<div><strong>Remarque :</strong> ${escapeHtml(order.memberNote)}</div>` : ''}
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 28px;background:#0d1526;color:#cbd5e1;font-size:12px;text-align:center;">
          ${safeClub} — Retrait et règlement directement au club.
        </td>
      </tr>
    </table>
  </body>
  </html>`;

  const text = [
    `Merci d'avoir passé commande chez ${clubName} !`,
    '',
    `Reçu n° : ${order.ref}`,
    `Date : ${order.dateLabel}`,
    `Adhérent : ${order.memberName}`,
    `Email : ${order.memberEmail}`,
    order.memberPhone ? `Téléphone : ${order.memberPhone}` : null,
    `Règlement : ${order.paymentMethod}`,
    order.memberNote ? `Remarque : ${order.memberNote}` : null,
    '',
    'Articles :',
    ...order.items.map((i) => `- ${i.qty}x ${i.name} (${i.size}) : ${formatEuro(i.lineTotal)}`),
    '',
    `TOTAL : ${formatEuro(order.total)} (Retrait gratuit au club)`
  ].filter(Boolean).join('\n');

  return { html, text };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 8 * 1024 * 1024) {
        reject(new Error('Fichier trop volumineux (max 8 Mo)'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('JSON invalide'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data, extraHeaders = {}) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders });
  res.end(JSON.stringify(data));
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const result = {};
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx <= 0) return;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    result[key] = val;
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

function createSessionCookie(res) {
  const token = crypto.randomBytes(24).toString('hex');
  activeSessions.set(token, Date.now() + SESSION_TTL_MS);
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`;
}

function clearSession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) activeSessions.delete(token);
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
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
        return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
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

function readUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    const raw = fs.readFileSync(USERS_FILE, 'utf8');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  ensureDataDir();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
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

function getAuthenticatedMember(req) {
  const cookies = parseCookies(req);
  const token = cookies[MEMBER_SESSION_COOKIE];
  if (!token) return null;
  const session = activeMemberSessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    activeMemberSessions.delete(token);
    return null;
  }
  const users = readUsers();
  return users.find((u) => u.id === session.userId) || null;
}

function createMemberSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  activeMemberSessions.set(token, {
    userId,
    expiresAt: Date.now() + MEMBER_SESSION_TTL_MS
  });
  return `${MEMBER_SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${MEMBER_SESSION_TTL_MS / 1000}`;
}

function clearMemberSession(req) {
  const token = parseCookies(req)[MEMBER_SESSION_COOKIE];
  if (token) activeMemberSessions.delete(token);
  return `${MEMBER_SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

function serveStatic(reqPath, res) {
  const safePath = path.normalize(reqPath === '/' ? 'index.html' : reqPath.replace(/^\/+/, ''));
  const fullPath = path.join(ROOT_DIR, safePath);

  if (!fullPath.startsWith(ROOT_DIR) || safePath.startsWith('data') || safePath === '.env') {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(fullPath, (err, content) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const ext = path.extname(fullPath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const urlPath = (req.url || '/').split('?')[0];

  if (req.method === 'GET' && urlPath === '/api/health') {
    return sendJson(res, 200, {
      ok: true,
      emailConfigured: isSmtpConfigured()
    });
  }

  if (req.method === 'GET' && urlPath === '/api/admin/session') {
    return sendJson(res, 200, { ok: true, authenticated: isAuthenticated(req) });
  }

  if (req.method === 'POST' && urlPath === '/api/admin/login') {
    try {
      const body = await readJsonBody(req);
      if (!verifyPassword(body.password)) {
        return sendJson(res, 401, { ok: false, error: 'Mot de passe incorrect.' });
      }
      const cookie = createSessionCookie(res);
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
    const member = getAuthenticatedMember(req);
    if (!member) {
      return sendJson(res, 200, { ok: true, authenticated: false, user: null, orders: [] });
    }
    const allOrders = readOrders();
    const memberOrders = allOrders.filter(
      (o) => (o.memberId && o.memberId === member.id) || (o.memberEmail && o.memberEmail.toLowerCase() === member.email.toLowerCase())
    );
    return sendJson(res, 200, {
      ok: true,
      authenticated: true,
      user: sanitizeUser(member),
      orders: memberOrders
    });
  }

  if (req.method === 'POST' && urlPath === '/api/member/register') {
    try {
      const body = await readJsonBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '').trim();
      const name = String(body.name || '').trim();
      const phone = String(body.phone || '').trim();
      const favoriteRashguardSize = String(body.favoriteRashguardSize || 'M').trim();
      const favoriteGlovesSize = String(body.favoriteGlovesSize || 'L/XL').trim();

      if (!name || name.length < 2) {
        return sendJson(res, 400, { ok: false, error: 'Nom et prénom requis (au moins 2 caractères).' });
      }
      if (!email || !email.includes('@')) {
        return sendJson(res, 400, { ok: false, error: 'Adresse email valide requise.' });
      }
      if (!password || password.length < 6) {
        return sendJson(res, 400, { ok: false, error: 'Le mot de passe doit comporter au moins 6 caractères.' });
      }

      const users = readUsers();
      if (users.some((u) => u.email.toLowerCase() === email)) {
        return sendJson(res, 400, { ok: false, error: 'Cet email est déjà associé à un compte adhérent.' });
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
        createdAt: new Date().toISOString()
      };

      users.push(newUser);
      saveUsers(users);

      const cookie = createMemberSession(newUser.id);
      return sendJson(res, 200, {
        ok: true,
        authenticated: true,
        user: sanitizeUser(newUser),
        orders: []
      }, { 'Set-Cookie': cookie });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  if (req.method === 'POST' && urlPath === '/api/member/login') {
    try {
      const body = await readJsonBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '').trim();

      if (!email || !password) {
        return sendJson(res, 400, { ok: false, error: 'Email et mot de passe requis.' });
      }

      const users = readUsers();
      const user = users.find((u) => u.email.toLowerCase() === email);
      if (!user || !user.salt || !user.hash || !verifyMemberPassword(password, user.salt, user.hash)) {
        return sendJson(res, 401, { ok: false, error: 'Email ou mot de passe incorrect.' });
      }

      const cookie = createMemberSession(user.id);
      const allOrders = readOrders();
      const memberOrders = allOrders.filter(
        (o) => (o.memberId && o.memberId === user.id) || (o.memberEmail && o.memberEmail.toLowerCase() === user.email.toLowerCase())
      );

      return sendJson(res, 200, {
        ok: true,
        authenticated: true,
        user: sanitizeUser(user),
        orders: memberOrders
      }, { 'Set-Cookie': cookie });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  if (req.method === 'POST' && urlPath === '/api/member/logout') {
    const cookie = clearMemberSession(req);
    return sendJson(res, 200, { ok: true, authenticated: false }, { 'Set-Cookie': cookie });
  }

  if (req.method === 'POST' && urlPath === '/api/member/update-profile') {
    const member = getAuthenticatedMember(req);
    if (!member) {
      return sendJson(res, 401, { ok: false, error: 'Authentification requise.' });
    }
    try {
      const body = await readJsonBody(req);
      const users = readUsers();
      const idx = users.findIndex((u) => u.id === member.id);
      if (idx === -1) {
        return sendJson(res, 404, { ok: false, error: 'Utilisateur introuvable.' });
      }
      if (body.name) users[idx].name = String(body.name).trim();
      if (body.phone !== undefined) users[idx].phone = String(body.phone).trim();
      if (body.favoriteRashguardSize) users[idx].favoriteRashguardSize = String(body.favoriteRashguardSize).trim();
      if (body.favoriteGlovesSize) users[idx].favoriteGlovesSize = String(body.favoriteGlovesSize).trim();
      saveUsers(users);

      return sendJson(res, 200, { ok: true, user: sanitizeUser(users[idx]) });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  if (req.method === 'GET' && urlPath === '/api/admin/members') {
    if (!isAuthenticated(req)) {
      return sendJson(res, 401, { ok: false, error: 'Authentification requise.' });
    }
    const users = readUsers().map(sanitizeUser);
    const orders = readOrders();
    const membersWithStats = users.map((u) => {
      const uOrders = orders.filter((o) => (o.memberId && o.memberId === u.id) || (o.memberEmail && o.memberEmail.toLowerCase() === u.email.toLowerCase()));
      const totalSpent = uOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
      return {
        ...u,
        ordersCount: uOrders.length,
        totalSpent
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
      if (newPassword.length < 4) {
        return sendJson(res, 400, { ok: false, error: 'Le nouveau mot de passe doit contenir au moins 4 caractères.' });
      }
      saveAdminPassword(newPassword);
      return sendJson(res, 200, { ok: true });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  if (req.method === 'GET' && urlPath === '/api/orders') {
    if (!isAuthenticated(req)) {
      return sendJson(res, 401, { ok: false, error: 'Authentification requise.' });
    }
    return sendJson(res, 200, { ok: true, orders: readOrders() });
  }

  if (req.method === 'DELETE' && urlPath === '/api/orders') {
    if (!isAuthenticated(req)) {
      return sendJson(res, 401, { ok: false, error: 'Authentification requise.' });
    }
    ensureDataDir();
    fs.writeFileSync(ORDERS_FILE, '[]', 'utf8');
    return sendJson(res, 200, { ok: true, orders: [] });
  }

  if (req.method === 'GET' && urlPath === '/api/products') {
    return sendJson(res, 200, { ok: true, products: readProducts() });
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
      const rawSizes = Array.isArray(body.sizes) ? body.sizes : String(body.sizes || '').split(',');
      const sizes = rawSizes.map((s) => String(s).trim()).filter(Boolean);
      const initialStock = Math.max(0, Math.floor(Number(body.initialStock ?? 5) || 0));

      if (!name || !Number.isFinite(price) || price <= 0 || sizes.length === 0) {
        return sendJson(res, 400, { ok: false, error: 'Nom, prix valide et au moins une taille requis.' });
      }

      const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const id = `${slug || 'article'}-${Math.floor(100 + Math.random() * 900)}`;

      let image = 'assets/logo.jpg';
      if (body.imageDataUrl) {
        const savedImg = saveUploadedImage(body.imageDataUrl, slug);
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
          : ['Équipement officiel du club']
      };

      const products = readProducts();
      products.push(newProduct);
      saveProducts(products);

      const stock = readStock();
      stock[id] = {};
      sizes.forEach((s) => {
        stock[id][s] = initialStock;
      });
      const updatedStock = saveStock(stock);

      return sendJson(res, 200, { ok: true, product: newProduct, products, stock: updatedStock });
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
      const products = readProducts().filter((p) => p.id !== id);
      saveProducts(products);
      const stock = readStock();
      delete stock[id];
      const updatedStock = saveStock(stock);
      return sendJson(res, 200, { ok: true, products, stock: updatedStock });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  if (req.method === 'GET' && urlPath === '/api/stock') {
    return sendJson(res, 200, { ok: true, stock: readStock() });
  }

  if (req.method === 'POST' && urlPath === '/api/stock') {
    if (!isAuthenticated(req)) {
      return sendJson(res, 401, { ok: false, error: 'Authentification requise.' });
    }
    try {
      const body = await readJsonBody(req);
      let stock = readStock();

      if (body.stock && typeof body.stock === 'object') {
        stock = saveStock(body.stock);
        return sendJson(res, 200, { ok: true, stock });
      }

      const productId = String(body.productId || '');
      const size = String(body.size || '');
      if (!stock[productId] || !(size in stock[productId])) {
        return sendJson(res, 400, { ok: false, error: 'Produit ou taille invalide.' });
      }

      if (typeof body.qty === 'number' || (typeof body.qty === 'string' && body.qty !== '')) {
        const nextQty = Math.max(0, Math.floor(Number(body.qty) || 0));
        stock[productId][size] = nextQty;
      } else if (typeof body.delta === 'number') {
        stock[productId][size] = Math.max(0, stock[productId][size] + Math.trunc(body.delta));
      }

      stock = saveStock(stock);
      return sendJson(res, 200, { ok: true, stock });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  if (req.method === 'POST' && urlPath === '/api/orders') {
    try {
      const body = await readJsonBody(req);
      const memberName = String(body.memberName || '').trim();
      const memberEmail = String(body.memberEmail || '').trim();
      const items = Array.isArray(body.items) ? body.items : [];

      if (!memberName || !memberEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(memberEmail) || items.length === 0) {
        return sendJson(res, 400, { ok: false, error: 'Nom, email valide et articles requis.' });
      }

      const currentStock = readStock();
      for (const item of items) {
        const qty = Math.max(1, Math.floor(Number(item.qty) || 1));
        const available = currentStock[item.id]?.[item.size];
        if (typeof available === 'number' && available < qty) {
          return sendJson(res, 409, {
            ok: false,
            error: `Stock insuffisant pour ${item.name} (${item.size}) — restant : ${available}.`,
            stock: currentStock
          });
        }
      }

      for (const item of items) {
        const qty = Math.max(1, Math.floor(Number(item.qty) || 1));
        if (currentStock[item.id] && typeof currentStock[item.id][item.size] === 'number') {
          currentStock[item.id][item.size] = Math.max(0, currentStock[item.id][item.size] - qty);
        }
      }
      const updatedStock = saveStock(currentStock);

      const authMember = getAuthenticatedMember(req);
      const clubName = String(body.clubName || process.env.CLUB_NAME || 'DORAGON DOJO CLUB').trim();
      const order = {
        ref: String(body.ref || `CLUB-${Math.floor(1000 + Math.random() * 9000)}`),
        memberId: authMember ? authMember.id : (body.memberId || null),
        createdAt: body.createdAt || new Date().toISOString(),
        dateLabel: body.dateLabel || new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }),
        memberName,
        memberEmail,
        memberPhone: String(body.memberPhone || '').trim(),
        paymentMethod: String(body.paymentMethod || 'Sur place au club (Espèces / CB)').trim(),
        memberNote: String(body.memberNote || '').trim(),
        total: Number(body.total) || 0,
        items
      };

      saveOrder(order);

      if (!isSmtpConfigured()) {
        return sendJson(res, 200, {
          ok: true,
          order,
          stock: updatedStock,
          emailSent: false,
          emailStatus: 'not_configured'
        });
      }

      try {
        const transporter = createTransporter();
        const { html, text } = buildReceiptEmail(order, clubName);
        const attachments = fs.existsSync(LOGO_PATH)
          ? [{ filename: 'logo.jpg', path: LOGO_PATH, cid: 'club-logo' }]
          : [];

        const mailOptions = {
          from: `"${clubName}" <${process.env.SMTP_USER}>`,
          to: order.memberEmail,
          subject: `Merci pour votre commande ${order.ref} — ${clubName}`,
          text,
          html,
          attachments
        };

        const clubCopy = (body.clubEmail || process.env.CLUB_EMAIL || '').trim();
        if (clubCopy && clubCopy !== order.memberEmail && !clubCopy.includes('monclub.fr')) {
          mailOptions.bcc = clubCopy;
        }

        await transporter.sendMail(mailOptions);
        return sendJson(res, 200, {
          ok: true,
          order,
          stock: updatedStock,
          emailSent: true,
          emailStatus: 'sent'
        });
      } catch (mailErr) {
        return sendJson(res, 200, {
          ok: true,
          order,
          stock: updatedStock,
          emailSent: false,
          emailStatus: 'error',
          emailError: mailErr.message
        });
      }
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  if (req.method === 'GET') {
    const mappedPath = urlPath === '/gestion' ? '/gestion.html' : urlPath;
    return serveStatic(mappedPath, res);
  }

  res.writeHead(405);
  res.end('Method Not Allowed');
});

server.listen(PORT, HOST, () => {
  console.log(`Serveur DORAGON DOJO CLUB prêt sur http://${HOST}:${PORT}`);
});
