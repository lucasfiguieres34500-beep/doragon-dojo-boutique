const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const Stripe = require('stripe');

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

const { PRODUCTS: DEFAULT_PRODUCTS, createDefaultStock, normalizeStock } = require('./catalog.js');
const db = require('./db.js');
const mailer = require('./mailer.js');

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
          ${safeClub} — Boutique Officielle des Adhérents
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
  return await db.findUserById(session.userId);
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
      emailConfigured: isSmtpConfigured(),
      stripeConfigured: Boolean(stripe),
      database: db.isSupabaseConfigured() ? 'supabase' : 'local-json'
    });
  }

  // Fichier officiel de vérification de domaine Apple Pay (requis par Apple pour activer Apple Pay)
  if (req.method === 'GET' && urlPath === '/.well-known/apple-developer-merchantid-domain-association') {
    const appleToken = '7B227073704964223A2239373943394538343346343131343044463144313834343232393232313734313034353044314339464446394437384337313531303944334643463542433731222C2276657273696F6E223A312C22637265617465644F6E223A313731353230333737303832312C227369676E6174757265223A223330383030363039326138363438383666373064303130373032613038303330383030323031303133313064333030623036303936303836343830313635303330343032303133303830303630393261383634383836663730643031303730313030303061303830333038323033653333303832303338386130303330323031303230323038313636333463386230653330353731373330306130363038326138363438636533643034303330323330376133313265333032633036303335353034303330633235343137303730366336353230343137303730366336393633363137343639366636653230343936653734363536373732363137343639366636653230343334313230326432303437333333313236333032343036303335353034306230633164343137303730366336353230343336353732373436393636363936333631373436393666366532303431373537343638366637323639373437393331313333303131303630333535303430613063306134313730373036633635323034393665363332653331306233303039303630333535303430363133303235353533333031653137306433323334333033343332333933313337333433373332333735613137306433323339333033343332333833313337333433373332333635613330356633313235333032333036303335353034303330633163363536333633326437333664373032643632373236663662363537323264373336393637366535663535343333343264353035323466343433313134333031323036303335353034306230633062363934663533323035333739373337343635366437333331313333303131303630333535303430613063306134313730373036633635323034393665363332653331306233303039303630333535303430363133303235353533333035393330313330363037326138363438636533643032303130363038326138363438636533643033303130373033343230303034633231353737656465626436633762323231386636386464373039306131323138646337623062643666326332383364383436303935643934616634613534313162383334323065643831316633343037653833333331663163353463336637656233323230643662616435643465666634393238393839336537633066313361333832303231313330383230323064333030633036303335353164313330313031666630343032333030303330316630363033353531643233303431383330313638303134323366323439633434663933653465663237653663346636323836633366613262626664326534623330343530363038326230363031303530353037303130313034333933303337333033353036303832623036303130353035303733303031383632393638373437343730336132663266366636333733373032653631373037303663363532653633366636643266366636333733373033303334326436313730373036633635363136393633363133333330333233303832303131643036303335353164323030343832303131343330383230313130333038323031306330363039326138363438383666373633363430353031333038316665333038316333303630383262303630313035303530373032303233303831623630633831623335323635366336393631366536333635323036663665323037343638363937333230363336353732373436393636363936333631373436353230363237393230363136653739323037303631373237343739323036313733373337353664363537333230363136333633363537303734363136653633363532303666363632303734363836353230373436383635366532303631373037303663363936333631363236633635323037333734363136653634363137323634323037343635373236643733323036313665363432303633366636653634363937343639366636653733323036663636323037353733363532633230363336353732373436393636363936333631373436353230373036663663363936333739323036313665363432303633363537323734363936363639363336313734363936663665323037303732363136333734363936333635323037333734363137343635366436353665373437333265333033363036303832623036303130353035303730323031313632613638373437343730336132663266373737373737326536313730373036633635326536333666366432663633363537323734363936363639363336313734363536313735373436383666373236393734373932663330333430363033353531643166303432643330326233303239613032376130323538363233363837343734373033613266326636333732366332653631373037303663363532653633366636643266363137303730366336353631363936333631333332653633373236633330316430363033353531643065303431363034313439343537646236666435373438313836383938393736326637653537383530376537396235383234333030653036303335353164306630313031666630343034303330323037383033303066303630393261383634383836663736333634303631643034303230353030333030613036303832613836343863653364303430333032303334393030333034363032323130306336663032336362323631346262333033383838613136323938336531613933663130353666353066613738636462396261346361323431636331346532356530323231303062653363643064666431363234376636343934343735333830653964343463323238613130383930613361316463373234623862346362383838393831386263333038323032656533303832303237356130303330323031303230323038343936643266626633613938646139373330306130363038326138363438636533643034303330323330363733313162333031393036303335353034303330633132343137303730366336353230353236663666373432303433343132303264323034373333333132363330323430363033353530343062306331643431373037303663363532303433363537323734363936363639363336313734363936663665323034313735373436383666373236393734373933313133333031313036303335353034306130633061343137303730366336353230343936653633326533313062333030393036303335353034303631333032353535333330316531373064333133343330333533303336333233333334333633333330356131373064333233393330333533303336333233333334333633333330356133303761333132653330326330363033353530343033306332353431373037303663363532303431373037303663363936333631373436393666366532303439366537343635363737323631373436393666366532303433343132303264323034373333333132363330323430363033353530343062306331643431373037303663363532303433363537323734363936363639363336313734363936663665323034313735373436383666373236393734373933313133333031313036303335353034306130633061343137303730366336353230343936653633326533313062333030393036303335353034303631333032353535333330353933303133303630373261383634386365336430323031303630383261383634386365336430333031303730333432303030346630313731313834313964373634383564353161356532353831303737366538383061326566646537626165346465303864666334623933653133333536643536363562333561653232643039373736306432323465376262613038666437363137636538386362373662623636373062656338653832393834666635343435613338316637333038316634333034363036303832623036303130353035303730313031303433613330333833303336303630383262303630313035303530373330303138363261363837343734373033613266326636663633373337303265363137303730366336353265363336663664326636663633373337303330333432643631373037303663363537323666366637343633363136373333333031643036303335353164306530343136303431343233663234396334346639336534656632376536633466363238366333666132626266643265346233303066303630333535316431333031303166663034303533303033303130316666333031663036303335353164323330343138333031363830313462626230646561313538333338383961613438613939646562656264656261666461636232346162333033373036303335353164316630343330333032653330326361303261613032383836323636383734373437303361326632663633373236633265363137303730366336353265363336663664326636313730373036633635373236663666373436333631363733333265363337323663333030653036303335353164306630313031666630343034303330323031303633303130303630613261383634383836663736333634303630323065303430323035303033303061303630383261383634386365336430343033303230333637303033303634303233303361636637323833353131363939623138366662333563333536636136326266663431376564643930663735346461323865626566313963383135653432623738396638393866373962353939663938643534313064386639646539633266653032333033323264643534343231623061333035373736633564663333383362393036376664313737633263323136643936346663363732363938323132366635346638376137643162393963623962303938393231363130363939306630393932316430303030333138323031383833303832303138343032303130313330383138363330376133313265333032633036303335353034303330633235343137303730366336353230343137303730366336393633363137343639366636653230343936653734363536373732363137343639366636653230343334313230326432303437333333313236333032343036303335353034306230633164343137303730366336353230343336353732373436393636363936333631373436393666366532303431373537343638366637323639373437393331313333303131303630333535303430613063306134313730373036633635323034393665363332653331306233303039303630333535303430363133303235353533303230383136363334633862306533303537313733303062303630393630383634383031363530333034303230316130383139333330313830363039326138363438383666373064303130393033333130623036303932613836343838366637306430313037303133303163303630393261383634383836663730643031303930353331306631373064333233343330333533303338333233313332333933333330356133303238303630393261383634383836663730643031303933343331316233303139333030623036303936303836343830313635303330343032303161313061303630383261383634386365336430343033303233303266303630393261383634383836663730643031303930343331323230343230333232323236336439393239313365333235663163306437643761363331346230343535303337343561363032346633633930313232366166333530626332653330306130363038326138363438636533643034303330323034343733303435303232303537386536353236623062356233306465323562346231343865366632336530626438383631353335613666623865633461396465373338343333633262653530323231303062653834323635333334393162303965376330306437333565323762643865623236373964653462366433613138666434636564386261376565306166383161303030303030303030303030227D';
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end(appleToken);
  }

  // --- Endpoints Stripe (Paiements sécurisés en ligne) ---
  if (req.method === 'GET' && urlPath === '/api/stripe-config') {
    return sendJson(res, 200, {
      ok: true,
      enabled: Boolean(stripe),
      publishableKey: STRIPE_PUBLISHABLE_KEY
    });
  }

  // Initialisation du tunnel Stripe Elements intégré dans la page (sans redirection)
  if (req.method === 'POST' && urlPath === '/api/create-payment-intent') {
    if (!stripe) {
      return sendJson(res, 500, { ok: false, error: 'Passerelle Stripe non configurée sur le serveur.' });
    }
    try {
      const body = await readJsonBody(req);
      const items = Array.isArray(body.items) ? body.items : [];
      const memberName = String(body.memberName || '').trim();
      const authMember = await getAuthenticatedMember(req);
      const memberEmail = String(body.memberEmail || (authMember ? authMember.email : '')).trim();

      if (items.length === 0) {
        return sendJson(res, 400, { ok: false, error: 'Panier vide.' });
      }

      // Vérification du stock en temps réel
      const currentStock = await db.getStock();
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

      const totalAmount = items.reduce((sum, item) => sum + (Number(item.lineTotal) || 0), 0);
      if (totalAmount <= 0) {
        return sendJson(res, 400, { ok: false, error: 'Montant invalide.' });
      }

      const ref = String(body.ref || `CLUB-${Math.floor(1000 + Math.random() * 9000)}`);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(totalAmount * 100),
        currency: 'eur',
        automatic_payment_methods: { enabled: true },
        description: `Commande ${ref} — DORAGON DOJO CLUB`,
        receipt_email: memberEmail && memberEmail.includes('@') ? memberEmail : undefined,
        metadata: {
          ref,
          memberName: memberName || 'Adhérent',
          memberEmail,
          memberPhone: String(body.memberPhone || '').trim(),
          memberNote: String(body.memberNote || '').trim(),
          memberId: authMember ? authMember.id : (body.memberId || ''),
          itemsJson: JSON.stringify(items.map((i) => ({
            id: i.id,
            name: i.name,
            size: i.size,
            qty: i.qty,
            lineTotal: i.lineTotal
          }))).slice(0, 500)
        }
      });

      return sendJson(res, 200, {
        ok: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        ref,
        publishableKey: STRIPE_PUBLISHABLE_KEY
      });
    } catch (err) {
      console.error('[Stripe] Erreur création PaymentIntent :', err);
      return sendJson(res, 500, { ok: false, error: err.message || 'Erreur lors de l\'initialisation du paiement.' });
    }
  }

  // Confirmation immédiate de commande après validation Stripe Elements
  if (req.method === 'POST' && urlPath === '/api/confirm-order') {
    if (!stripe) {
      return sendJson(res, 500, { ok: false, error: 'Passerelle Stripe non configurée.' });
    }
    try {
      const body = await readJsonBody(req);
      const paymentIntentId = String(body.paymentIntentId || '').trim();
      const authMember = await getAuthenticatedMember(req);
      const memberName = String(body.memberName || '').trim();
      const memberEmail = String(body.memberEmail || (authMember ? authMember.email : '')).trim();
      const items = Array.isArray(body.items) ? body.items : [];
      const ref = String(body.ref || `CLUB-${Math.floor(1000 + Math.random() * 9000)}`);

      if (!paymentIntentId) {
        return sendJson(res, 400, { ok: false, error: 'paymentIntentId manquant.' });
      }

      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (!pi || (pi.status !== 'succeeded' && pi.status !== 'processing')) {
        return sendJson(res, 400, { ok: false, error: 'Paiement non confirmé par la banque.' });
      }

      // Éviter tout doublon si la requête est rejouée
      const allOrders = await db.getAllOrders();
      const existing = allOrders.find((o) => o.stripePaymentIntent === paymentIntentId || o.ref === ref);
      if (existing) {
        return sendJson(res, 200, { ok: true, order: existing, alreadyProcessed: true });
      }

      // Mise à jour des stocks
      const currentStock = await db.getStock();
      for (const item of items) {
        const qty = Math.max(1, Math.floor(Number(item.qty) || 1));
        if (currentStock[item.id] && typeof currentStock[item.id][item.size] === 'number') {
          currentStock[item.id][item.size] = Math.max(0, currentStock[item.id][item.size] - qty);
        }
      }
      const updatedStock = await db.saveStock(currentStock);

      const totalPaid = pi.amount_received ? pi.amount_received / 100 : (Number(body.total) || 0);
      const order = {
        ref,
        memberId: authMember ? authMember.id : (body.memberId || null),
        createdAt: new Date().toISOString(),
        dateLabel: new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }),
        memberName: memberName || pi.metadata?.memberName || 'Adhérent',
        memberEmail: memberEmail || pi.metadata?.memberEmail || '',
        memberPhone: String(body.memberPhone || pi.metadata?.memberPhone || '').trim(),
        paymentMethod: 'Paiement en ligne par Carte Bancaire (Stripe)',
        paymentStatus: 'Payé en ligne (Stripe CB)',
        memberNote: String(body.memberNote || pi.metadata?.memberNote || '').trim(),
        total: totalPaid,
        stripePaymentIntent: pi.id,
        items
      };

      await db.saveOrder(order);

      const clubName = process.env.CLUB_NAME || 'DORAGON DOJO CLUB';
      const mailResult = await mailer.sendOrderConfirmationEmail(order, clubName, memberEmail);

      return sendJson(res, 200, {
        ok: true,
        order,
        stock: updatedStock,
        emailSent: Boolean(mailResult && mailResult.sent)
      });
    } catch (err) {
      console.error('[Stripe] Erreur confirm-order :', err);
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  if (req.method === 'POST' && urlPath === '/api/create-checkout-session') {
    if (!stripe) {
      return sendJson(res, 500, { ok: false, error: 'Passerelle Stripe non configurée sur le serveur.' });
    }
    try {
      const body = await readJsonBody(req);
      const memberName = String(body.memberName || '').trim();
      const authMember = await getAuthenticatedMember(req);
      const memberEmail = String(body.memberEmail || (authMember ? authMember.email : '')).trim();
      const items = Array.isArray(body.items) ? body.items : [];

      if (!memberName || items.length === 0) {
        return sendJson(res, 400, { ok: false, error: 'Nom complet et articles dans le panier requis.' });
      }

      // Vérification du stock en temps réel avant redirection
      const currentStock = await db.getStock();
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

      const ref = String(body.ref || `CLUB-${Math.floor(1000 + Math.random() * 9000)}`);

      let origin = 'https://doragon-dojo-boutique.onrender.com';
      if (req.headers.origin) {
        origin = req.headers.origin;
      } else if (req.headers.referer) {
        try {
          origin = new URL(req.headers.referer).origin;
        } catch (e) {}
      }

      const lineItems = items.map((item) => {
        const qty = Math.max(1, Math.floor(Number(item.qty) || 1));
        const unitAmount = Math.round((Number(item.lineTotal) / qty) * 100);
        return {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `${item.name} (${item.size})`,
              description: `Équipement officiel DORAGON DOJO CLUB — Taille ${item.size}`
            },
            unit_amount: unitAmount
          },
          quantity: qty
        };
      });

      const session = await stripe.checkout.sessions.create({
        line_items: lineItems,
        mode: 'payment',
        customer_email: memberEmail && memberEmail.includes('@') ? memberEmail : undefined,
        client_reference_id: ref,
        metadata: {
          ref,
          memberName,
          memberEmail,
          memberPhone: String(body.memberPhone || '').trim(),
          memberNote: String(body.memberNote || '').trim(),
          memberId: authMember ? authMember.id : (body.memberId || ''),
          itemsJson: JSON.stringify(items.map((i) => ({
            id: i.id,
            name: i.name,
            size: i.size,
            qty: i.qty,
            lineTotal: i.lineTotal
          }))).slice(0, 500)
        },
        success_url: `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/?payment=cancelled`
      });

      return sendJson(res, 200, {
        ok: true,
        url: session.url,
        sessionId: session.id,
        ref
      });
    } catch (err) {
      console.error('[Stripe] Erreur création session :', err);
      return sendJson(res, 500, { ok: false, error: err.message || 'Erreur lors de la préparation du paiement sécurisé.' });
    }
  }

  if (req.method === 'GET' && urlPath === '/api/verify-checkout-session') {
    if (!stripe) {
      return sendJson(res, 500, { ok: false, error: 'Passerelle Stripe non configurée.' });
    }
    try {
      const reqUrl = new URL(req.url, 'http://localhost');
      const sessionId = reqUrl.searchParams.get('session_id');
      if (!sessionId) {
        return sendJson(res, 400, { ok: false, error: 'session_id requis.' });
      }

      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (!session) {
        return sendJson(res, 404, { ok: false, error: 'Session Stripe introuvable.' });
      }

      if (session.payment_status !== 'paid') {
        return sendJson(res, 400, {
          ok: false,
          error: 'Le paiement n\'a pas été validé par Stripe.',
          paymentStatus: session.payment_status
        });
      }

      const allOrders = await db.getAllOrders();
      const ref = session.metadata?.ref || session.client_reference_id;
      const existing = allOrders.find((o) => o.stripeSessionId === sessionId || (ref && o.ref === ref));

      if (existing) {
        return sendJson(res, 200, { ok: true, order: existing, alreadyProcessed: true });
      }

      let items = [];
      try {
        if (session.metadata?.itemsJson) {
          items = JSON.parse(session.metadata.itemsJson);
        }
      } catch (e) {}

      // Mise à jour du stock
      const currentStock = await db.getStock();
      for (const item of items) {
        const qty = Math.max(1, Math.floor(Number(item.qty) || 1));
        if (currentStock[item.id] && typeof currentStock[item.id][item.size] === 'number') {
          currentStock[item.id][item.size] = Math.max(0, currentStock[item.id][item.size] - qty);
        }
      }
      const updatedStock = await db.saveStock(currentStock);

      const orderRef = ref || `CLUB-${Math.floor(1000 + Math.random() * 9000)}`;
      const memberName = session.metadata?.memberName || session.customer_details?.name || 'Adhérent';
      const memberEmail = session.metadata?.memberEmail || session.customer_details?.email || session.customer_email || '';
      const memberPhone = session.metadata?.memberPhone || session.customer_details?.phone || '';
      const memberNote = session.metadata?.memberNote || '';
      const memberId = session.metadata?.memberId || null;
      const total = session.amount_total ? session.amount_total / 100 : 0;

      const order = {
        ref: orderRef,
        memberId: memberId || null,
        createdAt: new Date().toISOString(),
        dateLabel: new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }),
        memberName,
        memberEmail,
        memberPhone,
        paymentMethod: 'Paiement en ligne par Carte Bancaire (Stripe)',
        paymentStatus: 'Payé en ligne (Stripe CB)',
        memberNote,
        total,
        stripeSessionId: session.id,
        stripePaymentIntent: String(session.payment_intent || ''),
        items
      };

      await db.saveOrder(order);

      const clubName = process.env.CLUB_NAME || 'DORAGON DOJO CLUB';
      const mailResult = await mailer.sendOrderConfirmationEmail(order, clubName, memberEmail);

      return sendJson(res, 200, {
        ok: true,
        order,
        stock: updatedStock,
        emailSent: Boolean(mailResult && mailResult.sent)
      });
    } catch (err) {
      console.error('[Stripe] Erreur vérification session :', err);
      return sendJson(res, 500, { ok: false, error: err.message });
    }
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
    const member = await getAuthenticatedMember(req);
    if (!member) {
      return sendJson(res, 200, { ok: true, authenticated: false, user: null, orders: [] });
    }
    const memberOrders = await db.getOrdersForMember(member.id, member.email);
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

      const existing = await db.findUserByEmail(email);
      if (existing) {
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

      await db.saveUser(newUser);

      // Envoi du mail de bienvenue / confirmation de compte (en tâche de fond)
      mailer.sendWelcomeEmail(newUser).catch((e) => console.error('[Mailer] Erreur welcome:', e.message));

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

      const user = await db.findUserByEmail(email);
      if (!user || !user.salt || !user.hash || !verifyMemberPassword(password, user.salt, user.hash)) {
        return sendJson(res, 401, { ok: false, error: 'Email ou mot de passe incorrect.' });
      }

      const cookie = createMemberSession(user.id);
      const memberOrders = await db.getOrdersForMember(user.id, user.email);

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
    const member = await getAuthenticatedMember(req);
    if (!member) {
      return sendJson(res, 401, { ok: false, error: 'Authentification requise.' });
    }
    try {
      const body = await readJsonBody(req);
      const updated = await db.updateUserProfile(member.id, {
        name: body.name ? String(body.name).trim() : undefined,
        phone: body.phone !== undefined ? String(body.phone).trim() : undefined,
        favoriteRashguardSize: body.favoriteRashguardSize ? String(body.favoriteRashguardSize).trim() : undefined,
        favoriteGlovesSize: body.favoriteGlovesSize ? String(body.favoriteGlovesSize).trim() : undefined
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
    const orders = await db.getAllOrders();
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
    const orders = await db.getAllOrders();
    return sendJson(res, 200, { ok: true, orders });
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

      const products = await db.getProducts();
      products.push(newProduct);
      await db.saveProducts(products);

      const stock = await db.getStock();
      stock[id] = {};
      sizes.forEach((s) => {
        stock[id][s] = initialStock;
      });
      const updatedStock = await db.saveStock(stock);

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
      const products = (await db.getProducts()).filter((p) => p.id !== id);
      await db.saveProducts(products);
      const stock = await db.getStock();
      delete stock[id];
      const updatedStock = await db.saveStock(stock);
      return sendJson(res, 200, { ok: true, products, stock: updatedStock });
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

      if (typeof body.qty === 'number' || (typeof body.qty === 'string' && body.qty !== '')) {
        const nextQty = Math.max(0, Math.floor(Number(body.qty) || 0));
        stock[productId][size] = nextQty;
      } else if (typeof body.delta === 'number') {
        stock[productId][size] = Math.max(0, stock[productId][size] + Math.trunc(body.delta));
      }

      stock = await db.saveStock(stock);
      return sendJson(res, 200, { ok: true, stock });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  if (req.method === 'POST' && urlPath === '/api/orders') {
    try {
      const body = await readJsonBody(req);
      const memberName = String(body.memberName || '').trim();
      const authMember = await getAuthenticatedMember(req);
      const memberEmail = String(body.memberEmail || (authMember ? authMember.email : '')).trim();
      const items = Array.isArray(body.items) ? body.items : [];

      if (!memberName || items.length === 0) {
        return sendJson(res, 400, { ok: false, error: 'Nom complet et articles dans le panier requis.' });
      }

      const currentStock = await db.getStock();
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
      const updatedStock = await db.saveStock(currentStock);

      const clubName = String(body.clubName || process.env.CLUB_NAME || 'DORAGON DOJO CLUB').trim();
      const paymentMethod = String(body.paymentMethod || 'Paiement en ligne par Carte Bancaire').trim();
      const isOnlinePaid = paymentMethod.toLowerCase().includes('en ligne');
      const order = {
        ref: String(body.ref || `CLUB-${Math.floor(1000 + Math.random() * 9000)}`),
        memberId: authMember ? authMember.id : (body.memberId || null),
        createdAt: body.createdAt || new Date().toISOString(),
        dateLabel: body.dateLabel || new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }),
        memberName,
        memberEmail,
        memberPhone: String(body.memberPhone || '').trim(),
        paymentMethod,
        paymentStatus: isOnlinePaid ? 'Payé en ligne (CB)' : 'À régler au dojo (Réservation)',
        memberNote: String(body.memberNote || '').trim(),
        total: Number(body.total) || 0,
        items
      };

      await db.saveOrder(order);

      const mailResult = await mailer.sendOrderConfirmationEmail(order, clubName, body.clubEmail);
      return sendJson(res, 200, {
        ok: true,
        order,
        stock: updatedStock,
        emailSent: Boolean(mailResult && mailResult.sent),
        emailStatus: mailResult && mailResult.sent ? 'sent' : (mailResult && mailResult.simulated ? 'simulated' : 'none'),
        emailError: mailResult && mailResult.error ? mailResult.error : undefined
      });
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
