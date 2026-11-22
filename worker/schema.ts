// Généré depuis migrations/0001_init.sql : crée les tables au premier lancement si elles n'existent pas
import type { Env } from './_lib/auth'

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS profiles ( id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, nom TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT 'assistant' CHECK (role IN ('gerant','chef_projet','assistant')), password_hash TEXT NOT NULL, actif INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) )`,
  `CREATE TABLE IF NOT EXISTS sessions ( token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, expires_at TEXT NOT NULL )`,
  `CREATE TABLE IF NOT EXISTS clients ( id TEXT PRIMARY KEY, type_prestation TEXT NOT NULL DEFAULT 'mariage' CHECK (type_prestation IN ('mariage','evenementiel','corporate','shooting','autre')), nom TEXT NOT NULL, contact TEXT, telephone TEXT, email TEXT, adresse TEXT, date_evenement TEXT, statut_commercial TEXT NOT NULL DEFAULT 'prospect' CHECK (statut_commercial IN ('prospect','client','perdu')), rdv_effectue_le TEXT, notes TEXT, created_by TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) )`,
  `CREATE TABLE IF NOT EXISTS devis ( id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE, numero TEXT, statut TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon','envoye','negociation','signe','refuse')), lignes TEXT NOT NULL DEFAULT '[]', montant REAL NOT NULL DEFAULT 0, date_envoi TEXT, date_signature TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) )`,
  `CREATE TABLE IF NOT EXISTS projets ( id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE, devis_id TEXT REFERENCES devis(id) ON DELETE SET NULL, titre TEXT NOT NULL, type_prestation TEXT NOT NULL DEFAULT 'mariage', date_evenement TEXT, statut TEXT NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente','production','livre')), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) )`,
  `CREATE TABLE IF NOT EXISTS taches ( id TEXT PRIMARY KEY, projet_id TEXT NOT NULL REFERENCES projets(id) ON DELETE CASCADE, groupe TEXT NOT NULL DEFAULT 'Général', titre TEXT NOT NULL, fait INTEGER NOT NULL DEFAULT 0, assigne_a TEXT REFERENCES profiles(id) ON DELETE SET NULL, ordre INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) )`,
  `CREATE TABLE IF NOT EXISTS paiements ( id TEXT PRIMARY KEY, projet_id TEXT NOT NULL REFERENCES projets(id) ON DELETE CASCADE, libelle TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'versement' CHECK (type IN ('acompte','versement','solde')), montant REAL NOT NULL DEFAULT 0, echeance TEXT, recu INTEGER NOT NULL DEFAULT 0, recu_le TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) )`,
  `CREATE TABLE IF NOT EXISTS evenements ( id TEXT PRIMARY KEY, titre TEXT NOT NULL, date TEXT NOT NULL, type_prestation TEXT NOT NULL DEFAULT 'mariage', statut TEXT NOT NULL DEFAULT 'previsionnel' CHECK (statut IN ('previsionnel','confirme','annule')), client_id TEXT REFERENCES clients(id) ON DELETE SET NULL, projet_id TEXT REFERENCES projets(id) ON DELETE SET NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) )`,
  `CREATE TABLE IF NOT EXISTS objectifs ( id TEXT PRIMARY KEY, annee INTEGER NOT NULL, periode TEXT NOT NULL CHECK (periode IN ('annee','trimestre','mois')), numero INTEGER NOT NULL DEFAULT 0, indicateur TEXT NOT NULL CHECK (indicateur IN ('ca_signe','ca_encaisse','prospects','rdv','signes')), cible REAL NOT NULL DEFAULT 0, UNIQUE (annee, periode, numero, indicateur) )`,
  `CREATE INDEX IF NOT EXISTS idx_devis_client ON devis(client_id)`,
  `CREATE INDEX IF NOT EXISTS idx_projets_client ON projets(client_id)`,
  `CREATE INDEX IF NOT EXISTS idx_taches_projet ON taches(projet_id)`,
  `CREATE INDEX IF NOT EXISTS idx_paiements_projet ON paiements(projet_id)`,
  `CREATE INDEX IF NOT EXISTS idx_evenements_date ON evenements(date)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,
]

let ready: Promise<void> | null = null

export function ensureSchema(env: Env) {
  if (!ready) {
    ready = env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s))).then(() => undefined).catch((e) => { ready = null; throw e })
  }
  return ready
}
