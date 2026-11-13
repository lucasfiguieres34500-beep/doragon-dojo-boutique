// ============================================================
// DORAGON DOJO CLUB — GESTIONNAIRE DE BASE DE DONNÉES UNIFIÉ
// Supporte Supabase (PostgreSQL hébergé dans le cloud)
// avec basculement automatique sur fichiers JSON locaux
// ============================================================

const fs = require('fs');
const path = require('path');

// Polyfill WebSocket pour les environnements Node < 22 (comme certains conteneurs Render)
if (typeof global.WebSocket === 'undefined') {
  try {
    global.WebSocket = require('ws');
  } catch (e) {
    // ws optionnel si Node 22+
  }
}

const { createClient } = require('@supabase/supabase-js');
const { PRODUCTS: DEFAULT_PRODUCTS, createDefaultStock, normalizeStock } = require('./catalog.js');

const DATA_DIR = path.join(__dirname, 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const STOCK_FILE = path.join(DATA_DIR, 'stock.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Configuration Supabase
const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_KEY = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  ''
).trim();

let supabase = null;
const isConfigured = Boolean(
  SUPABASE_URL &&
  SUPABASE_KEY &&
  SUPABASE_URL.startsWith('http') &&
  !SUPABASE_URL.includes('your-project')
);

if (isConfigured) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false }
    });
    console.log(`[Supabase] Client initialisé avec succès sur : ${SUPABASE_URL}`);
  } catch (err) {
    console.error('[Supabase] Erreur d’initialisation :', err.message);
    supabase = null;
  }
} else {
  console.log('[Database] Supabase non configuré — Utilisation de la base locale JSON (data/*.json)');
}

function isSupabaseActive() {
  return Boolean(supabase);
}

// ------------------------------------------------------------
// GESTION DES FICHIERS LOCAUX (Fallback)
// ------------------------------------------------------------
function readLocalJson(filePath, fallback = []) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalJson(filePath, data) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// ------------------------------------------------------------
// ADHÉRENTS (MEMBERS)
// ------------------------------------------------------------
async function getUsers() {
  if (isSupabaseActive()) {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        return data.map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          phone: row.phone || '',
          favoriteRashguardSize: row.favorite_rashguard_size || 'M',
          favoriteGlovesSize: row.favorite_gloves_size || 'L/XL',
          salt: row.salt,
          hash: row.hash,
          createdAt: row.created_at
        }));
      }
      console.warn('[Supabase] Erreur getUsers, bascule locale :', error?.message);
    } catch (err) {
      console.warn('[Supabase] Exception getUsers :', err.message);
    }
  }
  return readLocalJson(USERS_FILE, []);
}

async function findUserByEmail(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) return null;

  if (isSupabaseActive()) {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          name: data.name,
          email: data.email,
          phone: data.phone || '',
          favoriteRashguardSize: data.favorite_rashguard_size || 'M',
          favoriteGlovesSize: data.favorite_gloves_size || 'L/XL',
          salt: data.salt,
          hash: data.hash,
          createdAt: data.created_at
        };
      }
    } catch (err) {
      console.warn('[Supabase] Exception findUserByEmail :', err.message);
    }
  }

  const local = readLocalJson(USERS_FILE, []);
  return local.find((u) => u.email.toLowerCase() === cleanEmail) || null;
}

async function findUserById(id) {
  if (!id) return null;

  if (isSupabaseActive()) {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          name: data.name,
          email: data.email,
          phone: data.phone || '',
          favoriteRashguardSize: data.favorite_rashguard_size || 'M',
          favoriteGlovesSize: data.favorite_gloves_size || 'L/XL',
          salt: data.salt,
          hash: data.hash,
          createdAt: data.created_at
        };
      }
    } catch (err) {
      console.warn('[Supabase] Exception findUserById :', err.message);
    }
  }

  const local = readLocalJson(USERS_FILE, []);
  return local.find((u) => u.id === id) || null;
}

