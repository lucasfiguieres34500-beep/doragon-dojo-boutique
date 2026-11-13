// ============================================================
// DORAGON DOJO CLUB — SCRIPT DE MIGRATION VERS SUPABASE
// Exécuter : node seed-supabase.js
// Permet d'injecter automatiquement les données locales existantes
// (comptes adhérents, commandes, stock, produits) dans Supabase.
// ============================================================

const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const { PRODUCTS: DEFAULT_PRODUCTS } = require('./catalog.js');

// Charger les variables .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const k = trimmed.slice(0, eq).trim();
      const v = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!(k in process.env)) process.env[k] = v;
    }
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ ERREUR : SUPABASE_URL et SUPABASE_KEY doivent être définis dans .env ou en variables d’environnement.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function seed() {
  console.log('🚀 Début de la synchronisation vers Supabase...');

  // 1. Produits
  const productsFile = path.join(__dirname, 'data', 'products.json');
  let products = DEFAULT_PRODUCTS;
  if (fs.existsSync(productsFile)) {
    try { products = JSON.parse(fs.readFileSync(productsFile, 'utf8')); } catch {}
  }
  const productRows = products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    price: Number(p.price),
    image: p.image,
    description: p.description || p.shortDesc || '',
    badge: p.badge || '',
    sizes: p.sizes,
    is_active: true
  }));
  const { error: errProd } = await supabase.from('products').upsert(productRows);
  if (errProd) {
    console.error('❌ Erreur injection produits :', errProd.message);
  } else {
    console.log(`✅ ${productRows.length} produits synchronisés avec succès.`);
  }

  // 2. Stock
  const stockFile = path.join(__dirname, 'data', 'stock.json');
  if (fs.existsSync(stockFile)) {
    try {
      const stockData = JSON.parse(fs.readFileSync(stockFile, 'utf8'));
      const stockRows = [];
      for (const [productId, sizes] of Object.entries(stockData)) {
        for (const [size, qty] of Object.entries(sizes)) {
          stockRows.push({
            product_id: productId,
            size,
            quantity: Number(qty) || 0,
            updated_at: new Date().toISOString()
          });
        }
      }
      if (stockRows.length > 0) {
        const { error: errStock } = await supabase.from('stock').upsert(stockRows, { onConflict: 'product_id,size' });
        if (errStock) console.error('❌ Erreur injection stock :', errStock.message);
        else console.log(`✅ ${stockRows.length} lignes de stock synchronisées avec succès.`);
      }
    } catch (e) {
      console.warn('⚠️ Stock non synchronisé :', e.message);
    }
  }

  // 3. Adhérents (Users)
  const usersFile = path.join(__dirname, 'data', 'users.json');
  if (fs.existsSync(usersFile)) {
    try {
      const usersData = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
      const memberRows = usersData.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email.toLowerCase(),
        phone: u.phone || '',
        favorite_rashguard_size: u.favoriteRashguardSize || 'M',
        favorite_gloves_size: u.favoriteGlovesSize || 'L/XL',
        salt: u.salt,
        hash: u.hash,
        created_at: u.createdAt || new Date().toISOString()
      }));
      if (memberRows.length > 0) {
        const { error: errMembers } = await supabase.from('members').upsert(memberRows);
        if (errMembers) console.error('❌ Erreur injection adhérents :', errMembers.message);
        else console.log(`✅ ${memberRows.length} adhérents synchronisés avec succès.`);
      }
    } catch (e) {
      console.warn('⚠️ Adhérents non synchronisés :', e.message);
    }
  }

  // 4. Commandes (Orders)
  const ordersFile = path.join(__dirname, 'data', 'orders.json');
  if (fs.existsSync(ordersFile)) {
    try {
      const ordersData = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
      const orderRows = ordersData.map((o) => ({
        ref: o.ref,
        member_id: o.memberId || null,
        created_at: o.createdAt || new Date().toISOString(),
        date_label: o.dateLabel,
        member_name: o.memberName,
        member_email: o.memberEmail,
        member_phone: o.memberPhone || '',
        payment_method: o.paymentMethod,
        payment_status: o.paymentStatus,
        member_note: o.memberNote || '',
        total: Number(o.total) || 0,
        items: o.items
      }));
      if (orderRows.length > 0) {
        const { error: errOrders } = await supabase.from('orders').upsert(orderRows);
        if (errOrders) console.error('❌ Erreur injection commandes :', errOrders.message);
        else console.log(`✅ ${orderRows.length} commandes synchronisées avec succès.`);
      }
    } catch (e) {
      console.warn('⚠️ Commandes non synchronisées :', e.message);
    }
  }

  console.log('🎉 Synchronisation terminée !');
}

seed().catch((err) => console.error('Erreur critique :', err));
