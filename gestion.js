(() => {
  'use strict';

  const {
    DEFAULT_SETTINGS,
    PRODUCTS: DEFAULT_PRODUCTS,
    createDefaultStock,
    normalizeStock,
  } = window.CLUB_CATALOG;

  const STORAGE_KEYS = {
    PRODUCTS: 'club_shop_products_v1',
    STOCK: 'club_shop_stock_v1',
    SETTINGS: 'club_shop_settings_v1',
    ORDERS: 'club_shop_orders_v1',
    LOCAL_PWD: 'club_shop_local_pwd_v1',
  };

  const initialProducts = loadJson(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS);

  const state = {
    authenticated: false,
    products: Array.isArray(initialProducts) ? initialProducts : DEFAULT_PRODUCTS,
    stock: loadStockLocal(
      Array.isArray(initialProducts) ? initialProducts : DEFAULT_PRODUCTS,
    ),
    orders: loadJson(STORAGE_KEYS.ORDERS, []),
    members: [],
    settings: { ...DEFAULT_SETTINGS, ...loadJson(STORAGE_KEYS.SETTINGS, {}) },
    pendingImageDataUrl: null,
  };

  const els = {
    clubName: document.getElementById('gestion-club-name'),
    authGate: document.getElementById('gestion-auth-gate'),
    authForm: document.getElementById('auth-form'),
    authPassword: document.getElementById('auth-password'),
    authError: document.getElementById('auth-error'),
    authSubmitBtn: document.getElementById('auth-submit-btn'),
    togglePasswordBtn: document.getElementById('toggle-password-btn'),
    gestionMain: document.getElementById('gestion-main'),
    lockBtn: document.getElementById('lock-gestion-btn'),
    statTotalStock: document.getElementById('stat-total-stock'),
    statOutOfStock: document.getElementById('stat-out-of-stock'),
    statOrdersCount: document.getElementById('stat-orders-count'),
    stockSyncBadge: document.getElementById('stock-sync-badge'),
    stockCardsGrid: document.getElementById('stock-cards-grid'),
    addProductForm: document.getElementById('add-product-form'),
    newProdName: document.getElementById('new-prod-name'),
    newProdCategory: document.getElementById('new-prod-category'),
    newProdPrice: document.getElementById('new-prod-price'),
    newProdStock: document.getElementById('new-prod-stock'),
    newProdSizes: document.getElementById('new-prod-sizes'),
    newProdDesc: document.getElementById('new-prod-desc'),
    newProdImage: document.getElementById('new-prod-image'),
    newProdPreviewImg: document.getElementById('new-prod-preview-img'),
    addProdSubmitBtn: document.getElementById('add-prod-submit-btn'),
    sizePresetsRow: document.getElementById('size-presets-row'),
    ordersList: document.getElementById('gestion-orders-list'),
    membersList: document.getElementById('gestion-members-list'),
    membersBadge: document.getElementById('gestion-members-badge'),
    exportCsvBtn: document.getElementById('gestion-export-csv'),
    clearOrdersBtn: document.getElementById('gestion-clear-orders'),
    settingsForm: document.getElementById('gestion-settings-form'),
    gClubName: document.getElementById('g-club-name'),
    gWhatsapp: document.getElementById('g-whatsapp'),
    gEmail: document.getElementById('g-email'),
    gFooterNote: document.getElementById('g-footer-note'),
    gSaveFeedback: document.getElementById('g-save-feedback'),
    passwordForm: document.getElementById('gestion-password-form'),
    pwdCurrent: document.getElementById('pwd-current'),
    pwdNext: document.getElementById('pwd-next'),
    pwdFeedback: document.getElementById('pwd-feedback'),
    toast: document.getElementById('toast'),
  };

  let toastTimer = null;
  let stockUpdateBusy = false;

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : fallback;
      if (Array.isArray(fallback)) return Array.isArray(parsed) ? parsed : fallback;
      if (fallback && typeof fallback === 'object')
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? parsed
          : fallback;
      return parsed;
    } catch {
      return fallback;
    }
  }

  function saveJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage quota errors
    }
  }

  function loadStockLocal(products) {
    const saved = loadJson(STORAGE_KEYS.STOCK, null);
    return saved ? normalizeStock(saved, products) : createDefaultStock(5, products);
  }

  function formatEuro(amount) {
    return `${Number(amount).toFixed(2).replace('.', ',')} €`;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.setAttribute('aria-hidden', 'false');
    els.toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.classList.remove('is-visible');
      els.toast.setAttribute('aria-hidden', 'true');
    }, 2200);
  }

  function setSyncLabel(text) {
    els.stockSyncBadge.textContent = text;
  }

  function showAuthGate() {
    state.authenticated = false;
    els.authGate.hidden = false;
    els.gestionMain.hidden = true;
    els.lockBtn.hidden = true;
    els.authPassword.value = '';
    els.authPassword.focus();
  }

  async function unlockDashboard() {
    state.authenticated = true;
    els.authGate.hidden = true;
    els.gestionMain.hidden = false;
    els.lockBtn.hidden = false;
    els.authError.hidden = true;
    await syncFromServer();
    await fetchAndRenderMembers();
    renderStats();
    renderStockCards();
    renderOrders();
  }

  async function checkExistingSession() {
    if (!window.location.protocol.startsWith('http')) {
      return;
    }
    try {
      const res = await fetch('/api/admin/session');
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated) {
          await unlockDashboard();
        }
      }
    } catch {
      // Stay locked until user enters password
    }
  }

  async function syncFromServer() {
    if (!window.location.protocol.startsWith('http')) {
      setSyncLabel('Mode local');
      return;
    }
    try {
      const [prodRes, stockRes, ordersRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/stock'),
        fetch('/api/orders'),
      ]);
      if (ordersRes.status === 401) {
        showAuthGate();
        return;
      }
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        if (Array.isArray(prodData.products)) {
          state.products = prodData.products;
          saveJson(STORAGE_KEYS.PRODUCTS, state.products);
        }
      }
      if (stockRes.ok) {
        const stockData = await stockRes.json();
        if (stockData.stock) {
          state.stock = normalizeStock(stockData.stock, state.products);
          saveJson(STORAGE_KEYS.STOCK, state.stock);
        }
      }
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        if (Array.isArray(ordersData.orders)) {
          state.orders = ordersData.orders;
          saveJson(STORAGE_KEYS.ORDERS, state.orders);
        }
      }
      setSyncLabel(
        prodRes.ok && stockRes.ok && ordersRes.ok
          ? 'Synchronisé avec le serveur'
          : 'Synchronisation incomplète',
      );
    } catch {
      setSyncLabel('Mode local');
    }
  }

  async function persistStockUpdate(productId, size, nextQty) {
    const cleanQty = Math.max(0, Math.floor(Number(nextQty) || 0));
    if (!state.stock[productId] || stockUpdateBusy) return;

    if (window.location.protocol.startsWith('http')) {
      setSyncLabel('Enregistrement...');
      stockUpdateBusy = true;
      els.stockCardsGrid.querySelectorAll('button,input').forEach((el) => {
        el.disabled = true;
      });
      try {
        const res = await fetch('/api/stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId, size, qty: cleanQty }),
        });
        if (res.status === 401) {
          showAuthGate();
          showToast('Session expirée, reconnectez-vous.');
          return;
        }
        const data = await res.json();
        if (!res.ok || !data.stock)
          throw new Error(data.error || 'Le stock n’a pas été enregistré.');
        state.stock = normalizeStock(data.stock, state.products);
        saveJson(STORAGE_KEYS.STOCK, state.stock);
        setSyncLabel('Enregistré');
      } catch {
        setSyncLabel('Échec de l’enregistrement');
        showToast('Le stock n’a pas été modifié. Réessayez.');
      } finally {
        stockUpdateBusy = false;
        renderStats();
        renderStockCards();
      }
      return;
    }
    state.stock[productId][size] = cleanQty;
    saveJson(STORAGE_KEYS.STOCK, state.stock);
    renderStats();
    renderStockCards();
    setSyncLabel('Enregistré (local)');
  }

  async function handleAddProduct(event) {
    event.preventDefault();
    const name = els.newProdName.value.trim();
    const category = els.newProdCategory.value;
    const price = Number(els.newProdPrice.value);
    const initialStock = Math.max(0, Math.floor(Number(els.newProdStock.value || 0)));
    const sizes = els.newProdSizes.value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const shortDesc = els.newProdDesc.value.trim();

    if (!name || !Number.isFinite(price) || price <= 0 || sizes.length === 0) {
      showToast('Renseignez un nom, un prix et au moins une taille.');
      return;
    }

    els.addProdSubmitBtn.disabled = true;

    if (window.location.protocol.startsWith('http')) {
      try {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            category,
            price,
            sizes,
            initialStock,
            shortDesc,
            imageDataUrl: state.pendingImageDataUrl,
          }),
        });
        if (res.status === 401) {
          els.addProdSubmitBtn.disabled = false;
          showAuthGate();
          return;
        }
        const data = await res.json();
        els.addProdSubmitBtn.disabled = false;
        if (!res.ok) {
          showToast(data.error || "Erreur lors de l'ajout.");
          return;
        }
        state.products = data.products;
        state.stock = normalizeStock(data.stock, state.products);
        saveJson(STORAGE_KEYS.PRODUCTS, state.products);
        saveJson(STORAGE_KEYS.STOCK, state.stock);
        resetAddProductForm();
        renderStats();
        renderStockCards();
        showToast(`${name} ajouté à la boutique`);
        return;
      } catch {
        els.addProdSubmitBtn.disabled = false;
        showToast('Produit non enregistré. Vérifiez la connexion et réessayez.');
        return;
      }
    }

    els.addProdSubmitBtn.disabled = false;
    const id = `prod-${Date.now()}`;
    const newProduct = {
      id,
      category,
      categoryLabel: category === 'gants' ? 'Gants MMA' : 'Rashguard',
      name,
      price,
      image: state.pendingImageDataUrl || 'assets/logo.jpg',
      shortDesc: shortDesc || 'Équipement officiel DORAGON DOJO CLUB.',
      sizeLabel: 'Taille',
      sizes,
      defaultSize: sizes[0],
      specs: [shortDesc || 'Équipement officiel du club'],
    };
    state.products.push(newProduct);
    state.stock[id] = Object.fromEntries(sizes.map((s) => [s, initialStock]));
    saveJson(STORAGE_KEYS.PRODUCTS, state.products);
    saveJson(STORAGE_KEYS.STOCK, state.stock);
    resetAddProductForm();
    renderStats();
    renderStockCards();
    showToast(`${name} ajouté à la boutique`);
  }

  function resetAddProductForm() {
    els.addProductForm.reset();
    els.newProdSizes.value = 'XS, S, M, L, XL, XXL';
    els.newProdStock.value = '5';
    state.pendingImageDataUrl = null;
    els.newProdPreviewImg.src = 'assets/logo.jpg';
  }

  async function deleteProduct(productId) {
    const target = state.products.find((p) => p.id === productId);
    if (!target) return;

    if (window.location.protocol.startsWith('http')) {
      try {
        const res = await fetch('/api/products/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: productId }),
        });
        if (res.status === 401) {
          showAuthGate();
          return;
        }
        if (res.ok) {
          const data = await res.json();
          state.products = data.products;
          state.stock = normalizeStock(data.stock, state.products);
          saveJson(STORAGE_KEYS.PRODUCTS, state.products);
          saveJson(STORAGE_KEYS.STOCK, state.stock);
          renderStats();
          renderStockCards();
          showToast(`${target.name} retiré de la boutique`);
          return;
        }
        throw new Error('Suppression refusée');
      } catch {
        showToast('Produit non supprimé. Réessayez.');
        return;
      }
    }

    state.products = state.products.filter((p) => p.id !== productId);
    delete state.stock[productId];
    saveJson(STORAGE_KEYS.PRODUCTS, state.products);
    saveJson(STORAGE_KEYS.STOCK, state.stock);
    renderStats();
    renderStockCards();
    showToast(`${target.name} retiré`);
  }

  function getStockStatus(qty) {
    if (qty <= 0) return { label: 'Rupture', cls: 'is-out' };
    if (qty <= 2) return { label: 'Faible', cls: 'is-low' };
    return { label: 'En stock', cls: 'is-ok' };
  }

  function renderStats() {
    let totalUnits = 0;
    let outCount = 0;

    state.products.forEach((product) => {
      (product.sizes || []).forEach((size) => {
        const qty = Number(state.stock[product.id]?.[size] || 0);
        totalUnits += qty;
        if (qty <= 0) outCount += 1;
      });
    });

    els.statTotalStock.textContent = String(totalUnits);
    els.statOutOfStock.textContent = String(outCount);
    els.statOrdersCount.textContent = String(state.orders.length);
  }

  function renderStockCards() {
    if (state.products.length === 0) {
      els.stockCardsGrid.innerHTML =
        '<p style="color:var(--ink-muted);margin:0;">Aucun article dans la boutique. Utilisez le formulaire ci-dessus pour en ajouter un.</p>';
      return;
    }

    els.stockCardsGrid.innerHTML = state.products
      .map((product) => {
        const productStock = state.stock[product.id] || {};
        const productTotal = (product.sizes || []).reduce(
          (sum, s) => sum + (Number(productStock[s]) || 0),
          0,
        );

        const rowsHtml = (product.sizes || [])
          .map((size) => {
            const qty = Number(productStock[size] || 0);
            const status = getStockStatus(qty);
            return `
          <div class="stock-size-row">
            <div class="stock-size-info">
              <span class="stock-size-tag">${escapeHtml(size)}</span>
              <span class="stock-status-pill ${status.cls}">${status.label}</span>
            </div>
            <div class="stock-controls">
              <button
                type="button"
                class="stock-btn"
                data-action="dec"
                data-product-id="${product.id}"
                data-size="${escapeHtml(size)}"
                aria-label="Retirer 1 en taille ${escapeHtml(size)}"
                ${qty <= 0 ? 'disabled' : ''}
              >−</button>
              <input
                type="number"
                min="0"
                step="1"
                class="stock-qty-input"
                value="${qty}"
                data-action="set"
                data-product-id="${product.id}"
                data-size="${escapeHtml(size)}"
                aria-label="Stock taille ${escapeHtml(size)}"
              />
              <button
                type="button"
                class="stock-btn stock-btn-plus"
                data-action="inc"
                data-product-id="${product.id}"
                data-size="${escapeHtml(size)}"
                aria-label="Ajouter 1 en taille ${escapeHtml(size)}"
              >+</button>
            </div>
          </div>
        `;
          })
          .join('');

        return `
        <article class="stock-card">
          <div class="stock-card-head">
            <img src="${product.image}" alt="${escapeHtml(product.name)}" class="stock-card-img" />
            <div class="stock-card-meta">
              <h3>${escapeHtml(product.name)}</h3>
              <span class="stock-card-sub">${formatEuro(product.price)} · Total : <strong>${productTotal}</strong></span>
            </div>
            <button
              type="button"
              class="stock-delete-btn"
              data-action="delete-product"
              data-product-id="${product.id}"
              title="Retirer de la boutique"
              aria-label="Retirer ${escapeHtml(product.name)} de la boutique"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </button>
          </div>
          <div class="stock-size-list">
            ${rowsHtml}
          </div>
        </article>
      `;
      })
      .join('');
  }

  function renderOrders() {
    if (state.orders.length === 0) {
      els.ordersList.innerHTML =
        '<p style="color:var(--ink-muted);font-size:0.9rem;margin:0;">Aucune commande enregistrée pour le moment.</p>';
      return;
    }

    els.ordersList.innerHTML = state.orders
      .map(
        (order) => `
      <div class="admin-order-row">
        <div class="admin-order-top">
          <span>${escapeHtml(order.ref)} — ${escapeHtml(order.memberName)}</span>
          <span>${formatEuro(order.total)}</span>
        </div>
        <div style="color:var(--ink-secondary);margin-bottom:0.25rem;">
          ${escapeHtml(order.dateLabel)} · ${escapeHtml(order.memberEmail || order.memberContact || '')}${order.memberPhone ? ' · ' + escapeHtml(order.memberPhone) : ''} · ${escapeHtml(order.paymentMethod)}
        </div>
        <div>
          ${order.items.map((i) => `${i.qty}× ${escapeHtml(i.name)} (${escapeHtml(i.size)})`).join(' · ')}
        </div>
      </div>
    `,
      )
      .join('');
  }

  async function fetchAndRenderMembers() {
    if (!window.location.protocol.startsWith('http')) {
      renderMembers();
      return;
    }
    try {
      const res = await fetch('/api/admin/members');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.members)) {
          state.members = data.members;
        }
      }
    } catch {
      // ignore
    }
    renderMembers();
  }

  function renderMembers() {
    if (!els.membersList) return;
    const count = (state.members || []).length;
    if (els.membersBadge) {
      els.membersBadge.textContent = `${count} adhérent${count > 1 ? 's' : ''}`;
    }
    if (count === 0) {
      els.membersList.innerHTML =
        '<p style="color:var(--ink-muted);font-size:0.9rem;margin:0;">Aucun compte adhérent créé pour le moment.</p>';
      return;
    }
    els.membersList.innerHTML = state.members
      .map(
        (m) => `
      <div class="admin-order-row">
        <div class="admin-order-top">
          <span><strong>${escapeHtml(m.name)}</strong> (${escapeHtml(m.email)})</span>
          <span><strong>${m.ordersCount || 0} commande${(m.ordersCount || 0) > 1 ? 's' : ''}</strong> · ${formatEuro(m.totalSpent || 0)}</span>
        </div>
        <div style="color:var(--ink-secondary);font-size:0.85rem;margin-top:0.25rem;">
          ${m.phone ? `Tél : <strong>${escapeHtml(m.phone)}</strong> · ` : ''}
          Rashguard : <strong>${escapeHtml(m.favoriteRashguardSize || 'N/A')}</strong> · 
          Gants : <strong>${escapeHtml(m.favoriteGlovesSize || 'N/A')}</strong>
          ${m.createdAt ? ` · Inscrit le ${new Date(m.createdAt).toLocaleDateString('fr-FR')}` : ''}
        </div>
      </div>
    `,
      )
      .join('');
  }

  function exportOrdersCsv() {
    if (state.orders.length === 0) {
      showToast('Aucune commande à exporter.');
      return;
    }
    const headers = [
      'Reference',
      'Date',
      'Adherent',
      'Email',
      'Telephone',
      'Reglement',
      'Articles',
      'Total_EUR',
      'Remarque',
    ];
    const rows = state.orders.map((o) =>
      [
        o.ref,
        o.dateLabel,
        o.memberName,
        o.memberEmail || o.memberContact || '',
        o.memberPhone || '',
        o.paymentMethod,
        o.items.map((i) => `${i.qty}x ${i.name} (${i.size})`).join(' | '),
        Number(o.total).toFixed(2),
        o.memberNote || '',
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(';'),
    );

    const csv = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `commandes-club-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function populateSettingsForm() {
    els.clubName.textContent = state.settings.clubName;
    els.gClubName.value = state.settings.clubName;
    els.gWhatsapp.value = state.settings.whatsapp;
    els.gEmail.value = state.settings.email;
    els.gFooterNote.value = state.settings.footerNote;
  }

  function bindEvents() {
    els.togglePasswordBtn.addEventListener('click', () => {
      const isHidden = els.authPassword.type === 'password';
      els.authPassword.type = isHidden ? 'text' : 'password';
    });

    els.authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = els.authPassword.value;
      els.authError.hidden = true;
      els.authSubmitBtn.disabled = true;
      els.authSubmitBtn.textContent = 'Vérification...';

      if (window.location.protocol.startsWith('http')) {
        try {
          const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
          });
          els.authSubmitBtn.disabled = false;
          els.authSubmitBtn.textContent = 'Déverrouiller';
          if (res.ok) {
            await unlockDashboard();
            return;
          }
          const data = await res.json().catch(() => ({}));
          els.authError.textContent = data.error || 'Mot de passe incorrect.';
          els.authError.hidden = false;
          els.authPassword.select();
          return;
        } catch {
          els.authSubmitBtn.disabled = false;
          els.authSubmitBtn.textContent = 'Déverrouiller';
          els.authError.textContent = 'Connexion au serveur impossible. Réessayez.';
          els.authError.hidden = false;
          return;
        }
      }

      els.authSubmitBtn.disabled = false;
      els.authSubmitBtn.textContent = 'Déverrouiller';
      const localPwd = localStorage.getItem(STORAGE_KEYS.LOCAL_PWD) || 'doragon2026';
      if (password === localPwd) {
        await unlockDashboard();
      } else {
        els.authError.textContent = 'Mot de passe incorrect.';
        els.authError.hidden = false;
      }
    });

    els.lockBtn.addEventListener('click', async () => {
      if (window.location.protocol.startsWith('http')) {
        try {
          await fetch('/api/admin/logout', { method: 'POST' });
        } catch {
          // Ignore
        }
      }
      showAuthGate();
      showToast('Gestion verrouillée');
    });

    els.sizePresetsRow.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-preset]');
      if (!btn) return;
      els.newProdSizes.value = btn.dataset.preset;
    });

    els.newProdImage.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        state.pendingImageDataUrl = String(reader.result || '');
        els.newProdPreviewImg.src = state.pendingImageDataUrl;
      };
      reader.readAsDataURL(file);
    });

    els.addProductForm.addEventListener('submit', handleAddProduct);

    els.stockCardsGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const { action, productId, size } = btn.dataset;
      if (action === 'delete-product') {
        deleteProduct(productId);
        return;
      }
      const current = Number(state.stock[productId]?.[size] || 0);
      if (action === 'inc') {
        persistStockUpdate(productId, size, current + 1);
      } else if (action === 'dec') {
        persistStockUpdate(productId, size, Math.max(0, current - 1));
      }
    });

    els.stockCardsGrid.addEventListener('change', (e) => {
      const input = e.target.closest('input[data-action="set"]');
      if (!input) return;
      const { productId, size } = input.dataset;
      const val = Math.max(0, Math.floor(Number(input.value) || 0));
      persistStockUpdate(productId, size, val);
    });

    els.exportCsvBtn.addEventListener('click', exportOrdersCsv);

    els.clearOrdersBtn.addEventListener('click', async () => {
      if (state.orders.length === 0) return;
      if (window.location.protocol.startsWith('http')) {
        try {
          const res = await fetch('/api/orders', { method: 'DELETE' });
          if (res.status === 401) {
            showAuthGate();
            return;
          }
          if (!res.ok) throw new Error('Suppression refusée');
        } catch {
          showToast('Historique non modifié. Réessayez.');
          return;
        }
      }
      state.orders = [];
      saveJson(STORAGE_KEYS.ORDERS, []);
      renderStats();
      renderOrders();
      showToast('Historique vidé');
    });

    els.settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      state.settings = {
        clubName: els.gClubName.value.trim() || DEFAULT_SETTINGS.clubName,
        whatsapp: els.gWhatsapp.value.trim(),
        email: els.gEmail.value.trim() || DEFAULT_SETTINGS.email,
        footerNote: els.gFooterNote.value.trim() || DEFAULT_SETTINGS.footerNote,
      };
      saveJson(STORAGE_KEYS.SETTINGS, state.settings);
      els.clubName.textContent = state.settings.clubName;
      els.gSaveFeedback.hidden = false;
      showToast('Coordonnées enregistrées');
    });

    els.passwordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentPassword = els.pwdCurrent.value;
      const newPassword = els.pwdNext.value;

      if (window.location.protocol.startsWith('http')) {
        try {
          const res = await fetch('/api/admin/password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            showToast(data.error || 'Impossible de modifier le mot de passe.');
            return;
          }
          els.passwordForm.reset();
          els.pwdFeedback.hidden = false;
          showToast('Mot de passe mis à jour');
          return;
        } catch {
          showToast('Mot de passe non modifié. Vérifiez la connexion et réessayez.');
          return;
        }
      }

      const localPwd = localStorage.getItem(STORAGE_KEYS.LOCAL_PWD) || 'doragon2026';
      if (currentPassword !== localPwd) {
        showToast('Mot de passe actuel incorrect.');
        return;
      }
      localStorage.setItem(STORAGE_KEYS.LOCAL_PWD, newPassword);
      els.passwordForm.reset();
      els.pwdFeedback.hidden = false;
      showToast('Mot de passe mis à jour');
    });
  }

  async function init() {
    populateSettingsForm();
    bindEvents();
    await checkExistingSession();
  }

  init();
})();
