(() => {
  'use strict';

  const { DEFAULT_SETTINGS, PRODUCTS: DEFAULT_PRODUCTS, createDefaultStock, normalizeStock } = window.CLUB_CATALOG;

  const STORAGE_KEYS = {
    CART: 'club_shop_cart_v1',
    PRODUCTS: 'club_shop_products_v1',
    STOCK: 'club_shop_stock_v1',
    SETTINGS: 'club_shop_settings_v1',
    ORDERS: 'club_shop_orders_v1'
  };

  const CATEGORY_TITLES = {
    rashguard: 'Rashguards',
    gants: 'Gants MMA',
    all: 'Tout l\'équipement'
  };

  const initialProducts = loadJson(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS);

  const state = {
    view: 'landing',
    filter: 'all',
    products: Array.isArray(initialProducts) && initialProducts.length ? initialProducts : DEFAULT_PRODUCTS,
    selectedSizes: Object.fromEntries((Array.isArray(initialProducts) ? initialProducts : DEFAULT_PRODUCTS).map((p) => [p.id, p.defaultSize || (p.sizes && p.sizes[0]) || 'M'])),
    stock: normalizeStock(loadJson(STORAGE_KEYS.STOCK, createDefaultStock(5, initialProducts)), initialProducts),
    cart: loadJson(STORAGE_KEYS.CART, []),
    settings: { ...DEFAULT_SETTINGS, ...loadJson(STORAGE_KEYS.SETTINGS, {}) },
    orders: loadJson(STORAGE_KEYS.ORDERS, []),
    lastOrder: null
  };

  const els = {
    landingView: document.getElementById('landing-view'),
    shopView: document.getElementById('shop-view'),
    siteHeader: document.querySelector('.site-header'),
    enterShopBtn: document.getElementById('enter-shop-btn'),
    brandHomeBtn: document.getElementById('brand-home-btn'),
    filterBtns: document.querySelectorAll('.segmented-btn[data-filter]'),
    productsGrid: document.getElementById('products-grid'),
    cartCount: document.getElementById('cart-count'),
    openCartBtn: document.getElementById('open-cart-btn'),
    closeCartBtn: document.getElementById('close-cart-btn'),
    cartBackdrop: document.getElementById('cart-backdrop'),
    cartDrawer: document.getElementById('cart-drawer'),
    drawerTitle: document.getElementById('drawer-title'),
    emptyCartState: document.getElementById('empty-cart-state'),
    cartFilledState: document.getElementById('cart-filled-state'),
    cartItemsList: document.getElementById('cart-items-list'),
    cartTotal: document.getElementById('cart-total'),
    browseFromEmptyBtn: document.getElementById('browse-from-empty-btn'),
    checkoutForm: document.getElementById('checkout-form'),
    submitOrderBtn: document.getElementById('submit-order-btn'),
    orderConfirmation: document.getElementById('order-confirmation'),
    confirmOrderRef: document.getElementById('confirm-order-ref'),
    emailStatusBanner: document.getElementById('email-status-banner'),
    confirmSummaryCard: document.getElementById('confirm-summary-card'),
    sendWhatsappBtn: document.getElementById('send-whatsapp-btn'),
    sendEmailBtn: document.getElementById('send-email-btn'),
    copyOrderBtn: document.getElementById('copy-order-btn'),
    printOrderBtn: document.getElementById('print-order-btn'),
    newOrderBtn: document.getElementById('new-order-btn'),
    productModalBackdrop: document.getElementById('product-modal-backdrop'),
    productModalContent: document.getElementById('product-modal-content'),
    closeProductModalBtn: document.getElementById('close-product-modal-btn'),
    toolbarSizeGuideBtn: document.getElementById('toolbar-size-guide-btn'),
    sizeGuideBackdrop: document.getElementById('size-guide-backdrop'),
    closeSizeGuideBtn: document.getElementById('close-size-guide-btn'),
    headerClubName: document.getElementById('header-club-name'),
    landingClubName: document.getElementById('landing-club-name'),
    footerClubName: document.getElementById('footer-club-name'),
    footerClubNote: document.getElementById('footer-club-note'),
    toast: document.getElementById('toast')
  };

  let toastTimer = null;

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
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

  function formatEuro(amount) {
    return `${amount.toFixed(2).replace('.', ',')} €`;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function showToast(message, meta = null) {
    if (meta && meta.image) {
      els.toast.innerHTML = `
        <div class="toast-glass-row">
          <img src="${meta.image}" alt="" class="toast-glass-thumb" />
          <div class="toast-glass-text">
            <strong>${escapeHtml(meta.title)}</strong>
            <span>${escapeHtml(meta.subtitle)}</span>
          </div>
          <span class="toast-glass-check">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
        </div>
      `;
    } else {
      els.toast.textContent = message;
    }
    els.toast.setAttribute('aria-hidden', 'false');
    els.toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.classList.remove('is-visible');
      els.toast.setAttribute('aria-hidden', 'true');
    }, 2600);
  }

  function applySettingsToUi() {
    els.headerClubName.textContent = state.settings.clubName;
    els.landingClubName.textContent = state.settings.clubName;
    els.footerClubName.textContent = state.settings.clubName;
    els.footerClubNote.textContent = state.settings.footerNote;
    document.title = `${state.settings.clubName} — Boutique Adhérents`;
  }

  let viewTransitionTimer = null;

  function enterShop(category = 'all') {
    clearTimeout(viewTransitionTimer);
    if (state.view === 'shop') {
      setFilter(category);
      return;
    }

    const revealShop = () => {
      state.view = 'shop';
      document.body.classList.remove('is-landing');
      els.landingView.classList.remove('is-leaving');
      els.landingView.hidden = true;
      els.shopView.hidden = false;
      els.shopView.classList.remove('is-entering');
      if (els.siteHeader) els.siteHeader.classList.remove('is-revealing');
      void els.shopView.offsetWidth;
      els.shopView.classList.add('is-entering');
      if (els.siteHeader) els.siteHeader.classList.add('is-revealing');
      setFilter(category);
      window.scrollTo({ top: 0, behavior: 'auto' });
    };

    if (prefersReducedMotion()) {
      revealShop();
      return;
    }

    els.landingView.classList.add('is-leaving');
    viewTransitionTimer = setTimeout(revealShop, 320);
  }

  function showLanding() {
    clearTimeout(viewTransitionTimer);
    state.view = 'landing';
    document.body.classList.add('is-landing');
    if (els.siteHeader) els.siteHeader.classList.remove('is-revealing');
    els.shopView.classList.remove('is-entering');
    els.shopView.hidden = true;
    els.landingView.classList.remove('is-leaving');
    els.landingView.hidden = false;
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }

  function setFilter(category) {
    state.filter = category;
    els.filterBtns.forEach((btn) => {
      const active = btn.dataset.filter === category;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    renderProducts();
  }

  function getAvailableStock(productId, size) {
    return Number(state.stock[productId]?.[size] ?? 0);
  }

  function ensureAvailableSelection(product) {
    const current = state.selectedSizes[product.id];
    if (getAvailableStock(product.id, current) > 0) return current;
    const firstAvailable = product.sizes.find((s) => getAvailableStock(product.id, s) > 0);
    if (firstAvailable) {
      state.selectedSizes[product.id] = firstAvailable;
      return firstAvailable;
    }
    return current;
  }

  function formatStockLabel(qty) {
    if (qty <= 0) return '<span class="stock-note is-out">Rupture</span>';
    if (qty <= 2) return `<span class="stock-note is-low">Plus que ${qty}</span>`;
    return `<span class="stock-note">Stock : ${qty}</span>`;
  }

  function renderProducts() {
    const filtered = state.filter === 'all'
      ? state.products
      : state.products.filter((p) => p.category === state.filter);

    els.productsGrid.classList.toggle('is-single', filtered.length === 1);

    els.productsGrid.innerHTML = filtered.map((product, index) => {
      const selectedSize = ensureAvailableSelection(product);
      const selectedStock = getAvailableStock(product.id, selectedSize);
      const sizeButtons = product.sizes.map((size) => {
        const qty = getAvailableStock(product.id, size);
        return `
          <button
            type="button"
            class="size-pill ${size === selectedSize ? 'is-selected' : ''} ${qty <= 0 ? 'is-out' : ''}"
            data-action="select-size"
            data-product-id="${product.id}"
            data-size="${escapeHtml(size)}"
          >${escapeHtml(size)}</button>
        `;
      }).join('');

      return `
        <article class="product-card" data-product-id="${product.id}" style="--card-index:${index};">
          <div class="product-media" data-action="open-details" data-product-id="${product.id}">
            <img src="${product.image}" alt="${escapeHtml(product.name)}" loading="lazy" />
            <span class="product-badge">${escapeHtml(product.categoryLabel)}</span>
          </div>
          <div class="product-body">
            <div class="product-top-row">
              <h3 class="product-title">${escapeHtml(product.name)}</h3>
              <span class="product-price">${formatEuro(product.price)}</span>
            </div>

            <div class="size-picker-label">
              <span>${escapeHtml(product.sizeLabel)} : <strong>${escapeHtml(selectedSize)}</strong></span>
              ${formatStockLabel(selectedStock)}
            </div>
            <div class="size-pills">${sizeButtons}</div>

            <div class="product-actions">
              <button
                type="button"
                class="btn btn-primary btn-add-cart"
                data-action="add-to-cart"
                data-product-id="${product.id}"
                ${selectedStock <= 0 ? 'disabled' : ''}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                  <path d="M3 6h18" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
                <span>${selectedStock <= 0 ? 'Rupture de stock' : 'Ajouter'}</span>
              </button>
              <button
                type="button"
                class="btn btn-secondary"
                data-action="open-details"
                data-product-id="${product.id}"
              >Détails</button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  function pulseCartButton() {
    els.cartCount.classList.remove('is-pop');
    els.openCartBtn.classList.remove('is-bumped');
    void els.cartCount.offsetWidth;
    els.cartCount.classList.add('is-pop');
    els.openCartBtn.classList.add('is-bumped');
  }

  function animateAddToCart(triggerBtn, product) {
    if (triggerBtn) {
      const originalHtml = triggerBtn.dataset.originalHtml || triggerBtn.innerHTML;
      triggerBtn.dataset.originalHtml = originalHtml;
      triggerBtn.classList.add('is-added');
      triggerBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
        </svg>
        <span>Ajouté</span>
      `;
      clearTimeout(triggerBtn._addedTimer);
      triggerBtn._addedTimer = setTimeout(() => {
        triggerBtn.classList.remove('is-added');
        triggerBtn.innerHTML = originalHtml;
      }, 950);
    }

    if (prefersReducedMotion()) {
      pulseCartButton();
      return;
    }

    const card = triggerBtn ? triggerBtn.closest('.product-card') : null;
    const sourceImg = card ? card.querySelector('.product-media img') : null;
    const cartRect = els.openCartBtn.getBoundingClientRect();

    if (!sourceImg || !cartRect.width) {
      pulseCartButton();
      return;
    }

    const srcRect = sourceImg.getBoundingClientRect();
    const orbSize = Math.min(86, Math.max(58, srcRect.width * 0.36));
    const startX = srcRect.left + srcRect.width / 2 - orbSize / 2;
    const startY = srcRect.top + srcRect.height / 2 - orbSize / 2;
    const endX = cartRect.left + cartRect.width / 2 - orbSize / 2;
    const endY = cartRect.top + cartRect.height / 2 - orbSize / 2;

    const orb = document.createElement('div');
    orb.className = 'flying-glass-orb';
    orb.style.left = `${startX}px`;
    orb.style.top = `${startY}px`;
    orb.style.width = `${orbSize}px`;
    orb.style.height = `${orbSize}px`;
    orb.style.transform = 'translate3d(0, 0, 0) scale(1)';
    orb.style.opacity = '1';

    const img = document.createElement('img');
    img.src = product.image;
    img.alt = '';
    orb.appendChild(img);
    document.body.appendChild(orb);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const dx = endX - startX;
        const dy = endY - startY;
        orb.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(0.26)`;
        orb.style.opacity = '0';
      });
    });

    setTimeout(() => {
      orb.remove();
      pulseCartButton();
    }, 540);
  }

  function addToCart(productId, customSize, triggerBtn) {
    const product = state.products.find((p) => p.id === productId);
    if (!product) return;
    const size = customSize || state.selectedSizes[productId] || product.defaultSize;
    const available = getAvailableStock(productId, size);

    const existing = state.cart.find((item) => item.productId === productId && item.size === size);
    const currentInCart = existing ? existing.qty : 0;

    if (available <= 0) {
      showToast(`Rupture de stock en taille ${size}.`);
      return;
    }

    if (currentInCart + 1 > available) {
      showToast(`Stock maximum atteint (${available} disponible${available > 1 ? 's' : ''}).`);
      return;
    }

    if (existing) {
      existing.qty += 1;
    } else {
      state.cart.push({ productId, size, qty: 1 });
    }
    saveJson(STORAGE_KEYS.CART, state.cart);
    renderCart();
    animateAddToCart(triggerBtn, product);
    showToast(`${product.name} (${size}) ajouté`, {
      image: product.image,
      title: product.name,
      subtitle: `${product.sizeLabel} ${size} · Ajouté au panier`
    });
  }

  function updateCartQty(productId, size, delta) {
    const item = state.cart.find((entry) => entry.productId === productId && entry.size === size);
    if (!item) return;
    if (delta > 0) {
      const available = getAvailableStock(productId, size);
      if (item.qty + delta > available) {
        showToast(`Stock maximum atteint (${available}).`);
        return;
      }
    }
    item.qty += delta;
    if (item.qty <= 0) {
      state.cart = state.cart.filter((entry) => !(entry.productId === productId && entry.size === size));
    }
    saveJson(STORAGE_KEYS.CART, state.cart);
    renderCart();
  }

  function removeCartItem(productId, size) {
    state.cart = state.cart.filter((entry) => !(entry.productId === productId && entry.size === size));
    saveJson(STORAGE_KEYS.CART, state.cart);
    renderCart();
  }

  function computeCartDetails() {
    let totalCount = 0;
    let totalPrice = 0;
    const lines = [];

    state.cart.forEach((entry) => {
      const product = state.products.find((p) => p.id === entry.productId);
      if (!product) return;
      totalCount += entry.qty;
      totalPrice += product.price * entry.qty;
      lines.push({
        product,
        size: entry.size,
        qty: entry.qty,
        lineTotal: product.price * entry.qty
      });
    });

    return { totalCount, totalPrice, lines };
  }

  function renderCart() {
    const { totalCount, totalPrice, lines } = computeCartDetails();
    els.cartCount.textContent = String(totalCount);

    if (state.lastOrder && lines.length === 0) {
      els.drawerTitle.textContent = 'Commande confirmée';
      els.emptyCartState.hidden = true;
      els.cartFilledState.hidden = true;
      els.orderConfirmation.hidden = false;
      return;
    }

    els.orderConfirmation.hidden = true;
    els.drawerTitle.textContent = `Panier (${totalCount})`;

    if (lines.length === 0) {
      els.emptyCartState.hidden = false;
      els.cartFilledState.hidden = true;
      return;
    }

    els.emptyCartState.hidden = true;
    els.cartFilledState.hidden = false;
    els.cartTotal.textContent = formatEuro(totalPrice);

    els.cartItemsList.innerHTML = lines.map(({ product, size, qty, lineTotal }) => `
      <li class="cart-item">
        <img src="${product.image}" alt="${escapeHtml(product.name)}" class="cart-item-img" />
        <div class="cart-item-info">
          <p class="cart-item-title">${escapeHtml(product.name)}</p>
          <div class="cart-item-meta">${escapeHtml(product.sizeLabel)} : <strong>${escapeHtml(size)}</strong></div>
          <div class="cart-item-controls">
            <div class="qty-stepper">
              <button type="button" data-action="qty-dec" data-product-id="${product.id}" data-size="${escapeHtml(size)}" aria-label="Diminuer">-</button>
              <span>${qty}</span>
              <button type="button" data-action="qty-inc" data-product-id="${product.id}" data-size="${escapeHtml(size)}" aria-label="Augmenter">+</button>
            </div>
            <span class="cart-item-price">${formatEuro(lineTotal)}</span>
            <button type="button" class="cart-remove-btn" data-action="remove-item" data-product-id="${product.id}" data-size="${escapeHtml(size)}">Retirer</button>
          </div>
        </div>
      </li>
    `).join('');
  }

  function openCartDrawer() {
    els.cartBackdrop.classList.add('is-open');
    els.cartDrawer.classList.add('is-open');
    els.cartBackdrop.setAttribute('aria-hidden', 'false');
    els.cartDrawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeCartDrawer() {
    els.cartBackdrop.classList.remove('is-open');
    els.cartDrawer.classList.remove('is-open');
    els.cartBackdrop.setAttribute('aria-hidden', 'true');
    els.cartDrawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function openProductModal(productId) {
    const product = state.products.find((p) => p.id === productId);
    if (!product) return;

    const selectedSize = ensureAvailableSelection(product);
    let modalSize = selectedSize;
    const modalStock = getAvailableStock(product.id, modalSize);

    const sizePills = product.sizes.map((size) => {
      const qty = getAvailableStock(product.id, size);
      return `
        <button
          type="button"
          class="size-pill ${size === selectedSize ? 'is-selected' : ''} ${qty <= 0 ? 'is-out' : ''}"
          data-modal-size="${escapeHtml(size)}"
        >${escapeHtml(size)}</button>
      `;
    }).join('');

    const photoTabs = product.backImage ? `
      <div class="modal-photo-tabs" id="modal-photo-tabs">
        <button type="button" class="viewer3d-pill is-active" data-photo-side="front">Face</button>
        <button type="button" class="viewer3d-pill" data-photo-side="back">Dos</button>
      </div>
    ` : '';

    els.productModalContent.innerHTML = `
      <div class="product-modal-grid">
        <div>
          <img src="${product.image}" alt="${escapeHtml(product.name)}" class="product-modal-img" id="modal-product-img" />
          ${photoTabs}
        </div>
        <div>
          <h2 id="modal-product-title" style="margin:0 0 0.35rem;font-family:var(--font-display);">${escapeHtml(product.name)}</h2>
          <div class="product-price" style="margin-bottom:0.65rem;">${formatEuro(product.price)}</div>
          <p style="margin:0 0 0.85rem;font-size:0.9rem;color:var(--ink-secondary);">${escapeHtml(product.shortDesc)}</p>
          <ul class="product-modal-specs">
            ${product.specs.map((spec) => `<li>${escapeHtml(spec)}</li>`).join('')}
          </ul>
          <div class="size-picker-label">
            <span>${escapeHtml(product.sizeLabel)} : <strong id="modal-size-text">${escapeHtml(modalSize)}</strong></span>
            <span id="modal-stock-label">${formatStockLabel(modalStock)}</span>
          </div>
          <div class="size-pills" id="modal-size-pills">${sizePills}</div>
          <button type="button" class="btn btn-primary btn-full" id="modal-add-btn" ${modalStock <= 0 ? 'disabled' : ''}>
            ${modalStock <= 0 ? 'Rupture de stock' : `Ajouter au panier — ${formatEuro(product.price)}`}
          </button>
          <button type="button" class="btn btn-secondary btn-full" id="modal-close-action-btn" style="margin-top:0.65rem;">
            Fermer
          </button>
        </div>
      </div>
    `;

    document.getElementById('modal-close-action-btn').addEventListener('click', closeProductModal);

    if (product.backImage) {
      const modalImg = document.getElementById('modal-product-img');
      const photoTabsEl = document.getElementById('modal-photo-tabs');
      photoTabsEl.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-photo-side]');
        if (!btn) return;
        const isBack = btn.dataset.photoSide === 'back';
        modalImg.src = isBack ? product.backImage : product.image;
        photoTabsEl.querySelectorAll('[data-photo-side]').forEach((b) => {
          b.classList.toggle('is-active', b === btn);
        });
      });
    }

    const pillsWrap = document.getElementById('modal-size-pills');
    const modalAddBtn = document.getElementById('modal-add-btn');
    const modalSizeText = document.getElementById('modal-size-text');
    const modalStockLabel = document.getElementById('modal-stock-label');

    pillsWrap.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-modal-size]');
      if (!btn) return;
      modalSize = btn.dataset.modalSize;
      state.selectedSizes[product.id] = modalSize;
      const qty = getAvailableStock(product.id, modalSize);
      modalSizeText.textContent = modalSize;
      modalStockLabel.innerHTML = formatStockLabel(qty);
      modalAddBtn.disabled = qty <= 0;
      modalAddBtn.textContent = qty <= 0
        ? 'Rupture de stock'
        : `Ajouter au panier — ${formatEuro(product.price)}`;
      pillsWrap.querySelectorAll('.size-pill').forEach((p) => {
        p.classList.toggle('is-selected', p.dataset.modalSize === modalSize);
      });
      renderProducts();
    });

    modalAddBtn.addEventListener('click', (e) => {
      addToCart(product.id, modalSize, e.currentTarget);
      closeProductModal();
      openCartDrawer();
    });

    els.productModalBackdrop.classList.add('is-open');
    els.productModalBackdrop.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeProductModal() {
    els.productModalBackdrop.classList.remove('is-open');
    els.productModalBackdrop.setAttribute('aria-hidden', 'true');
    if (!els.cartDrawer.classList.contains('is-open')) {
      document.body.style.overflow = '';
    }
  }

  function openSizeGuide() {
    els.sizeGuideBackdrop.classList.add('is-open');
    els.sizeGuideBackdrop.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeSizeGuide() {
    els.sizeGuideBackdrop.classList.remove('is-open');
    els.sizeGuideBackdrop.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function buildOrderPlainText(order) {
    const itemsText = order.items
      .map((i) => `- ${i.qty}x ${i.name} (${i.size}) : ${formatEuro(i.lineTotal)}`)
      .join('\n');

    return [
      `REÇU DE COMMANDE — ${state.settings.clubName}`,
      'Merci d\'avoir passé commande !',
      '',
      `Référence : ${order.ref}`,
      `Date : ${order.dateLabel}`,
      `Adhérent : ${order.memberName}`,
      `Email : ${order.memberEmail || order.memberContact || ''}`,
      order.memberPhone ? `Téléphone : ${order.memberPhone}` : null,
      `Règlement : ${order.paymentMethod}`,
      order.memberNote ? `Remarque : ${order.memberNote}` : null,
      '',
      'Articles :',
      itemsText,
      '',
      `TOTAL : ${formatEuro(order.total)} (Retrait gratuit au club)`
    ].filter((line) => line !== null).join('\n');
  }

  async function handleCheckoutSubmit(event) {
    event.preventDefault();
    const { lines, totalPrice } = computeCartDetails();
    if (lines.length === 0) return;

    const formData = new FormData(els.checkoutForm);
    const memberName = String(formData.get('memberName') || '').trim();
    const memberEmail = String(formData.get('memberEmail') || '').trim();
    const memberPhone = String(formData.get('memberPhone') || '').trim();
    const paymentMethod = String(formData.get('paymentMethod') || '').trim();
    const memberNote = String(formData.get('memberNote') || '').trim();

    if (!memberName || !memberEmail) {
      showToast('Veuillez renseigner votre nom et votre email.');
      return;
    }

    const now = new Date();
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const order = {
      ref: `CLUB-${randomCode}`,
      createdAt: now.toISOString(),
      dateLabel: now.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }),
      memberName,
      memberEmail,
      memberPhone,
      paymentMethod,
      memberNote,
      total: totalPrice,
      items: lines.map(({ product, size, qty, lineTotal }) => ({
        id: product.id,
        name: product.name,
        size,
        qty,
        lineTotal
      }))
    };

    els.submitOrderBtn.disabled = true;
    els.submitOrderBtn.textContent = 'Envoi en cours...';

    let emailResult = { status: 'offline' };
    let serverSyncedStock = false;

    if (window.location.protocol.startsWith('http')) {
      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...order,
            clubName: state.settings.clubName,
            clubEmail: state.settings.email
          })
        });
        const data = await res.json();
        if (res.status === 409) {
          if (data.stock) {
            state.stock = normalizeStock(data.stock);
            saveJson(STORAGE_KEYS.STOCK, state.stock);
            renderProducts();
          }
          els.submitOrderBtn.disabled = false;
          els.submitOrderBtn.textContent = 'Confirmer la commande';
          showToast(data.error || 'Stock insuffisant.');
          return;
        }
        if (res.ok) {
          if (data.stock) {
            state.stock = normalizeStock(data.stock);
            saveJson(STORAGE_KEYS.STOCK, state.stock);
            serverSyncedStock = true;
          }
          emailResult = {
            status: data.emailStatus || (data.emailSent ? 'sent' : 'not_configured'),
            error: data.emailError
          };
        }
      } catch {
        emailResult = { status: 'offline' };
      }
    }

    if (!serverSyncedStock) {
      order.items.forEach((item) => {
        if (state.stock[item.id] && typeof state.stock[item.id][item.size] === 'number') {
          state.stock[item.id][item.size] = Math.max(0, state.stock[item.id][item.size] - item.qty);
        }
      });
      saveJson(STORAGE_KEYS.STOCK, state.stock);
    }

    els.submitOrderBtn.disabled = false;
    els.submitOrderBtn.textContent = 'Confirmer la commande';

    state.orders.unshift(order);
    saveJson(STORAGE_KEYS.ORDERS, state.orders);
    state.lastOrder = { ...order, emailResult };
    state.cart = [];
    saveJson(STORAGE_KEYS.CART, []);
    els.checkoutForm.reset();

    displayOrderConfirmation(state.lastOrder);
    renderProducts();
    renderCart();
  }

  function renderEmailStatusBanner(order) {
    const status = order.emailResult?.status || 'offline';
    const banner = els.emailStatusBanner;
    banner.className = 'email-status-banner';

    if (status === 'sent') {
      banner.classList.add('is-sent');
      banner.textContent = `Reçu envoyé par mail à ${order.memberEmail}.`;
      banner.hidden = false;
      return;
    }

    if (status === 'not_configured') {
      banner.classList.add('is-warn');
      banner.textContent = 'Commande enregistrée. Pour activer l\'envoi automatique par mail, renseignez vos identifiants SMTP dans le fichier .env du serveur.';
      banner.hidden = false;
      return;
    }

    if (status === 'error') {
      banner.classList.add('is-warn');
      banner.textContent = `Commande enregistrée, mais l'envoi SMTP a échoué (${order.emailResult?.error || 'erreur serveur'}). Utilisez le bouton Email ci-dessous.`;
      banner.hidden = false;
      return;
    }

    banner.textContent = 'Serveur mail non démarré (mode local). Utilisez Envoyer par Email ou Imprimer ci-dessous.';
    banner.hidden = false;
  }

  function displayOrderConfirmation(order) {
    const text = buildOrderPlainText(order);
    els.confirmOrderRef.textContent = `Réf. ${order.ref}`;
    els.confirmSummaryCard.textContent = text;
    renderEmailStatusBanner(order);

    const encodedText = encodeURIComponent(text);
    const cleanPhone = (state.settings.whatsapp || '').replace(/\D/g, '');
    els.sendWhatsappBtn.href = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodedText}`
      : `https://wa.me/?text=${encodedText}`;

    const recipient = order.memberEmail || state.settings.email || '';
    const subject = encodeURIComponent(`Merci pour votre commande ${order.ref} — ${state.settings.clubName}`);
    els.sendEmailBtn.href = `mailto:${encodeURIComponent(recipient)}?subject=${subject}&body=${encodedText}`;
  }

  function bindEvents() {
    els.enterShopBtn.addEventListener('click', () => enterShop('all'));
    els.brandHomeBtn.addEventListener('click', showLanding);

    els.filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => setFilter(btn.dataset.filter));
    });

    els.productsGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, productId, size } = btn.dataset;

      if (action === 'select-size') {
        state.selectedSizes[productId] = size;
        renderProducts();
      } else if (action === 'add-to-cart') {
        addToCart(productId, null, btn);
      } else if (action === 'open-details') {
        openProductModal(productId);
      }
    });

    els.cartItemsList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, productId, size } = btn.dataset;
      if (action === 'qty-inc') updateCartQty(productId, size, 1);
      if (action === 'qty-dec') updateCartQty(productId, size, -1);
      if (action === 'remove-item') removeCartItem(productId, size);
    });

    els.openCartBtn.addEventListener('click', openCartDrawer);
    els.closeCartBtn.addEventListener('click', closeCartDrawer);
    els.cartBackdrop.addEventListener('click', closeCartDrawer);
    els.browseFromEmptyBtn.addEventListener('click', () => {
      closeCartDrawer();
      if (state.view === 'landing') enterShop('all');
    });

    els.checkoutForm.addEventListener('submit', handleCheckoutSubmit);

    els.copyOrderBtn.addEventListener('click', async () => {
      if (!state.lastOrder) return;
      const text = buildOrderPlainText(state.lastOrder);
      try {
        await navigator.clipboard.writeText(text);
        showToast('Commande copiée');
      } catch {
        showToast('Copie impossible automatiquement');
      }
    });

    els.printOrderBtn.addEventListener('click', () => window.print());

    els.newOrderBtn.addEventListener('click', () => {
      state.lastOrder = null;
      renderCart();
      closeCartDrawer();
    });

    els.closeProductModalBtn.addEventListener('click', closeProductModal);
    els.productModalBackdrop.addEventListener('click', (e) => {
      if (e.target === els.productModalBackdrop) closeProductModal();
    });

    els.toolbarSizeGuideBtn.addEventListener('click', openSizeGuide);
    els.closeSizeGuideBtn.addEventListener('click', closeSizeGuide);
    els.sizeGuideBackdrop.addEventListener('click', (e) => {
      if (e.target === els.sizeGuideBackdrop) closeSizeGuide();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeCartDrawer();
        closeProductModal();
        closeSizeGuide();
      }
    });
  }

  async function syncCatalogAndStockFromServer() {
    if (!window.location.protocol.startsWith('http')) return;
    try {
      const [prodRes, stockRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/stock')
      ]);
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        if (Array.isArray(prodData.products)) {
          state.products = prodData.products;
          saveJson(STORAGE_KEYS.PRODUCTS, state.products);
          state.products.forEach((p) => {
            if (!state.selectedSizes[p.id]) {
              state.selectedSizes[p.id] = p.defaultSize || (p.sizes && p.sizes[0]) || 'Unique';
            }
          });
        }
      }
      if (stockRes.ok) {
        const stockData = await stockRes.json();
        if (stockData.stock) {
          state.stock = normalizeStock(stockData.stock, state.products);
          saveJson(STORAGE_KEYS.STOCK, state.stock);
        }
      }
      renderProducts();
      renderCart();
    } catch {
      // Fallback to localStorage
    }
  }

  function init() {
    applySettingsToUi();
    renderProducts();
    renderCart();
    bindEvents();
    syncCatalogAndStockFromServer();
  }

  init();
})();
