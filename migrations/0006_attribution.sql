-- Notification personnelle (tâche attribuée) + échéance des tâches
ALTER TABLE journal ADD COLUMN destinataire_id TEXT;
ALTER TABLE taches ADD COLUMN echeance TEXT;