async function saveUser(user) {
  // 1. Sauvegarde locale en miroir
  const local = readLocalJson(USERS_FILE, []);
  const index = local.findIndex((u) => u.id === user.id);
  if (index >= 0) {
    local[index] = { ...local[index], ...user };
  } else {
    local.unshift(user);
  }
  writeLocalJson(USERS_FILE, local);

  // 2. Sauvegarde Supabase
  if (isSupabaseActive()) {
    try {
      const row = {
        id: user.id,
        name: user.name,
        email: user.email.toLowerCase(),
        phone: user.phone || '',
        favorite_rashguard_size: user.favoriteRashguardSize || 'M',
        favorite_gloves_size: user.favoriteGlovesSize || 'L/XL',
        salt: user.salt,
        hash: user.hash,
        created_at: user.createdAt || new Date().toISOString()
      };
      const { error } = await supabase.from('members').upsert(row);
      if (error) console.error('[Supabase] Erreur upsert member :', error.message);
    } catch (err) {
      console.error('[Supabase] Exception upsert member :', err.message);
    }
  }

  return user;
}

async function updateUserProfile(id, updates) {
  const user = await findUserById(id);
  if (!user) return null;

  const updated = {
    ...user,
    name: updates.name !== undefined ? updates.name : user.name,
    phone: updates.phone !== undefined ? updates.phone : user.phone,
    favoriteRashguardSize: updates.favoriteRashguardSize !== undefined ? updates.favoriteRashguardSize : user.favoriteRashguardSize,
    favoriteGlovesSize: updates.favoriteGlovesSize !== undefined ? updates.favoriteGlovesSize : user.favoriteGlovesSize
  };

  return await saveUser(updated);
}

// ------------------------------------------------------------
// COMMANDES (ORDERS)
// ------------------------------------------------------------
async function getAllOrders() {
  if (isSupabaseActive()) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        return data.map((row) => ({
          ref: row.ref,
          memberId: row.member_id,
          createdAt: row.created_at,
          dateLabel: row.date_label,
          memberName: row.member_name,
          memberEmail: row.member_email,
          memberPhone: row.member_phone,
          paymentMethod: row.payment_method,
          paymentStatus: row.payment_status,
          memberNote: row.member_note || '',
          total: Number(row.total) || 0,
          items: Array.isArray(row.items) ? row.items : []
        }));
      }
      console.warn('[Supabase] Erreur getAllOrders, bascule locale :', error?.message);
    } catch (err) {
      console.warn('[Supabase] Exception getAllOrders :', err.message);
    }
  }

  return readLocalJson(ORDERS_FILE, []);
}

async function getOrdersForMember(memberId, memberEmail) {
  const all = await getAllOrders();
  const cleanEmail = String(memberEmail || '').trim().toLowerCase();

  return all.filter((o) => {
    if (memberId && o.memberId === memberId) return true;
    if (cleanEmail && o.memberEmail && o.memberEmail.toLowerCase() === cleanEmail) return true;
    return false;
  });
}

async function saveOrder(order) {
  // 1. Sauvegarde locale en miroir
  const local = readLocalJson(ORDERS_FILE, []);
  local.unshift(order);
  writeLocalJson(ORDERS_FILE, local);

  // 2. Sauvegarde Supabase
  if (isSupabaseActive()) {
    try {
      const row = {
        ref: order.ref,
        member_id: order.memberId || null,
        created_at: order.createdAt || new Date().toISOString(),
        date_label: order.dateLabel,
        member_name: order.memberName,
        member_email: order.memberEmail,
        member_phone: order.memberPhone || '',
        payment_method: order.paymentMethod,
        payment_status: order.paymentStatus,
        member_note: order.memberNote || '',
        total: Number(order.total) || 0,
        items: order.items
      };
      const { error } = await supabase.from('orders').insert(row);
      if (error) console.error('[Supabase] Erreur insert order :', error.message);
    } catch (err) {
      console.error('[Supabase] Exception insert order :', err.message);
    }
  }

  return order;
}

// ------------------------------------------------------------
// STOCK
// ------------------------------------------------------------
async function getStock() {
  const products = await getProducts();

  if (isSupabaseActive()) {
    try {
      const { data, error } = await supabase.from('stock').select('*');
      if (!error && Array.isArray(data) && data.length > 0) {
        const stockMap = {};
        for (const row of data) {
          if (!stockMap[row.product_id]) stockMap[row.product_id] = {};
          stockMap[row.product_id][row.size] = Number(row.quantity) || 0;
        }
        return normalizeStock(stockMap, products);
      }
    } catch (err) {
      console.warn('[Supabase] Exception getStock :', err.message);
    }
  }

  // Fallback local
  try {
    if (!fs.existsSync(STOCK_FILE)) {
      const initial = createDefaultStock(5, products);
      writeLocalJson(STOCK_FILE, initial);
      return initial;
    }
    const raw = fs.readFileSync(STOCK_FILE, 'utf8');
    return normalizeStock(raw ? JSON.parse(raw) : null, products);
  } catch {
    return createDefaultStock(5, products);
  }
}

