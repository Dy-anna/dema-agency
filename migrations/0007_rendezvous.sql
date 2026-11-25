-- Rendez-vous (clients, prospects, repérages, réunions) avec rappels
CREATE TABLE IF NOT EXISTS rendezvous (
  id TEXT PRIMARY KEY,
  titre TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'client',
  date TEXT NOT NULL,
  heure TEXT,
  duree INTEGER NOT NULL DEFAULT 60,
  lieu TEXT,
  visio TEXT,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  cible_id TEXT REFERENCES cibles(id) ON DELETE SET NULL,
  participants TEXT NOT NULL DEFAULT '[]',
  rappel INTEGER NOT NULL DEFAULT 60,
  rappel_le TEXT,
  statut TEXT NOT NULL DEFAULT 'prevu' CHECK (statut IN ('prevu','fait','annule')),
  notes TEXT,
  compte_rendu TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_rendezvous_date ON rendezvous(date);
