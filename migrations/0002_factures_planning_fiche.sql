-- Paramètres de l'agence (mentions légales des devis et factures)
CREATE TABLE IF NOT EXISTS parametres (
  id TEXT PRIMARY KEY,
  valeur TEXT NOT NULL DEFAULT '{}'
);

-- Factures (acompte, solde ou totale), numérotation F-AAAA-NNN
CREATE TABLE IF NOT EXISTS factures (
  id TEXT PRIMARY KEY,
  numero TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  projet_id TEXT REFERENCES projets(id) ON DELETE SET NULL,
  devis_id TEXT REFERENCES devis(id) ON DELETE SET NULL,
  paiement_id TEXT REFERENCES paiements(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'totale' CHECK (type IN ('acompte','solde','totale')),
  lignes TEXT NOT NULL DEFAULT '[]',
  montant_ht REAL NOT NULL DEFAULT 0,
  tva_taux REAL NOT NULL DEFAULT 0,
  montant_ttc REAL NOT NULL DEFAULT 0,
  date_emission TEXT NOT NULL,
  echeance TEXT,
  statut TEXT NOT NULL DEFAULT 'emise' CHECK (statut IN ('emise','payee','annulee')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_factures_client ON factures(client_id);

-- Planning : qui travaille sur quelle date
CREATE TABLE IF NOT EXISTS affectations (
  id TEXT PRIMARY KEY,
  evenement_id TEXT NOT NULL REFERENCES evenements(id) ON DELETE CASCADE,
  profile_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  nom_libre TEXT,
  poste TEXT NOT NULL DEFAULT 'cadreur',
  horaires TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_affectations_evt ON affectations(evenement_id);

-- Fiche événement détaillée (lieux, déroulé, contacts, questionnaire) en JSON
ALTER TABLE clients ADD COLUMN details TEXT NOT NULL DEFAULT '{}';