async function saveStock(stock) {
  const products = await getProducts();
  const normalized = normalizeStock(stock, products);

  // 1. Sauvegarde locale
  writeLocalJson(STOCK_FILE, normalized);

  // 2. Sauvegarde Supabase
  if (isSupabaseActive()) {
    try {
      const rows = [];
      for (const [productId, sizes] of Object.entries(normalized)) {
        for (const [size, qty] of Object.entries(sizes)) {
          rows.push({
            product_id: productId,
            size,
            quantity: Number(qty) || 0,
            updated_at: new Date().toISOString()
          });
        }
      }
      if (rows.length > 0) {
        const { error } = await supabase.from('stock').upsert(rows, { onConflict: 'product_id,size' });
        if (error) console.error('[Supabase] Erreur upsert stock :', error.message);
      }
    } catch (err) {
      console.error('[Supabase] Exception upsert stock :', err.message);
    }
  }

  return normalized;
}

// ------------------------------------------------------------
// PRODUITS (PRODUCTS)
// ------------------------------------------------------------
async function getProducts() {
  if (isSupabaseActive()) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('id', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map((row) => {
          const defaultProd = DEFAULT_PRODUCTS.find((p) => p.id === row.id) || {};
          const cat = row.category === 'gants' ? 'gants' : 'rashguard';
          const sizes = Array.isArray(row.sizes) && row.sizes.length
            ? row.sizes
            : (defaultProd.sizes || (cat === 'gants' ? ['S/M', 'L/XL'] : ['XS', 'S', 'M', 'L', 'XL', 'XXL']));
          return {
            id: row.id,
            name: row.name || defaultProd.name || (cat === 'gants' ? 'Gants MMA / Grappling' : 'Rashguard Officiel'),
            category: cat,
            categoryLabel: cat === 'gants' ? 'Gants MMA' : 'Rashguard',
            price: Number(row.price) || defaultProd.price || (cat === 'gants' ? 50 : 40),
            image: row.image || defaultProd.image || (cat === 'gants' ? 'assets/gants-mma.jpg' : 'assets/rashguard-luta-livre.jpg'),
            description: row.description || defaultProd.shortDesc || defaultProd.description || '',
            shortDesc: row.description || defaultProd.shortDesc || (cat === 'gants' ? 'Gants officiels sparring & grappling.' : 'Tenue de compression officielle.'),
            badge: row.badge || defaultProd.badge || (cat === 'gants' ? 'Équipement Pro' : 'Édition Club'),
            sizeLabel: 'Taille',
            sizes,
            defaultSize: defaultProd.defaultSize || sizes[0],
            specs: defaultProd.specs || (cat === 'gants'
              ? [
                  'Paume ouverte et pouce articulé pour saisies et soumissions',
                  'Rembourrage mousse haute densité préformé sur les métacarpes',
                  'Fermeture poignet par large bande velcro renforcée'
                ]
              : [
                  'Tissu compression 4-way stretch respirant et ultra-résistant',
                  'Impression intégrale par sublimation inaltérable (face, dos, manches)',
                  'Coutures plates renforcées anti-frottements pour le combat'
                ])
          };
        });
      }
    } catch (err) {
      console.warn('[Supabase] Exception getProducts :', err.message);
    }
  }

  // Fallback local
  const local = readLocalJson(PRODUCTS_FILE, null);
  if (local && Array.isArray(local) && local.length > 0) return local;
  return DEFAULT_PRODUCTS;
}

async function saveProducts(products) {
  writeLocalJson(PRODUCTS_FILE, products);

  if (isSupabaseActive()) {
    try {
      const rows = products.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        price: Number(p.price),
        image: p.image,
        description: p.description || '',
        badge: p.badge || '',
        sizes: p.sizes,
        is_active: true
      }));
      const { error } = await supabase.from('products').upsert(rows);
      if (error) console.error('[Supabase] Erreur upsert products :', error.message);
    } catch (err) {
      console.error('[Supabase] Exception upsert products :', err.message);
    }
  }

  return products;
}

module.exports = {
  isSupabaseConfigured: isSupabaseActive,
  getUsers,
  findUserByEmail,
  findUserById,
  saveUser,
  updateUserProfile,
  getAllOrders,
  getOrdersForMember,
  saveOrder,
  getStock,
  saveStock,
  getProducts,
  saveProducts
};
