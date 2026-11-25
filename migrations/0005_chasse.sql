-- Chasseur de têtes : clients à cibler et actions de prospection
CREATE TABLE IF NOT EXISTS cibles (
  id TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  categorie TEXT NOT NULL DEFAULT 'entreprise',
  contact_nom TEXT, contact_role TEXT, telephone TEXT, email TEXT, reseau TEXT, site TEXT,
  type_prestation TEXT NOT NULL DEFAULT 'corporate',
  priorite TEXT NOT NULL DEFAULT 'B' CHECK (priorite IN ('A','B','C')),
  potentiel REAL NOT NULL DEFAULT 0,
  source TEXT,
  statut TEXT NOT NULL DEFAULT 'a_cibler' CHECK (statut IN ('a_cibler','contacte','discussion','rdv','converti','pas_interesse')),
  responsable_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS cible_actions (
  id TEXT PRIMARY KEY,
  cible_id TEXT NOT NULL REFERENCES cibles(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'message',
  titre TEXT NOT NULL,
  echeance TEXT,
  assigne_a TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  fait INTEGER NOT NULL DEFAULT 0,
  fait_le TEXT,
  resultat TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_cible_actions_cible ON cible_actions(cible_id);
CREATE INDEX IF NOT EXISTS idx_cible_actions_echeance ON cible_actions(echeance);
