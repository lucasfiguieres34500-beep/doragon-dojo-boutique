((root) => {
  'use strict';

  const DEFAULT_SETTINGS = {
    clubName: 'DORAGON DOJO CLUB',
    whatsapp: '',
    email: 'adherent.doragon@gmail.com',
    footerNote: ''
  };

  const PRODUCTS = [
    {
      id: 'rashguard-mc',
      category: 'rashguard',
      categoryLabel: 'Rashguard',
      name: 'Rashguard Édition Luta Livre',
      price: 40,
      image: 'assets/rashguard-mc-front-white.jpg',
      images: [
        { src: 'assets/rashguard-mc-front-white.jpg', label: 'Face' },
        { src: 'assets/rashguard-mc-back-white.jpg', label: 'Dos' },
        { src: 'assets/rashguard-luta-livre.jpg', label: 'Vue 360°' }
      ],
      badge: '',
      shortDesc: '',
      description: '',
      sizeLabel: 'Taille',
      sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
      defaultSize: 'M',
      specs: [
        'Tissu compression 4-way stretch respirant et ultra-résistant',
        'Impression intégrale par sublimation inaltérable (face, dos, manches)',
        'Coutures plates renforcées anti-frottements pour le combat'
      ]
    },
    {
      id: 'rashguard-camo',
      category: 'rashguard',
      categoryLabel: 'Rashguard',
      name: 'Rashguard Édition Camo Wave',
      price: 40,
      image: 'assets/rashguard-camo-front-white.jpg',
      images: [
        { src: 'assets/rashguard-camo-front-white.jpg', label: 'Face' },
        { src: 'assets/rashguard-camo-back-white.jpg', label: 'Dos' },
        { src: 'assets/rashguard-camo.jpg', label: 'Vue 360°' }
      ],
      badge: '',
      shortDesc: '',
      description: '',
      sizeLabel: 'Taille',
      sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
      defaultSize: 'M',
      specs: [
        'Tissu compression 4-way stretch respirant et ultra-résistant',
        'Impression intégrale par sublimation inaltérable (face, dos, manches)',
        'Coutures plates renforcées anti-frottements pour le combat'
      ]
    },
    {
      id: 'gants-mma',
      category: 'gants',
      categoryLabel: 'Gants MMA',
      name: 'Gants MMA / Grappling',
      price: 50,
      image: 'assets/gants-mma.jpg',
      images: [
        { src: 'assets/gants-mma.jpg', label: 'Face' }
      ],
      badge: '',
      shortDesc: '',
      description: '',
      sizeLabel: 'Taille',
      sizes: ['S/M', 'L/XL'],
      defaultSize: 'S/M',
      specs: [
        'Paume ouverte et pouce articulé pour saisies et soumissions',
        'Rembourrage mousse haute densité préformé sur les métacarpes',
        'Fermeture poignet par large bande velcro renforcée'
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
    root.ClubCatalog = exported;
  }
})(typeof window !== 'undefined' ? window : globalThis);
