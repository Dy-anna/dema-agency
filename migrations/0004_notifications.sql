-- Notifications : alertes lues, abonnements push, envois déjà faits, clés VAPID
CREATE TABLE IF NOT EXISTS notifications_lues (
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cle TEXT NOT NULL,
  lu_le TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, cle)
);
CREATE TABLE IF NOT EXISTS push_abonnements (
  endpoint TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  appareil TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS push_envoyes (
  user_id TEXT NOT NULL,
  cle TEXT NOT NULL,
  envoye_le TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, cle)
);
CREATE TABLE IF NOT EXISTS push_cles ( id TEXT PRIMARY KEY, publique TEXT NOT NULL, privee TEXT NOT NULL );
