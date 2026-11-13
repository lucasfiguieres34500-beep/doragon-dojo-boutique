-- ============================================================
-- DORAGON DOJO CLUB — SCHÉMA DE BASE DE DONNÉES SUPABASE
-- Copier-coller ce script dans le SQL Editor de Supabase
-- et cliquer sur "RUN".
-- ============================================================

-- 1. Table des Adhérents (Comptes membres sécurisés)
CREATE TABLE IF NOT EXISTS public.members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    favorite_rashguard_size TEXT DEFAULT 'M',
    favorite_gloves_size TEXT DEFAULT 'L/XL',
    salt TEXT NOT NULL,
    hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche ultra-rapide par email
CREATE INDEX IF NOT EXISTS idx_members_email ON public.members (LOWER(email));

-- 2. Table des Commandes & Reçus
CREATE TABLE IF NOT EXISTS public.orders (
    ref TEXT PRIMARY KEY,
    member_id TEXT REFERENCES public.members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    date_label TEXT NOT NULL,
    member_name TEXT NOT NULL,
    member_email TEXT NOT NULL,
    member_phone TEXT,
    payment_method TEXT NOT NULL,
    payment_status TEXT NOT NULL,
    member_note TEXT,
    total NUMERIC(10, 2) NOT NULL,
    items JSONB NOT NULL
);

-- Index pour filtrer instantanément les commandes par adhérent
CREATE INDEX IF NOT EXISTS idx_orders_member_id ON public.orders (member_id);
CREATE INDEX IF NOT EXISTS idx_orders_member_email ON public.orders (LOWER(member_email));

-- 3. Table des Produits
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    image TEXT NOT NULL,
    description TEXT,
    badge TEXT,
    sizes JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Table du Stock en temps réel
CREATE TABLE IF NOT EXISTS public.stock (
    product_id TEXT NOT NULL,
    size TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (product_id, size)
);

-- ============================================================
-- SÉCURITÉ & PERMISSIONS (Row Level Security)
-- Permet au backend Node.js (via Service Key ou Anon Key) de lire/écrire
-- ============================================================
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock ENABLE ROW LEVEL SECURITY;

-- Politiques pour autoriser l'API du dojo
CREATE POLICY "Permettre tout accès aux membres pour l'API du club"
ON public.members FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Permettre tout accès aux commandes pour l'API du club"
ON public.orders FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Lecture publique des produits"
ON public.products FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Lecture et mise à jour du stock"
ON public.stock FOR ALL USING (true) WITH CHECK (true);
