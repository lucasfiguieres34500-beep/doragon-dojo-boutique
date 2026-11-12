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
    lastOrder: null,
    member: null,
    memberOrders: []
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
    confirmSummaryCard: document.getElementById('confirm-summary-card'),
    sendWhatsappBtn: document.getElementById('send-whatsapp-btn'),
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
    toast: document.getElementById('toast'),
    accountBtn: document.getElementById('account-btn'),
    accountBtnAvatar: document.getElementById('account-btn-avatar'),
    accountBtnLabel: document.getElementById('account-btn-label'),
    accountModalBackdrop: document.getElementById('account-modal-backdrop'),
    closeAccountModalBtn: document.getElementById('close-account-modal-btn'),
    accountGuestView: document.getElementById('account-guest-view'),
    accountLoggedView: document.getElementById('account-logged-view'),
    tabLoginBtn: document.getElementById('tab-login-btn'),
    tabRegisterBtn: document.getElementById('tab-register-btn'),
    memberLoginForm: document.getElementById('member-login-form'),
    memberRegisterForm: document.getElementById('member-register-form'),
    loginErrorMsg: document.getElementById('login-error-msg'),
    registerErrorMsg: document.getElementById('register-error-msg'),
    switchToRegisterBtn: document.getElementById('switch-to-register'),
    switchToLoginBtn: document.getElementById('switch-to-login'),
    profileAvatarInitials: document.getElementById('profile-avatar-initials'),
    profileDisplayName: document.getElementById('profile-display-name'),
    profileDisplayEmail: document.getElementById('profile-display-email'),
    btnLogout: document.getElementById('btn-logout'),
    tabMemberOrdersBtn: document.getElementById('tab-member-orders-btn'),
    tabMemberProfileBtn: document.getElementById('tab-member-profile-btn'),
    loggedPanelOrders: document.getElementById('logged-panel-orders'),
    loggedPanelProfile: document.getElementById('logged-panel-profile'),
    memberOrdersContainer: document.getElementById('member-orders-container'),
    memberProfileForm: document.getElementById('member-profile-form'),
    profName: document.getElementById('prof-name'),
    profEmail: document.getElementById('prof-email'),
    profPhone: document.getElementById('prof-phone'),
    profRashguardSize: document.getElementById('prof-rashguard-size'),
    profGlovesSize: document.getElementById('prof-gloves-size'),
    profileSuccessMsg: document.getElementById('profile-success-msg'),
    profileErrorMsg: document.getElementById('profile-error-msg'),
    cartMemberBanner: document.getElementById('cart-member-banner'),
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
    const priceBadge = document.getElementById('submit-order-price-badge');
    if (priceBadge) priceBadge.textContent = formatEuro(totalPrice);

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
      .map((i) => `- ${i.qty}x ${i.name} (Taille ${i.size}) : ${formatEuro(i.lineTotal)}`)
      .join('\n');

    const isOnline = (order.paymentMethod || '').toLowerCase().includes('en ligne');

    return [
      `🥋 REÇU DE COMMANDE — ${state.settings.clubName}`,
      isOnline ? 'Paiement en ligne validé avec succès !' : '⚠️ Réservation enregistrée — Paiement à effectuer au club',
      '',
      `Référence : ${order.ref}`,
      `Date : ${order.dateLabel}`,
      `Adhérent : ${order.memberName}`,
      order.memberPhone ? `Téléphone : ${order.memberPhone}` : null,
      order.memberEmail ? `Email : ${order.memberEmail}` : null,
      `Mode de règlement : ${order.paymentMethod}`,
      order.paymentStatus ? `Statut : ${order.paymentStatus}` : null,
      order.memberNote ? `Remarque : ${order.memberNote}` : null,
      '',
      'Articles commandés :',
      itemsText,
      '',
      `TOTAL : ${formatEuro(order.total)}`,
      isOnline
        ? '(Payé par Carte Bancaire en ligne — Équipement à récupérer à l\'accueil du dojo)'
        : '⚠️ ATTENTION : Vous réservez uniquement votre équipement en ligne. Le règlement de ' + formatEuro(order.total) + ' s\'effectuera directement au dojo lors de votre prochain entraînement (en Espèces ou par Carte Bancaire).'
    ].filter(Boolean).join('\n');
  }

  async function handleCheckoutSubmit(event) {
    event.preventDefault();
    const { lines, totalPrice } = computeCartDetails();
    if (lines.length === 0) return;

    const formData = new FormData(els.checkoutForm);
    const memberName = String(formData.get('memberName') || '').trim();
    const memberPhone = String(formData.get('memberPhone') || '').trim();
    const memberEmail = state.member ? (state.member.email || '') : '';
    const memberNote = String(formData.get('memberNote') || '').trim();

    const radioClub = document.querySelector('input[name="paymentOption"][value="club"]');
    const isClub = radioClub && radioClub.checked;
    const paymentMethod = isClub
      ? 'Retrait au dojo (Réservation - Paiement sur place)'
      : 'Paiement en ligne sécurisé par Carte Bancaire';
    const paymentStatus = isClub ? 'À régler au club' : 'Payé en ligne (CB)';

    if (!memberName) {
      showToast('Veuillez renseigner votre nom et prénom.');
      return;
    }
    if (!memberPhone) {
      showToast('Veuillez renseigner votre numéro de téléphone.');
      return;
    }

    if (!isClub) {
      const cardNum = (document.getElementById('card-number')?.value || '').replace(/\s/g, '');
      const cardExp = (document.getElementById('card-expiry')?.value || '').trim();
      const cardCvc = (document.getElementById('card-cvc')?.value || '').trim();

      if (cardNum.length < 15 || !/^\d+$/.test(cardNum)) {
        showToast('Veuillez renseigner un numéro de carte bancaire valide (16 chiffres).');
        document.getElementById('card-number')?.focus();
        return;
      }
      if (!/^\d{2}\/\d{2}$/.test(cardExp)) {
        showToast('Veuillez renseigner l\'expiration au format MM/AA.');
        document.getElementById('card-expiry')?.focus();
        return;
      }
      if (cardCvc.length < 3) {
        showToast('Veuillez renseigner le code cryptogramme CVC (3 chiffres).');
        document.getElementById('card-cvc')?.focus();
        return;
      }
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
      paymentStatus,
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
    els.submitOrderBtn.textContent = isClub ? 'Enregistrement de la réservation...' : 'Paiement en cours...';

    let serverSyncedStock = false;

    if (window.location.protocol.startsWith('http')) {
      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...order,
            clubName: state.settings.clubName,
            memberId: state.member ? state.member.id : null
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
          updateSubmitOrderBtnUi(totalPrice);
          showToast(data.error || 'Stock insuffisant.');
          return;
        }
        if (res.ok) {
          if (data.stock) {
            state.stock = normalizeStock(data.stock);
            saveJson(STORAGE_KEYS.STOCK, state.stock);
            serverSyncedStock = true;
          }
        }
      } catch {
        // Fallback offline
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
    updateSubmitOrderBtnUi(totalPrice);

    state.orders.unshift(order);
    if (state.member) { state.memberOrders.unshift(order); }
    saveJson(STORAGE_KEYS.ORDERS, state.orders);
    state.lastOrder = order;
    state.cart = [];
    saveJson(STORAGE_KEYS.CART, []);
    els.checkoutForm.reset();

    displayOrderConfirmation(state.lastOrder);
    renderProducts();
    renderCart();
  }

  function updateSubmitOrderBtnUi(totalPrice) {
    const radioClub = document.querySelector('input[name="paymentOption"][value="club"]');
    const isClub = radioClub && radioClub.checked;
    const labelSpan = document.getElementById('submit-order-btn-label');
    const badgeSpan = document.getElementById('submit-order-price-badge');
    if (labelSpan) labelSpan.textContent = isClub ? 'Réserver mon équipement' : 'Payer en ligne';
    if (badgeSpan) badgeSpan.textContent = formatEuro(totalPrice);
  }

  function displayOrderConfirmation(order) {
    const text = buildOrderPlainText(order);
    els.confirmOrderRef.textContent = `Réf. ${order.ref}`;
    els.confirmSummaryCard.textContent = text;

    const isClub = (order.paymentMethod || '').toLowerCase().includes('retrait');
    const noticeEl = document.querySelector('.confirm-notice');
    if (noticeEl) {
      if (isClub) {
        noticeEl.innerHTML = `<strong>⚠️ Attention réservation :</strong> Vous avez réservé votre équipement en ligne. Aucun débit n'a été effectué. Le règlement intégral de <strong>${formatEuro(order.total)}</strong> s'effectuera directement à l'accueil du dojo (en Espèces ou par Carte Bancaire).`;
      } else {
        noticeEl.innerHTML = `<strong>Paiement CB validé en ligne !</strong> Votre règlement de <strong>${formatEuro(order.total)}</strong> a été accepté. Vos équipements sont préparés et vous attendent au dojo.`;
      }
    }

    const encodedText = encodeURIComponent(text);
    const cleanPhone = (state.settings.whatsapp || '').replace(/\D/g, '');
    if (els.sendWhatsappBtn) {
      els.sendWhatsappBtn.href = cleanPhone
        ? `https://wa.me/${cleanPhone}?text=${encodedText}`
        : `https://wa.me/?text=${encodedText}`;
    }
  }

  
  /* ==========================================================================
     GESTION DU COMPTE ADHÉRENT (FRONTEND)
     ========================================================================== */

  function getInitials(name) {
    if (!name) return 'DD';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function updateMemberUi() {
    if (!els.accountBtn) return;
    if (state.member) {
      els.accountBtn.classList.add('is-logged');
      const firstName = state.member.name.split(' ')[0] || state.member.name;
      els.accountBtnLabel.textContent = firstName;
      const initials = getInitials(state.member.name);
      els.accountBtnAvatar.innerHTML = `<span class="account-avatar-dot">${escapeHtml(initials)}</span>`;

      // Profile view inputs
      if (els.profileAvatarInitials) els.profileAvatarInitials.textContent = initials;
      if (els.profileDisplayName) els.profileDisplayName.textContent = state.member.name;
      if (els.profileDisplayEmail) els.profileDisplayEmail.textContent = state.member.email;
      if (els.profName) els.profName.value = state.member.name || '';
      if (els.profEmail) els.profEmail.value = state.member.email || '';
      if (els.profPhone) els.profPhone.value = state.member.phone || '';
      if (els.profRashguardSize) els.profRashguardSize.value = state.member.favoriteRashguardSize || '';
      if (els.profGlovesSize) els.profGlovesSize.value = state.member.favoriteGlovesSize || '';

      // Auto-fill checkout fields if empty
      const nameInput = document.getElementById('member-name');
      const phoneInput = document.getElementById('member-phone');
      if (nameInput && !nameInput.value) nameInput.value = state.member.name;
      if (phoneInput && state.member.phone && !phoneInput.value) phoneInput.value = state.member.phone;
    } else {
      els.accountBtn.classList.remove('is-logged');
      els.accountBtnLabel.textContent = 'Espace Adhérent';
      els.accountBtnAvatar.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>`;
    }
    renderCartMemberBanner();
  }

  function renderCartMemberBanner() {
    if (!els.cartMemberBanner) return;
    if (state.member) {
      els.cartMemberBanner.innerHTML = `
        <div class="cart-member-box">
          <div class="cart-member-info">
            <span class="cart-member-tag">Adhérent connecté</span>
            <span class="cart-member-name">${escapeHtml(state.member.name)}</span>
            <span class="cart-member-sub">${escapeHtml(state.member.email)}</span>
          </div>
          <button type="button" class="btn-text-link" id="cart-member-account-btn">Gérer mon compte</button>
        </div>
      `;
      const btn = document.getElementById('cart-member-account-btn');
      if (btn) btn.onclick = () => openAccountModal('orders');
    } else {
      els.cartMemberBanner.innerHTML = `
        <div class="cart-member-box is-guest">
          <div class="cart-member-info">
            <span class="cart-member-name">Vous êtes adhérent du club ?</span>
            <span class="cart-member-sub">Connectez-vous pour pré-remplir vos coordonnées et suivre vos commandes.</span>
          </div>
          <button type="button" class="btn-text-link" id="cart-quick-login-btn">Se connecter</button>
        </div>
      `;
      const btn = document.getElementById('cart-quick-login-btn');
      if (btn) btn.onclick = () => openAccountModal('login');
    }
  }

  function applyMemberPreferences() {
    if (!state.member) return;
    if (state.member.favoriteRashguardSize) {
      state.products.forEach((p) => {
        if (p.category === 'rashguard' && Array.isArray(p.sizes) && p.sizes.includes(state.member.favoriteRashguardSize)) {
          state.selectedSizes[p.id] = state.member.favoriteRashguardSize;
        }
      });
    }
    if (state.member.favoriteGlovesSize) {
      state.products.forEach((p) => {
        if (p.category === 'gants' && Array.isArray(p.sizes) && p.sizes.includes(state.member.favoriteGlovesSize)) {
          state.selectedSizes[p.id] = state.member.favoriteGlovesSize;
        }
      });
    }
    renderProducts();
  }

  function renderMemberOrders() {
    if (!els.memberOrdersContainer) return;
    if (!state.memberOrders || state.memberOrders.length === 0) {
      els.memberOrdersContainer.innerHTML = `
        <div class="member-order-empty">
          <p>Aucune commande enregistrée pour le moment.</p>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-browse-from-account">Découvrir les équipements</button>
        </div>
      `;
      const browseBtn = document.getElementById('btn-browse-from-account');
      if (browseBtn) {
        browseBtn.onclick = () => {
          closeAccountModal();
          if (state.view === 'landing') enterShop('all');
        };
      }
      return;
    }

    els.memberOrdersContainer.innerHTML = state.memberOrders.map((order) => {
      const itemsSummary = (order.items || []).map((it) => `${it.qty}x ${escapeHtml(it.name)} (Taille ${escapeHtml(it.size)})`).join(', ');
      return `
        <div class="member-order-card">
          <div class="member-order-header">
            <span class="member-order-ref">${escapeHtml(order.ref)}</span>
            <span class="member-order-date">${escapeHtml(order.dateLabel || order.createdAt ? new Date(order.createdAt).toLocaleDateString('fr-FR') : '')}</span>
          </div>
          <div class="member-order-items">${itemsSummary}</div>
          <div class="member-order-footer">
            <span>Règlement : <strong>${escapeHtml(order.paymentMethod || 'Sur place au club')}</strong></span>
            <span class="member-order-total">${formatEuro(order.total || 0)}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  function openAccountModal(targetTab) {
    if (!els.accountModalBackdrop) return;
    if (state.member) {
      els.accountGuestView.hidden = true;
      els.accountLoggedView.hidden = false;
      switchLoggedTab(targetTab === 'profile' ? 'profile' : 'orders');
      renderMemberOrders();
    } else {
      els.accountGuestView.hidden = false;
      els.accountLoggedView.hidden = true;
      switchGuestTab(targetTab === 'register' ? 'register' : 'login');
    }
    els.accountModalBackdrop.classList.add('is-open');
    els.accountModalBackdrop.setAttribute('aria-hidden', 'false');
  }

  function closeAccountModal() {
    if (!els.accountModalBackdrop) return;
    els.accountModalBackdrop.classList.remove('is-open');
    els.accountModalBackdrop.setAttribute('aria-hidden', 'true');
    if (els.loginErrorMsg) els.loginErrorMsg.hidden = true;
    if (els.registerErrorMsg) els.registerErrorMsg.hidden = true;
    if (els.profileSuccessMsg) els.profileSuccessMsg.hidden = true;
    if (els.profileErrorMsg) els.profileErrorMsg.hidden = true;
  }

  function switchGuestTab(tab) {
    if (tab === 'register') {
      els.tabLoginBtn.classList.remove('is-active');
      els.tabRegisterBtn.classList.add('is-active');
      els.memberLoginForm.hidden = true;
      els.memberRegisterForm.hidden = false;
    } else {
      els.tabLoginBtn.classList.add('is-active');
      els.tabRegisterBtn.classList.remove('is-active');
      els.memberLoginForm.hidden = false;
      els.memberRegisterForm.hidden = true;
    }
    if (els.loginErrorMsg) els.loginErrorMsg.hidden = true;
    if (els.registerErrorMsg) els.registerErrorMsg.hidden = true;
  }

  function switchLoggedTab(tab) {
    if (tab === 'profile') {
      els.tabMemberOrdersBtn.classList.remove('is-active');
      els.tabMemberProfileBtn.classList.add('is-active');
      els.loggedPanelOrders.hidden = true;
      els.loggedPanelProfile.hidden = false;
    } else {
      els.tabMemberOrdersBtn.classList.add('is-active');
      els.tabMemberProfileBtn.classList.remove('is-active');
      els.loggedPanelOrders.hidden = false;
      els.loggedPanelProfile.hidden = true;
      renderMemberOrders();
    }
    if (els.profileSuccessMsg) els.profileSuccessMsg.hidden = true;
    if (els.profileErrorMsg) els.profileErrorMsg.hidden = true;
  }

  async function checkMemberSession() {
    if (!window.location.protocol.startsWith('http')) return;
    try {
      const res = await fetch('/api/member/me');
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          state.member = data.user;
          state.memberOrders = Array.isArray(data.orders) ? data.orders : [];
          updateMemberUi();
          applyMemberPreferences();
        } else {
          state.member = null;
          state.memberOrders = [];
          updateMemberUi();
        }
      }
    } catch {
      // Offline fallback
    }
  }

  async function handleMemberLogin(e) {
    e.preventDefault();
    const email = (document.getElementById('login-email').value || '').trim();
    const password = document.getElementById('login-password').value || '';
    const btn = document.getElementById('btn-submit-login');

    if (!email || !password) return;
    btn.disabled = true;
    btn.textContent = 'Connexion...';
    els.loginErrorMsg.hidden = true;

    try {
      const res = await fetch('/api/member/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json().catch(() => ({}));
      btn.disabled = false;
      btn.textContent = 'Se connecter';

      if (!res.ok || !data.ok) {
        els.loginErrorMsg.textContent = data.error || 'Email ou mot de passe incorrect.';
        els.loginErrorMsg.hidden = false;
        return;
      }

      state.member = data.user;
      state.memberOrders = Array.isArray(data.orders) ? data.orders : [];
      updateMemberUi();
      applyMemberPreferences();
      showToast(`Bienvenue ${state.member.name} !`);
      closeAccountModal();
    } catch {
      btn.disabled = false;
      btn.textContent = 'Se connecter';
      els.loginErrorMsg.textContent = 'Erreur réseau, veuillez réessayer.';
      els.loginErrorMsg.hidden = false;
    }
  }

  async function handleMemberRegister(e) {
    e.preventDefault();
    const name = (document.getElementById('reg-name').value || '').trim();
    const email = (document.getElementById('reg-email').value || '').trim();
    const phone = (document.getElementById('reg-phone').value || '').trim();
    const password = document.getElementById('reg-password').value || '';
    const favoriteRashguardSize = document.getElementById('reg-rashguard-size').value;
    const favoriteGlovesSize = document.getElementById('reg-gloves-size').value;
    const btn = document.getElementById('btn-submit-register');

    if (!name || !email || !password) return;
    btn.disabled = true;
    btn.textContent = 'Création du compte...';
    els.registerErrorMsg.hidden = true;

    try {
      const res = await fetch('/api/member/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone,
          password,
          favoriteRashguardSize,
          favoriteGlovesSize
        })
      });
      const data = await res.json().catch(() => ({}));
      btn.disabled = false;
      btn.textContent = 'Créer mon compte';

      if (!res.ok || !data.ok) {
        els.registerErrorMsg.textContent = data.error || 'Erreur lors de la création du compte.';
        els.registerErrorMsg.hidden = false;
        return;
      }

      state.member = data.user;
      state.memberOrders = [];
      updateMemberUi();
      applyMemberPreferences();
      showToast('Votre compte adhérent a été créé avec succès !');
      closeAccountModal();
    } catch {
      btn.disabled = false;
      btn.textContent = 'Créer mon compte';
      els.registerErrorMsg.textContent = 'Erreur réseau, veuillez réessayer.';
      els.registerErrorMsg.hidden = false;
    }
  }

  async function handleMemberLogout() {
    try {
      await fetch('/api/member/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    state.member = null;
    state.memberOrders = [];
    updateMemberUi();
    showToast('Vous avez été déconnecté.');
    closeAccountModal();
  }

  async function handleMemberProfileUpdate(e) {
    e.preventDefault();
    const name = (els.profName.value || '').trim();
    const phone = (els.profPhone.value || '').trim();
    const favoriteRashguardSize = els.profRashguardSize.value;
    const favoriteGlovesSize = els.profGlovesSize.value;
    const btn = document.getElementById('btn-save-profile');

    btn.disabled = true;
    btn.textContent = 'Enregistrement...';
    els.profileSuccessMsg.hidden = true;
    els.profileErrorMsg.hidden = true;

    try {
      const res = await fetch('/api/member/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, favoriteRashguardSize, favoriteGlovesSize })
      });
      const data = await res.json().catch(() => ({}));
      btn.disabled = false;
      btn.textContent = 'Enregistrer mes préférences';

      if (!res.ok || !data.ok) {
        els.profileErrorMsg.textContent = data.error || 'Impossible d\'enregistrer.';
        els.profileErrorMsg.hidden = false;
        return;
      }

      state.member = data.user;
      updateMemberUi();
      applyMemberPreferences();
      els.profileSuccessMsg.textContent = 'Préférences mises à jour avec succès !';
      els.profileSuccessMsg.hidden = false;
      showToast('Profil mis à jour');
    } catch {
      btn.disabled = false;
      btn.textContent = 'Enregistrer mes préférences';
      els.profileErrorMsg.textContent = 'Erreur de connexion.';
      els.profileErrorMsg.hidden = false;
    }
  }

  function bindEvents() {
    els.enterShopBtn.addEventListener('click', () => enterShop('all'));

    if (els.accountBtn) els.accountBtn.addEventListener('click', () => openAccountModal());
    if (els.closeAccountModalBtn) els.closeAccountModalBtn.addEventListener('click', closeAccountModal);
    if (els.accountModalBackdrop) {
      els.accountModalBackdrop.addEventListener('click', (e) => {
        if (e.target === els.accountModalBackdrop) closeAccountModal();
      });
    }
    if (els.tabLoginBtn) els.tabLoginBtn.addEventListener('click', () => switchGuestTab('login'));
    if (els.tabRegisterBtn) els.tabRegisterBtn.addEventListener('click', () => switchGuestTab('register'));
    if (els.switchToRegisterBtn) els.switchToRegisterBtn.addEventListener('click', () => switchGuestTab('register'));
    if (els.switchToLoginBtn) els.switchToLoginBtn.addEventListener('click', () => switchGuestTab('login'));
    if (els.tabMemberOrdersBtn) els.tabMemberOrdersBtn.addEventListener('click', () => switchLoggedTab('orders'));
    if (els.tabMemberProfileBtn) els.tabMemberProfileBtn.addEventListener('click', () => switchLoggedTab('profile'));
    if (els.memberLoginForm) els.memberLoginForm.addEventListener('submit', handleMemberLogin);
    if (els.memberRegisterForm) els.memberRegisterForm.addEventListener('submit', handleMemberRegister);
    if (els.btnLogout) els.btnLogout.addEventListener('click', handleMemberLogout);
    if (els.memberProfileForm) els.memberProfileForm.addEventListener('submit', handleMemberProfileUpdate);

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

    // Bascule entre Paiement en ligne et Retrait au club
    const radioOnline = document.querySelector('input[name="paymentOption"][value="online"]');
    const radioClub = document.querySelector('input[name="paymentOption"][value="club"]');
    const labelOnline = document.getElementById('opt-label-online');
    const labelClub = document.getElementById('opt-label-club');
    const panelOnline = document.getElementById('online-card-panel');
    const panelClub = document.getElementById('club-reservation-panel');
    const btnLabel = document.getElementById('submit-order-btn-label');
    const reassuranceText = document.getElementById('reassurance-text');

    function updatePaymentOptionView(option) {
      if (option === 'online') {
        if (labelOnline) labelOnline.classList.add('is-active');
        if (labelClub) labelClub.classList.remove('is-active');
        if (panelOnline) panelOnline.hidden = false;
        if (panelClub) panelClub.hidden = true;
        if (btnLabel) btnLabel.textContent = 'Payer en ligne';
        if (reassuranceText) reassuranceText.textContent = 'Paiement par carte bancaire sécurisé. Vos équipements sont préparés au dojo.';
      } else {
        if (labelClub) labelClub.classList.add('is-active');
        if (labelOnline) labelOnline.classList.remove('is-active');
        if (panelOnline) panelOnline.hidden = true;
        if (panelClub) panelClub.hidden = false;
        if (btnLabel) btnLabel.textContent = 'Réserver mon équipement';
        if (reassuranceText) reassuranceText.textContent = '⚠️ Attention : Vous réservez uniquement votre équipement. Le paiement intégral se fera sur place au club.';
      }
    }

    if (radioOnline && radioClub) {
      radioOnline.addEventListener('change', () => updatePaymentOptionView('online'));
      radioClub.addEventListener('change', () => updatePaymentOptionView('club'));
    }

    // Formatage automatique carte bancaire
    const cardNumInput = document.getElementById('card-number');
    if (cardNumInput) {
      cardNumInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '').slice(0, 16);
        val = val.replace(/(\d{4})(?=\d)/g, '$1 ');
        e.target.value = val;
      });
    }

    const cardExpInput = document.getElementById('card-expiry');
    if (cardExpInput) {
      cardExpInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '').slice(0, 4);
        if (val.length >= 2) val = val.slice(0, 2) + '/' + val.slice(2);
        e.target.value = val;
      });
    }

    const cardCvcInput = document.getElementById('card-cvc');
    if (cardCvcInput) {
      cardCvcInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 3);
      });
    }

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
