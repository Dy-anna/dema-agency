-- Tâches libres entre membres (facture, devis, tâche, note) avec deadline et rappels jusqu'à ce qu'elles soient faites
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  titre TEXT NOT NULL,
  details TEXT,
  categorie TEXT NOT NULL DEFAULT 'tache',
  echeance TEXT,
  heure TEXT,
  assigne_a TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  cree_par TEXT,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  fait INTEGER NOT NULL DEFAULT 0,
  fait_le TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_todos_assigne ON todos(assigne_a, fait);
