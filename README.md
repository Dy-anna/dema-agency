# DEMA Agency — CRM

Application web interne de DEMA Agency : clients & prospects, devis, projets & tâches, calendrier, échéancier et objectifs.

## Stack
- React + TypeScript (Vite)
- Supabase (auth, base de données, RLS)
- Hébergement : Cloudflare Pages

## Démarrer en local
```bash
cp .env.example .env.local   # renseigner la clé publique Supabase
npm install
npm run dev
```

## Base de données
Le schéma est dans `supabase/migrations/0001_dema_agency.sql`.
Le premier compte créé devient **gérant** ; les suivants sont **assistants** (rôle modifiable par un gérant).

## Déploiement Cloudflare Pages
- Commande de build : `npm run build`
- Dossier de sortie : `dist`
- Variables : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
