((root) => {
  'use strict';

  const DEFAULT_SETTINGS = {
    clubName: 'DORAGON DOJO CLUB',
    whatsapp: '',
    email: 'boutique@monclub.fr',
    footerNote: 'Retrait et règlement directement au club.'
  };

  const PRODUCTS = [
    {
      id: 'rashguard-mc',
      category: 'rashguard',
      categoryLabel: 'Rashguard',
      name: 'Rashguard Manche Courte',
      price: 40,
      image: 'assets/rashguard-mc-front-white.jpg',
      backImage: 'assets/rashguard-mc-back-white.jpg',
      shortDesc: 'Édition LUTA LIVRE — DORAGON DOJO CLUB avec soleil levant, Mont Fuji et dragon intégral face/dos.',
      sizeLabel: 'Taille',
      sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
      defaultSize: 'M',
      specs: [
        'Design intégral face, dos et manches imprimé par sublimation',
        'Matière légère à séchage ultra-rapide',
        'Coutures plates renforcées pour grappling et MMA',
        'Lavable en machine à 30 °C'
      ]
    },
    {
      id: 'gants-mma',
      category: 'gants',
      categoryLabel: 'Gants MMA',
      name: 'Gants MMA / Grappling',
      price: 50,
      image: 'assets/gants-mma.jpg',
      shortDesc: 'Paume ouverte ergonomique pour saisie & soumissions.',
      sizeLabel: 'Taille',
      sizes: ['S/M', 'L/XL'],
      defaultSize: 'L/XL',
      specs: [
        'Paume ouverte et pouce articulé pour saisie et grappling',
        'Rembourrage dense préformé sur les phalanges',
        'Large serrage velcro blanc renforcé au poignet',
        'Doublure intérieure anti-glisse',
        'Coloris vagues rouge, blanc et bleu'
      ]
    }
  ];

  function createDefaultStock(defaultQty = 5, products = PRODUCTS) {
    const stock = {};
    products.forEach((product) => {
      stock[product.id] = {};
      (product.sizes || []).forEach((size) => {
        stock[product.id][size] = defaultQty;
      });
    });
    return stock;
  }

  function normalizeStock(rawStock, products = PRODUCTS) {
    const base = createDefaultStock(5, products);
    if (!rawStock || typeof rawStock !== 'object') return base;
    products.forEach((product) => {
      const incoming = rawStock[product.id];
      if (!incoming || typeof incoming !== 'object') return;
      (product.sizes || []).forEach((size) => {
        const val = Number(incoming[size]);
        if (Number.isFinite(val) && val >= 0) {
          base[product.id][size] = Math.floor(val);
        }
      });
    });
    return base;
  }

  const exported = {
    DEFAULT_SETTINGS,
    PRODUCTS,
    createDefaultStock,
    normalizeStock
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  } else {
    root.CLUB_CATALOG = exported;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
