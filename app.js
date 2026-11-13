(() => {
  'use strict';

  const catalog = window.CLUB_CATALOG || window.ClubCatalog || {};
  const { DEFAULT_SETTINGS = {}, PRODUCTS: DEFAULT_PRODUCTS = [], createDefaultStock = () => ({}), normalizeStock = () => ({}) } = catalog;

  const STORAGE_KEYS = {
    CART: 'club_shop_cart_v1',
    PRODUCTS: 'club_shop_products_v1',
    STOCK: 'club_shop_stock_v1',
    SETTINGS: 'club_shop_settings_v1',
    ORDERS: 'club_shop_orders_v1',
    MEMBER: 'club_shop_member_v1'
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
    cartStep: 'items',
    settings: { ...DEFAULT_SETTINGS, ...loadJson(STORAGE_KEYS.SETTINGS, {}) },
    orders: loadJson(STORAGE_KEYS.ORDERS, []),
    lastOrder: null,
    member: loadJson(STORAGE_KEYS.MEMBER, null),
    memberOrders: [],
    authOrigin: 'header'
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
    cartStepItems: document.getElementById('cart-step-items'),
    cartStepCheckout: document.getElementById('cart-step-checkout'),
    btnGotoCheckout: document.getElementById('btn-goto-checkout'),
    btnBackToItems: document.getElementById('btn-back-to-items'),
    summaryItemsCount: document.getElementById('summary-items-count'),
    summarySubtotal: document.getElementById('summary-subtotal'),
    checkoutMiniTotal: document.getElementById('checkout-mini-total'),
    reservationAmountText: document.getElementById('reservation-amount-text'),
    checkoutLoggedUserBox: document.getElementById('checkout-logged-user-box'),
    checkoutAuthRequiredBox: document.getElementById('checkout-auth-required-box'),
    checkoutPaymentSection: document.getElementById('checkout-payment-section'),
    checkoutMemberAvatar: document.getElementById('checkout-member-avatar'),
    checkoutMemberNameLabel: document.getElementById('checkout-member-name-label'),
    checkoutMemberPhoneLabel: document.getElementById('checkout-member-phone-label'),
    btnSwitchAccountCheckout: document.getElementById('btn-switch-account-checkout'),
    btnCheckoutLogin: document.getElementById('btn-checkout-login'),
    btnCheckoutRegister: document.getElementById('btn-checkout-register'),
    btnGotoAccountReceipts: document.getElementById('btn-goto-account-receipts'),
    cartItemsList: document.getElementById('cart-items-list'),
    cartTotal: document.getElementById('cart-total'),
    browseFromEmptyBtn: document.getElementById('browse-from-empty-btn'),
    checkoutForm: document.getElementById('checkout-form'),
    submitOrderBtn: document.getElementById('submit-order-btn'),
    orderConfirmation: document.getElementById('order-confirmation'),
    confirmOrderRef: document.getElementById('confirm-order-ref'),
    confirmNotice: document.getElementById('confirm-notice'),
    confirmOrderCard: document.getElementById('confirm-order-card'),
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

  // Une seule gestion du défilement pour les fenêtres imbriquées, notamment sur iOS.
  const overlayFocus = new WeakMap();
  const overlayElements = [els.cartDrawer, els.productModalBackdrop, els.sizeGuideBackdrop, els.accountModalBackdrop];
  let savedPageScroll = null;
  let savedBodyOverflow = '';
  let viewportFrame = 0;
  let renderedCartStep = null;

  function topOverlay() {
    return overlayElements.filter((el) => el && el.classList.contains('is-open')).pop();
  }

  function updateOverlayViewport() {
    cancelAnimationFrame(viewportFrame);
    viewportFrame = requestAnimationFrame(() => {
      const viewport = window.visualViewport;
      if (viewport && viewport.scale !== 1) return; // Le zoom manuel reste disponible.
      const style = document.documentElement.style;
      style.setProperty('--overlay-height', (viewport ? viewport.height : window.innerHeight) + 'px');
      style.setProperty('--overlay-top', (viewport ? viewport.offsetTop : 0) + 'px');
    });
  }

  function syncOverlayState() {
    const active = topOverlay();
    if (active && savedPageScroll === null) {
      savedPageScroll = window.scrollY;
      savedBodyOverflow = document.body.style.overflow;
      document.body.style.setProperty('--page-scroll-top', -savedPageScroll + 'px');
      document.body.style.overflow = 'hidden';
      document.body.classList.add('has-overlay');
    }
    document.body.classList.toggle('drawer-open', els.cartDrawer.classList.contains('is-open'));
    document.body.classList.toggle('modal-open', overlayElements.slice(1).some((el) => el.classList.contains('is-open')));
    document.querySelectorAll('body > header, body > main, body > footer').forEach((el) => { el.inert = Boolean(active); });
    overlayElements.forEach((el) => { el.inert = el !== active; });
    if (!active && savedPageScroll !== null) {
      const scrollY = savedPageScroll;
      savedPageScroll = null;
      document.body.classList.remove('has-overlay');
      document.body.style.removeProperty('--page-scroll-top');
      document.body.style.overflow = savedBodyOverflow;
      window.scrollTo({top: scrollY, behavior: 'instant'});
    }
    if (active) updateOverlayViewport();
  }

  function activateOverlay(el) {
    if (!overlayFocus.has(el)) overlayFocus.set(el, document.activeElement);
    syncOverlayState();
    const dialog = el.matches('[role="dialog"]') ? el : el.querySelector('[role="dialog"]');
    if (dialog) {
      dialog.scrollTop = 0;
      dialog.setAttribute('tabindex', '-1');
      dialog.focus({preventScroll: true});
    }
  }

  function deactivateOverlay(el) {
    if (!el.classList.contains('is-open')) return;
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
    syncOverlayState();
    const previous = overlayFocus.get(el);
    overlayFocus.delete(el);
    if (previous && previous.isConnected && !previous.closest('[inert]')) previous.focus({preventScroll: true});
  }

  function closeTopOverlay() {
    const active = topOverlay();
    if (active === els.accountModalBackdrop) closeAccountModal();
    else if (active === els.sizeGuideBackdrop) closeSizeGuide();
    else if (active === els.productModalBackdrop) closeProductModal();
    else if (active === els.cartDrawer) closeCartDrawer();
  }

  window.addEventListener('resize', () => { if (topOverlay()) updateOverlayViewport(); }, {passive: true});
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => { if (topOverlay()) updateOverlayViewport(); }, {passive: true});
    window.visualViewport.addEventListener('scroll', () => { if (topOverlay()) updateOverlayViewport(); }, {passive: true});
  }


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
    if (els.headerClubName) els.headerClubName.textContent = state.settings.clubName;
    if (els.landingClubName) els.landingClubName.textContent = state.settings.clubName;
    if (els.footerClubName) els.footerClubName.textContent = state.settings.clubName;
    if (els.footerClubNote) els.footerClubNote.textContent = state.settings.footerNote;
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
            aria-pressed="${size === selectedSize}"
            data-action="select-size"
            data-product-id="${product.id}"
            data-size="${escapeHtml(size)}"
          >${escapeHtml(size)}</button>
        `;
      }).join('');

      return `
        <article class="product-card" data-product-id="${product.id}" style="--card-index:${index};">
          <div class="product-media" data-action="open-details" data-product-id="${product.id}">
            <img src="${product.image}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async" />
          </div>
          <div class="product-body">
            <div class="product-top-row">
              <h3 class="product-title">${escapeHtml(product.name)}</h3>
              <span class="product-price">${formatEuro(product.price)}</span>
            </div>

            <div class="size-picker-label">
              <span>Taille : <strong>${escapeHtml(selectedSize)}</strong></span>
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
                <span>${selectedStock <= 0 ? 'Rupture' : 'Ajouter'}</span>
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


  function updateProductSelection(productId) {
    const product = state.products.find((item) => item.id === productId);
    const card = [...els.productsGrid.children].find((item) => item.dataset.productId === productId);
    if (!product || !card) return;
    const size = state.selectedSizes[productId];
    const stock = getAvailableStock(productId, size);
    card.querySelector('.size-picker-label').innerHTML = '<span>Taille : <strong>' + escapeHtml(size) + '</strong></span>' + formatStockLabel(stock);
    card.querySelectorAll('[data-action="select-size"]').forEach((button) => {
      button.classList.toggle('is-selected', button.dataset.size === size);
      button.setAttribute('aria-pressed', String(button.dataset.size === size));
    });
    const addButton = card.querySelector('[data-action="add-to-cart"]');
    addButton.disabled = stock <= 0;
    addButton.querySelector('span').textContent = stock <= 0 ? 'Rupture' : 'Ajouter';
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
    state.cartStep = 'items';
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
    const step = state.lastOrder && lines.length === 0 ? 'confirmation' : state.cartStep;
    if (renderedCartStep !== step) {
      document.getElementById('drawer-body').scrollTop = 0;
      renderedCartStep = step;
    }
    els.cartCount.textContent = String(totalCount);

    if (state.lastOrder && lines.length === 0) {
      els.drawerTitle.textContent = 'Commande confirmée';
      els.emptyCartState.hidden = true;
      els.cartFilledState.hidden = true;
      els.orderConfirmation.hidden = false;
      return;
    }

    els.orderConfirmation.hidden = true;

    if (lines.length === 0) {
      els.emptyCartState.hidden = false;
      els.cartFilledState.hidden = true;
      els.drawerTitle.textContent = 'Mon Panier (0)';
      state.cartStep = 'items';
      return;
    }

    els.emptyCartState.hidden = true;
    els.cartFilledState.hidden = false;

    // Mise à jour des montants
    els.cartTotal.textContent = formatEuro(totalPrice);
    if (els.summarySubtotal) els.summarySubtotal.textContent = formatEuro(totalPrice);
    if (els.summaryItemsCount) els.summaryItemsCount.textContent = String(totalCount);
    if (els.checkoutMiniTotal) els.checkoutMiniTotal.textContent = formatEuro(totalPrice);
    if (els.reservationAmountText) els.reservationAmountText.textContent = formatEuro(totalPrice);
    updateSubmitOrderBtnUi(totalPrice);

    // Bascule Étape 1 (Articles) vs Étape 2 (Caisse & Paiement)
    if (state.cartStep === 'checkout') {
      if (els.cartStepItems) els.cartStepItems.hidden = true;
      if (els.cartStepCheckout) els.cartStepCheckout.hidden = false;
      els.drawerTitle.textContent = 'Caisse & Paiement';
    } else {
      if (els.cartStepItems) els.cartStepItems.hidden = false;
      if (els.cartStepCheckout) els.cartStepCheckout.hidden = true;
      els.drawerTitle.textContent = `Mon Panier (${totalCount})`;
    }

    els.cartItemsList.innerHTML = lines.map(({ product, size, qty, lineTotal }) => `
      <li class="cart-item">
        <img src="${product.image}" alt="${escapeHtml(product.name)}" class="cart-item-img" />
        <div class="cart-item-info">
          <p class="cart-item-title">${escapeHtml(product.name)}</p>
          <div class="cart-item-meta">Taille : <strong>${escapeHtml(size)}</strong></div>
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
    activateOverlay(els.cartDrawer);
  }

  function closeCartDrawer() {
    els.cartBackdrop.classList.remove('is-open');
    els.cartBackdrop.setAttribute('aria-hidden', 'true');
    deactivateOverlay(els.cartDrawer);
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

    const galleryImages = Array.isArray(product.images) && product.images.length > 0
      ? product.images
      : (product.id === 'rashguard-mc'
          ? [
              { src: 'assets/rashguard-mc-front-white.jpg', label: 'Face' },
              { src: 'assets/rashguard-mc-back-white.jpg', label: 'Dos' },
              { src: 'assets/rashguard-luta-livre.jpg', label: 'Vue 360°' }
            ]
          : product.id === 'rashguard-camo'
            ? [
                { src: 'assets/rashguard-camo-front-white.jpg', label: 'Face' },
                { src: 'assets/rashguard-camo-back-white.jpg', label: 'Dos' },
                { src: 'assets/rashguard-camo.jpg', label: 'Vue 360°' }
              ]
            : [
                { src: product.image || 'assets/gants-mma.jpg', label: 'Face' }
              ]);

    let activeImageIndex = 0;

    els.productModalContent.innerHTML = `
      <div class="product-modal-grid">
        <div class="product-modal-gallery">
          <div class="product-gallery-viewport" id="modal-gallery-viewport">
            <div class="product-gallery-track" id="modal-gallery-track">
              ${galleryImages.map((img, i) => `
                <div class="product-gallery-slide ${i === 0 ? 'is-active' : ''}" data-slide-index="${i}">
                  <img src="${img.src}" alt="${escapeHtml(product.name)} - ${escapeHtml(img.label)}" class="product-modal-img" />
                </div>
              `).join('')}
            </div>
            ${galleryImages.length > 1 ? `
              <button type="button" class="gallery-arrow gallery-prev" id="gallery-prev-btn" aria-label="Image précédente">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <button type="button" class="gallery-arrow gallery-next" id="gallery-next-btn" aria-label="Image suivante">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
              <div class="gallery-counter" id="gallery-counter">1 / ${galleryImages.length}</div>
            ` : ''}
          </div>
          ${galleryImages.length > 1 ? `
            <div class="gallery-nav-pills" id="gallery-nav-pills">
              ${galleryImages.map((img, i) => `
                <button type="button" class="gallery-pill-btn ${i === 0 ? 'is-active' : ''}" data-target-slide="${i}">
                  <span>${escapeHtml(img.label)}</span>
                </button>
              `).join('')}
            </div>
          ` : ''}
        </div>
        <div class="product-modal-info">
          <h2 id="modal-product-title" class="product-modal-heading">${escapeHtml(product.name)}</h2>
          <div class="product-modal-price">${formatEuro(product.price)}</div>

          <div class="size-picker-label">
            <span>Taille sélectionnée : <strong id="modal-size-text">${escapeHtml(modalSize)}</strong></span>
            <span id="modal-stock-label">${formatStockLabel(modalStock)}</span>
          </div>
          <div class="size-pills" id="modal-size-pills">${sizePills}</div>

          <div class="product-modal-cta">
            <button type="button" class="btn btn-primary btn-full btn-lg" id="modal-add-btn" ${modalStock <= 0 ? 'disabled' : ''}>
              <span>${modalStock <= 0 ? 'Rupture de stock' : `Ajouter au panier — ${formatEuro(product.price)}`}</span>
            </button>
          </div>
        </div>
      </div>
    `;

    const track = document.getElementById('modal-gallery-track');
    const prevBtn = document.getElementById('gallery-prev-btn');
    const nextBtn = document.getElementById('gallery-next-btn');
    const counter = document.getElementById('gallery-counter');
    const pills = document.querySelectorAll('.gallery-pill-btn');
    const viewport = document.getElementById('modal-gallery-viewport');

    function updateGallery(index) {
      if (galleryImages.length <= 1) return;
      activeImageIndex = (index + galleryImages.length) % galleryImages.length;
      if (track) {
        track.style.transform = `translateX(-${activeImageIndex * 100}%)`;
      }
      if (counter) {
        counter.textContent = `${activeImageIndex + 1} / ${galleryImages.length}`;
      }
      pills.forEach((p, idx) => {
        p.classList.toggle('is-active', idx === activeImageIndex);
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        updateGallery(activeImageIndex - 1);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        updateGallery(activeImageIndex + 1);
      });
    }

    pills.forEach((pill) => {
      pill.addEventListener('click', () => {
        const target = Number(pill.dataset.targetSlide);
        if (!isNaN(target)) updateGallery(target);
      });
    });

    if (viewport && galleryImages.length > 1) {
      let touchStartX = 0;
      let touchStartY = 0;
      viewport.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }, { passive: true });

      viewport.addEventListener('touchend', (e) => {
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        const deltaY = e.changedTouches[0].clientY - touchStartY;
        if (Math.abs(deltaX) > 35 && Math.abs(deltaX) > Math.abs(deltaY)) {
          if (deltaX < 0) updateGallery(activeImageIndex + 1);
          else updateGallery(activeImageIndex - 1);
        }
      }, { passive: true });
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
      modalAddBtn.innerHTML = `<span>${qty <= 0 ? 'Rupture de stock' : `Ajouter au panier — ${formatEuro(product.price)}`}</span>`;
      pillsWrap.querySelectorAll('.size-pill').forEach((p) => {
        p.classList.toggle('is-selected', p.dataset.modalSize === modalSize);
      });
      updateProductSelection(product.id);
    });

    modalAddBtn.addEventListener('click', (e) => {
      addToCart(product.id, modalSize, e.currentTarget);
      closeProductModal();
      openCartDrawer();
    });

    els.productModalBackdrop.classList.add('is-open');
    els.productModalBackdrop.setAttribute('aria-hidden', 'false');
    activateOverlay(els.productModalBackdrop);
  }

  function closeProductModal() {
    deactivateOverlay(els.productModalBackdrop);
  }

  function openSizeGuide() {
    els.sizeGuideBackdrop.classList.add('is-open');
    els.sizeGuideBackdrop.setAttribute('aria-hidden', 'false');
    activateOverlay(els.sizeGuideBackdrop);
  }

  function closeSizeGuide() {
    deactivateOverlay(els.sizeGuideBackdrop);
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
    const memberName = state.member
      ? state.member.name
      : String(formData.get('memberName') || '').trim();
    const memberPhone = state.member
      ? (state.member.phone || String(formData.get('memberPhone') || '').trim())
      : String(formData.get('memberPhone') || '').trim();
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
    if (labelSpan) labelSpan.textContent = isClub ? 'Confirmer la commande' : 'Valider et Payer';
    if (badgeSpan) badgeSpan.textContent = formatEuro(totalPrice);
  }

  function displayOrderConfirmation(order) {
    const text = buildOrderPlainText(order);
    if (els.confirmOrderRef) {
      els.confirmOrderRef.textContent = `Réf. ${order.ref}`;
    }
    if (els.confirmSummaryCard) {
      els.confirmSummaryCard.textContent = text;
    }

    const isClub = (order.paymentMethod || '').toLowerCase().includes('retrait');
    const noticeEl = els.confirmNotice || document.getElementById('confirm-notice') || document.querySelector('.confirm-notice');
    if (noticeEl) {
      if (isClub) {
        noticeEl.className = 'confirm-notice is-reservation';
        noticeEl.innerHTML = `<strong>Commande enregistrée !</strong> Règlement de <strong>${formatEuro(order.total)}</strong> directement au dojo lors du retrait.`;
      } else {
        noticeEl.className = 'confirm-notice is-paid';
        noticeEl.innerHTML = `<strong>Paiement validé !</strong> Votre commande de <strong>${formatEuro(order.total)}</strong> est confirmée.`;
      }
    }

    if (els.confirmOrderCard) {
      els.confirmOrderCard.innerHTML = `
        <div class="confirm-items-list">
          ${order.items.map((it) => `
            <div class="confirm-item-row">
              ${it.image ? `<img src="${it.image}" alt="${escapeHtml(it.name)}" class="confirm-item-thumb" onerror="this.style.display='none'" />` : ''}
              <div class="confirm-item-info">
                <p class="confirm-item-name">${escapeHtml(it.name)}</p>
                <div class="confirm-item-meta">Taille <strong>${escapeHtml(it.size)}</strong> · Qté ${it.qty}</div>
              </div>
              <div class="confirm-item-price">${formatEuro(it.lineTotal || (it.price * it.qty))}</div>
            </div>
          `).join('')}
        </div>
        <div class="confirm-meta-details">
          <div class="confirm-meta-line"><span>Adhérent :</span><strong>${escapeHtml(order.memberName || 'Client')}</strong></div>
          ${order.memberPhone ? `<div class="confirm-meta-line"><span>Téléphone :</span><strong>${escapeHtml(order.memberPhone)}</strong></div>` : ''}
          <div class="confirm-meta-line"><span>Règlement :</span><strong>${isClub ? 'Réservation (Paiement au club)' : 'Carte Bancaire (En ligne)'}</strong></div>
        </div>
        <div class="confirm-total-box">
          <span class="confirm-total-label">Total TTC</span>
          <span class="confirm-total-val">${formatEuro(order.total)}</span>
        </div>
      `;
    }

    const encodedText = encodeURIComponent(text);
    const cleanPhone = (state.settings.whatsapp || '').replace(/\D/g, '');
    if (els.sendWhatsappBtn) {
      els.sendWhatsappBtn.href = cleanPhone
        ? `https://wa.me/${cleanPhone}?text=${encodedText}`
        : `https://wa.me/?text=${encodedText}`;
    }

    // Déclenchement de l'animation de célébration fluide
    triggerConfirmationCelebration();
  }

  function triggerConfirmationCelebration() {
    if (prefersReducedMotion()) return;
    const headBox = document.querySelector('.confirm-head-box');
    if (!headBox) return;

    const colors = ['#e5b24c', '#22c55e', '#ffffff', '#f59e0b', '#34d399'];
    const count = 30;

    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'celebration-particle';

      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const distance = 45 + Math.random() * 95;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance - 15;
      const size = 5 + Math.random() * 6;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const rot = (Math.random() - 0.5) * 600;

      p.style.width = `${size}px`;
      p.style.height = `${size}px`;
      p.style.backgroundColor = color;
      p.style.setProperty('--tx', `${tx}px`);
      p.style.setProperty('--ty', `${ty}px`);
      p.style.setProperty('--rot', `${rot}deg`);
      p.style.left = '50%';
      p.style.top = '35px';

      headBox.appendChild(p);
      setTimeout(() => p.remove(), 1250);
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

      // Synchronisation avec les champs de commande
      const nameInput = document.getElementById('member-name');
      const phoneInput = document.getElementById('member-phone');
      if (nameInput) {
        nameInput.value = state.member.name;
        nameInput.removeAttribute('required');
      }
      if (phoneInput) {
        phoneInput.value = state.member.phone || '';
        phoneInput.removeAttribute('required');
      }

      // Affichage de la carte adhérent dans la caisse
      if (els.checkoutLoggedUserBox) els.checkoutLoggedUserBox.hidden = false;
      if (els.checkoutAuthRequiredBox) els.checkoutAuthRequiredBox.hidden = true;
      if (els.checkoutPaymentSection) els.checkoutPaymentSection.hidden = false;
      if (els.checkoutMemberAvatar) els.checkoutMemberAvatar.textContent = initials;
      if (els.checkoutMemberNameLabel) els.checkoutMemberNameLabel.textContent = state.member.name;
      if (els.checkoutMemberPhoneLabel) els.checkoutMemberPhoneLabel.textContent = `📱 ${state.member.phone || 'Adhérent Club'}`;
    } else {
      els.accountBtn.classList.remove('is-logged');
      els.accountBtnLabel.textContent = 'Espace Adhérent';
      els.accountBtnAvatar.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>`;

      // Si déconnecté, afficher le bloc compte obligatoire et masquer le paiement direct
      if (els.checkoutLoggedUserBox) els.checkoutLoggedUserBox.hidden = true;
      if (els.checkoutAuthRequiredBox) els.checkoutAuthRequiredBox.hidden = false;
      if (els.checkoutPaymentSection) els.checkoutPaymentSection.hidden = true;
      const nameInput = document.getElementById('member-name');
      const phoneInput = document.getElementById('member-phone');
      if (nameInput) nameInput.value = '';
      if (phoneInput) phoneInput.value = '';
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
          <div style="font-size:2rem;margin-bottom:0.5rem;">🥋</div>
          <p><strong>Aucune commande enregistrée</strong></p>
          <p style="font-size:0.85rem;color:rgba(255,255,255,0.7);margin-bottom:1rem;">Dès que vous passez commande, votre reçu officiel PDF avec numéro légal sera centralisé ici.</p>
          <button type="button" class="btn btn-primary btn-sm" id="btn-browse-from-account">Découvrir les équipements</button>
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

    const headerNotice = `
      <div class="account-central-receipts-notice">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        <div>
          <strong>Reçus Officiels Centralisés</strong>
          <p>Tous vos reçus PDF avec numéro de commande légal sont sauvegardés ici à vie. Vous pouvez les télécharger ou les présenter sur smartphone lors du retrait.</p>
        </div>
      </div>
    `;

    const ordersHtml = state.memberOrders.map((order) => {
      const isOnline = (order.paymentMethod || '').toLowerCase().includes('en ligne');
      const statusLabel = isOnline ? '✓ Payé CB (En ligne)' : '⚠️ Réservation (À régler au dojo)';
      const statusClass = isOnline ? 'is-paid' : 'is-reserved';

      return `
        <div class="member-order-card">
          <div class="member-order-header">
            <div>
              <span class="member-order-ref">${escapeHtml(order.ref)}</span>
              <span class="member-order-status-pill ${statusClass}">${statusLabel}</span>
            </div>
            <span class="member-order-date">${escapeHtml(order.dateLabel || (order.createdAt ? new Date(order.createdAt).toLocaleDateString('fr-FR') : ''))}</span>
          </div>

          <div class="member-order-items-list">
            ${(order.items || []).map((it) => `
              <div class="member-order-item-row">
                <span class="item-name">${escapeHtml(it.name)}</span>
                <span class="item-size-pill">Taille ${escapeHtml(it.size)}</span>
                <span class="item-qty">Qté ${it.qty}</span>
                <strong class="item-price">${formatEuro(it.lineTotal || (it.price * it.qty))}</strong>
              </div>
            `).join('')}
          </div>

          <div class="member-order-footer">
            <div class="member-order-total-wrap">
              <span class="total-label">Total :</span>
              <strong class="member-order-total">${formatEuro(order.total || 0)}</strong>
            </div>
            <button type="button" class="btn btn-primary btn-sm btn-receipt-pdf" data-order-ref="${escapeHtml(order.ref)}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              <span>Télécharger mon reçu PDF</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    els.memberOrdersContainer.innerHTML = headerNotice + ordersHtml;
  }

  function generateReceiptPdf(order) {
    if (!order) return;
    const isOnline = (order.paymentMethod || '').toLowerCase().includes('en ligne');
    const clubName = state.settings.clubName || 'DORAGON DOJO CLUB';
    const dateFormatted = order.dateLabel || new Date(order.createdAt || Date.now()).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

    const rowsHtml = (order.items || []).map((i) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#111827;">${escapeHtml(i.name)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:700;color:#071326;">${escapeHtml(i.size)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;color:#374151;">${i.qty}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#374151;">${formatEuro(i.lineTotal / (i.qty || 1))}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;color:#111827;">${formatEuro(i.lineTotal)}</td>
      </tr>
    `).join('');

    const statusBadgeHtml = isOnline
      ? `<div style="display:inline-block;padding:6px 14px;background:#dcfce7;color:#15803d;border:1.5px solid #86efac;border-radius:999px;font-weight:800;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">✓ Payé en ligne par Carte Bancaire</div>`
      : `<div style="display:inline-block;padding:6px 14px;background:#fef3c7;color:#b45309;border:1.5px solid #fcd34d;border-radius:999px;font-weight:800;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">⚠️ Réservation — À régler au dojo</div>`;

    const instructionsHtml = isOnline
      ? `<p style="margin:0;font-size:12px;color:#374151;line-height:1.5;">Votre règlement a été effectué en ligne avec succès. Vous pouvez retirer votre équipement dès votre prochain cours à l'accueil du dojo sur présentation de ce reçu.</p>`
      : `<p style="margin:0;font-size:12px;color:#b45309;line-height:1.5;"><strong>Rappel réservation :</strong> Vos articles sont réservés et bloqués au club. Veuillez prévoir votre règlement de <strong>${formatEuro(order.total)}</strong> (en Espèces ou par Carte Bancaire) lors de votre prochain entraînement pour récupérer vos équipements.</p>`;

    const receiptHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Reçu Officiel - ${escapeHtml(order.ref)} - ${escapeHtml(clubName)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 15mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #111827; background: #ffffff; margin: 0; padding: 24px; font-size: 13px; line-height: 1.45; }
    .receipt-container { max-width: 680px; margin: 0 auto; border: 1.5px solid #e5e7eb; border-radius: 12px; padding: 30px; box-shadow: 0 4px 18px rgba(0,0,0,0.06); }
    @media print {
      body { padding: 0; }
      .receipt-container { border: none; box-shadow: none; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #071326;padding-bottom:20px;margin-bottom:22px;">
      <div style="display:flex;align-items:center;gap:14px;">
        <img src="${window.location.origin}/assets/logo.jpg" alt="Logo" style="width:58px;height:58px;object-fit:contain;border-radius:8px;border:1px solid #e5e7eb;" onerror="this.style.display='none'">
        <div>
          <h1 style="font-size:22px;font-weight:900;color:#071326;margin:0 0 3px;letter-spacing:-0.02em;">${escapeHtml(clubName)}</h1>
          <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;color:#d97706;">Boutique Officielle des Adhérents · Reçu & Bon de Retrait</div>
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280;letter-spacing:0.06em;">Numéro de commande</div>
        <div style="font-size:20px;font-weight:900;color:#071326;font-family:monospace;margin-top:2px;">${escapeHtml(order.ref)}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:4px;">Date : ${escapeHtml(dateFormatted)}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 18px;margin-bottom:24px;">
      <div>
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:6px;">Bénéficiaire / Adhérent</div>
        <div style="font-size:15px;font-weight:800;color:#111827;">${escapeHtml(order.memberName)}</div>
        ${order.memberPhone ? `<div style="font-size:12px;color:#4b5563;margin-top:3px;">Tél : <strong>${escapeHtml(order.memberPhone)}</strong></div>` : ''}
        ${order.memberEmail ? `<div style="font-size:12px;color:#4b5563;">Email : ${escapeHtml(order.memberEmail)}</div>` : ''}
        ${order.memberNote ? `<div style="font-size:12px;color:#6b7280;margin-top:4px;"><em>Remarque : ${escapeHtml(order.memberNote)}</em></div>` : ''}
      </div>
      <div style="text-align:right;">
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:6px;">Statut du règlement</div>
        ${statusBadgeHtml}
        <div style="font-size:11px;color:#6b7280;margin-top:8px;">Lieu de remise : <strong>Accueil du Dojo</strong></div>
      </div>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <thead>
        <tr style="background:#071326;color:#ffffff;">
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;border-radius:6px 0 0 0;">Description</th>
          <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;">Taille</th>
          <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;">Qté</th>
          <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;">Prix unitaire</th>
          <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;border-radius:0 6px 0 0;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div style="display:flex;justify-content:space-between;align-items:center;background:#071326;color:#ffffff;border-radius:8px;padding:14px 20px;margin-bottom:24px;">
      <div style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#e5e7eb;">Total de la commande</div>
      <div style="font-size:24px;font-weight:900;color:#fbbf24;letter-spacing:-0.02em;">${formatEuro(order.total)}</div>
    </div>

    <div style="border:1px dashed #d1d5db;border-radius:8px;padding:14px 16px;background:#fafafa;margin-bottom:18px;">
      <div style="font-size:12px;font-weight:800;color:#111827;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em;">Instructions officielles de retrait</div>
      ${instructionsHtml}
    </div>

    <div style="text-align:center;color:#9ca3af;font-size:10px;border-top:1px solid #f3f4f6;padding-top:14px;">
      ${escapeHtml(clubName)} · Document certifié officiel · Réf. commande : ${escapeHtml(order.ref)}
    </div>
  </div>
</body>
</html>`;

    const printWin = window.open('', '_blank');
    if (!printWin) {
      showToast('Veuillez autoriser les pop-ups pour télécharger votre reçu PDF.');
      return;
    }
    printWin.document.open();
    printWin.document.write(receiptHtml);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 350);
  }

  function openAccountModal(targetTab, origin = 'header') {
    if (!els.accountModalBackdrop) return;
    state.authOrigin = origin;
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
    activateOverlay(els.accountModalBackdrop);
  }

  function closeAccountModal() {
    if (!els.accountModalBackdrop) return;
    deactivateOverlay(els.accountModalBackdrop);
    if (els.loginErrorMsg) els.loginErrorMsg.hidden = true;
    if (els.registerErrorMsg) els.registerErrorMsg.hidden = true;
    if (els.profileSuccessMsg) els.profileSuccessMsg.hidden = true;
    if (els.profileErrorMsg) els.profileErrorMsg.hidden = true;
  }

  function switchGuestTab(tab) {
    els.accountModalBackdrop.querySelector('.account-scroll-body').scrollTop = 0;
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
    els.accountModalBackdrop.querySelector('.account-scroll-body').scrollTop = 0;
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
      saveJson(STORAGE_KEYS.MEMBER, state.member);
      updateMemberUi();
      applyMemberPreferences();
      showToast(`Bienvenue ${state.member.name} !`);

      if (state.authOrigin === 'checkout') {
        closeAccountModal();
        if (state.cart && state.cart.length > 0) {
          state.cartStep = 'checkout';
          renderCart();
          openCartDrawer();
        }
      } else {
        openAccountModal('orders', 'header');
      }
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
      saveJson(STORAGE_KEYS.MEMBER, state.member);
      updateMemberUi();
      applyMemberPreferences();
      showToast('Votre compte adhérent a été créé avec succès !');

      if (state.authOrigin === 'checkout') {
        closeAccountModal();
        if (state.cart && state.cart.length > 0) {
          state.cartStep = 'checkout';
          renderCart();
          openCartDrawer();
        }
      } else {
        openAccountModal('orders', 'header');
      }
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
    try { localStorage.removeItem(STORAGE_KEYS.MEMBER); } catch {}
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
      saveJson(STORAGE_KEYS.MEMBER, state.member);
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
        updateProductSelection(productId);
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

    if (els.btnGotoCheckout) {
      els.btnGotoCheckout.addEventListener('click', () => {
        if (!state.member) {
          openAccountModal('register', 'checkout');
          showToast('Compte adhérent requis pour commander.');
          return;
        }
        state.cartStep = 'checkout';
        renderCart();
      });
    }

    if (els.btnGotoAccountReceipts) {
      els.btnGotoAccountReceipts.addEventListener('click', () => {
        closeCartDrawer();
        openAccountModal('orders', 'header');
      });
    }

    if (els.btnBackToItems) {
      els.btnBackToItems.addEventListener('click', () => {
        state.cartStep = 'items';
        renderCart();
      });
    }

    if (els.btnSwitchAccountCheckout) {
      els.btnSwitchAccountCheckout.addEventListener('click', () => openAccountModal('profile', 'checkout'));
    }
    if (els.btnCheckoutLogin) {
      els.btnCheckoutLogin.addEventListener('click', () => openAccountModal('login', 'checkout'));
    }
    if (els.btnCheckoutRegister) {
      els.btnCheckoutRegister.addEventListener('click', () => openAccountModal('register', 'checkout'));
    }

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

    if (els.copyOrderBtn) {
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
    }

    els.printOrderBtn.addEventListener('click', () => {
      if (state.lastOrder) {
        generateReceiptPdf(state.lastOrder);
      } else {
        window.print();
      }
    });

    if (els.memberOrdersContainer) {
      els.memberOrdersContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-receipt-pdf');
        if (!btn) return;
        const ref = btn.dataset.orderRef;
        const found = (state.memberOrders || []).find((o) => o.ref === ref) || (state.orders || []).find((o) => o.ref === ref);
        if (found) {
          generateReceiptPdf(found);
        } else {
          showToast('Commande introuvable.');
        }
      });
    }

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
      const active = topOverlay();
      if (!active) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeTopOverlay();
      } else if (e.key === 'Tab') {
        const controls = [...active.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]')]
          .filter((el) => !el.disabled && !el.closest('[inert]') && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
        const first = controls[0], last = controls[controls.length - 1];
        if (e.shiftKey && (!controls.includes(document.activeElement) || document.activeElement === first)) {
          e.preventDefault();
          if (last) last.focus();
        } else if (!e.shiftKey && (!controls.includes(document.activeElement) || document.activeElement === last)) {
          e.preventDefault();
          if (first) first.focus();
        }
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
    if (state.member) {
      updateMemberUi();
      applyMemberPreferences();
      fetch(`/api/member/orders?email=${encodeURIComponent(state.member.email)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data && Array.isArray(data.orders)) {
            state.memberOrders = data.orders;
            renderMemberOrders();
          }
        })
        .catch(() => {});
    }
    renderProducts();
    renderCart();
    bindEvents();
    syncOverlayState();
    syncCatalogAndStockFromServer();
  }

  init();
})();
