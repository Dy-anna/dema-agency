-- Contrats des personnes qui accompagnent l'agence (formation, freelance, stage, bénévolat)
CREATE TABLE IF NOT EXISTS contrats (
  id TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  telephone TEXT, email TEXT, adresse TEXT,
  profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'formation' CHECK (type IN ('formation','freelance','stage','benevole')),
  poste TEXT NOT NULL DEFAULT 'Cadreur',
  date_debut TEXT, date_fin TEXT,
  rythme TEXT,
  missions TEXT,
  remuneration TEXT NOT NULL DEFAULT 'aucune' CHECK (remuneration IN ('aucune','defraiement','forfait','jour')),
  montant REAL NOT NULL DEFAULT 0,
  accords TEXT NOT NULL DEFAULT '{}',
  statut TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon','a_signer','signe','termine','annule')),
  date_signature TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_contrats_fin ON contrats(date_fin);
