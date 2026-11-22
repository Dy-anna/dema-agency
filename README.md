# DEMA Agency — CRM

Application web interne de DEMA Agency : clients & prospects, devis, projets & tâches, calendrier, échéancier, objectifs et équipe.

## Stack
- React + TypeScript (Vite) — dossier `src/`
- API dans un Cloudflare Worker — dossier `worker/` (auth par cookie, données)
- Base de données Cloudflare D1 `dema-agency` — schéma dans `migrations/`
- Hébergement : Cloudflare Workers + fichiers statiques (config dans `wrangler.toml`)

## Rôles
- **Gérant** : accès complet (devis, finance, objectifs, gestion de l'équipe)
- **Chef de projet / Assistant** : clients, projets, tâches, calendrier — pas de finance

Le tout premier compte créé sur le site devient gérant. Les autres comptes sont ajoutés depuis « Équipe & compte ».

## Développer en local
```bash
npm install
npx wrangler d1 migrations apply dema-agency --local
npx wrangler dev
```

## Déploiement
Chaque push sur `main` déclenche `npx wrangler deploy` sur Cloudflare (le build du site est lancé automatiquement). La base D1 (`DB`) est reliée dans `wrangler.toml`.
