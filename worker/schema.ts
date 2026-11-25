// Généré depuis migrations/*.sql : crée/complète les tables au premier lancement
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
  `CREATE TABLE IF NOT EXISTS parametres ( id TEXT PRIMARY KEY, valeur TEXT NOT NULL DEFAULT '{}' )`,
  `CREATE TABLE IF NOT EXISTS factures ( id TEXT PRIMARY KEY, numero TEXT NOT NULL UNIQUE, client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE, projet_id TEXT REFERENCES projets(id) ON DELETE SET NULL, devis_id TEXT REFERENCES devis(id) ON DELETE SET NULL, paiement_id TEXT REFERENCES paiements(id) ON DELETE SET NULL, type TEXT NOT NULL DEFAULT 'totale' CHECK (type IN ('acompte','solde','totale')), lignes TEXT NOT NULL DEFAULT '[]', montant_ht REAL NOT NULL DEFAULT 0, tva_taux REAL NOT NULL DEFAULT 0, montant_ttc REAL NOT NULL DEFAULT 0, date_emission TEXT NOT NULL, echeance TEXT, statut TEXT NOT NULL DEFAULT 'emise' CHECK (statut IN ('emise','payee','annulee')), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) )`,
  `CREATE INDEX IF NOT EXISTS idx_factures_client ON factures(client_id)`,
  `CREATE TABLE IF NOT EXISTS affectations ( id TEXT PRIMARY KEY, evenement_id TEXT NOT NULL REFERENCES evenements(id) ON DELETE CASCADE, profile_id TEXT REFERENCES profiles(id) ON DELETE CASCADE, nom_libre TEXT, poste TEXT NOT NULL DEFAULT 'cadreur', horaires TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) )`,
  `CREATE INDEX IF NOT EXISTS idx_affectations_evt ON affectations(evenement_id)`,
  `CREATE TABLE IF NOT EXISTS contrats ( id TEXT PRIMARY KEY, nom TEXT NOT NULL, telephone TEXT, email TEXT, adresse TEXT, profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL, type TEXT NOT NULL DEFAULT 'formation' CHECK (type IN ('formation','freelance','stage','benevole')), poste TEXT NOT NULL DEFAULT 'Cadreur', date_debut TEXT, date_fin TEXT, rythme TEXT, missions TEXT, remuneration TEXT NOT NULL DEFAULT 'aucune' CHECK (remuneration IN ('aucune','defraiement','forfait','jour')), montant REAL NOT NULL DEFAULT 0, accords TEXT NOT NULL DEFAULT '{}', statut TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon','a_signer','signe','termine','annule')), date_signature TEXT, notes TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) )`,
  `CREATE INDEX IF NOT EXISTS idx_contrats_fin ON contrats(date_fin)`,
  `CREATE TABLE IF NOT EXISTS notifications_lues ( user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, cle TEXT NOT NULL, lu_le TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), PRIMARY KEY (user_id, cle) )`,
  `CREATE TABLE IF NOT EXISTS push_abonnements ( endpoint TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, p256dh TEXT NOT NULL, auth TEXT NOT NULL, appareil TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) )`,
  `CREATE TABLE IF NOT EXISTS push_envoyes ( user_id TEXT NOT NULL, cle TEXT NOT NULL, envoye_le TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), PRIMARY KEY (user_id, cle) )`,
  `CREATE TABLE IF NOT EXISTS push_cles ( id TEXT PRIMARY KEY, publique TEXT NOT NULL, privee TEXT NOT NULL )`,
  `CREATE TABLE IF NOT EXISTS journal ( id TEXT PRIMARY KEY, type TEXT NOT NULL, evenement_id TEXT, auteur_id TEXT, auteur_nom TEXT, titre TEXT NOT NULL, texte TEXT NOT NULL, lien TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) )`,
  `CREATE INDEX IF NOT EXISTS idx_journal_date ON journal(created_at)`,
]

// Colonnes ajoutées après coup : ignorées si elles existent déjà
const ALTERS = [
  `ALTER TABLE clients ADD COLUMN details TEXT NOT NULL DEFAULT '{}'`,
]

let ready: Promise<void> | null = null

async function migrate(env: Env) {
  await env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s)))
  for (const s of ALTERS) {
    try { await env.DB.prepare(s).run() } catch (e) {
      if (!String(e).includes('duplicate column')) throw e
    }
  }
}

export function ensureSchema(env: Env) {
  if (!ready) ready = migrate(env).catch((e) => { ready = null; throw e })
  return ready
}
