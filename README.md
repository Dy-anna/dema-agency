# DEMA Agency — CRM

Application web interne de DEMA Agency : clients & prospects, devis, projets & tâches, calendrier, échéancier, objectifs et équipe.

## Stack
- React + TypeScript (Vite) — dossier `src/`
- API Cloudflare Pages Functions — dossier `functions/` (auth par cookie, données)
- Base de données Cloudflare D1 `dema-agency` — schéma dans `migrations/`
- Hébergement : Cloudflare Pages (la base D1 est reliée via `wrangler.toml`)

## Rôles
- **Gérant** : accès complet (devis, finance, objectifs, gestion de l'équipe)
- **Chef de projet / Assistant** : clients, projets, tâches, calendrier — pas de finance

Le tout premier compte créé sur le site devient gérant. Les autres comptes sont ajoutés depuis « Équipe & compte ».

## Développer en local
```bash
npm install
npx wrangler d1 migrations apply dema-agency --local
npm run build && npx wrangler pages dev dist
```

## Déploiement Cloudflare Pages
- Commande de build : `npm run build`
- Dossier de sortie : `dist`
- La liaison D1 (`DB`) est lue depuis `wrangler.toml`.
