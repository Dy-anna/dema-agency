-- DEMA Agency — schéma initial
-- Rôles : gerant (accès complet), chef_projet (pas de finance), assistant (pas de finance)

create extension if not exists pgcrypto;

-- ───────────── Profils & rôles ─────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nom text not null default '',
  role text not null default 'assistant' check (role in ('gerant','chef_projet','assistant')),
  created_at timestamptz not null default now()
);

create or replace function public.is_gerant()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'gerant');
$$;

create or replace function public.is_membre()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

-- Le premier compte créé devient gérant, les suivants assistants (modifiable par un gérant)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nom, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nom', split_part(new.email, '@', 1)),
    case when exists (select 1 from public.profiles) then 'assistant' else 'gerant' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────── Clients / prospects ─────────────
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  type_prestation text not null default 'mariage'
    check (type_prestation in ('mariage','evenementiel','corporate','shooting','autre')),
  nom text not null,
  contact text,
  telephone text,
  email text,
  adresse text,
  date_evenement date,
  statut_commercial text not null default 'prospect' check (statut_commercial in ('prospect','client','perdu')),
  rdv_effectue_le date,
  notes text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

-- ───────────── Devis (finance : gérants) ─────────────
create table if not exists public.devis (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  numero text,
  statut text not null default 'brouillon'
    check (statut in ('brouillon','envoye','negociation','signe','refuse')),
  lignes jsonb not null default '[]'::jsonb, -- [{libelle, quantite, prix_unitaire}]
  montant numeric(12,2) not null default 0,
  date_envoi timestamptz,
  date_signature timestamptz,
  created_at timestamptz not null default now()
);

-- ───────────── Projets ─────────────
create table if not exists public.projets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  devis_id uuid references public.devis(id) on delete set null,
  titre text not null,
  type_prestation text not null default 'mariage',
  date_evenement date,
  statut text not null default 'en_attente' check (statut in ('en_attente','production','livre')),
  created_at timestamptz not null default now()
);

create table if not exists public.taches (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.projets(id) on delete cascade,
  groupe text not null default 'Général',
  titre text not null,
  fait boolean not null default false,
  assigne_a uuid references public.profiles(id) on delete set null,
  ordre int not null default 0,
  created_at timestamptz not null default now()
);

-- ───────────── Paiements / échéancier (finance : gérants) ─────────────
create table if not exists public.paiements (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.projets(id) on delete cascade,
  libelle text not null,
  type text not null default 'versement' check (type in ('acompte','versement','solde')),
  montant numeric(12,2) not null default 0,
  echeance date,
  recu boolean not null default false,
  recu_le date,
  created_at timestamptz not null default now()
);

-- ───────────── Calendrier ─────────────
create table if not exists public.evenements (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  date date not null,
  type_prestation text not null default 'mariage',
  statut text not null default 'previsionnel' check (statut in ('previsionnel','confirme','annule')),
  client_id uuid references public.clients(id) on delete set null,
  projet_id uuid references public.projets(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ───────────── Objectifs (gérants) ─────────────
create table if not exists public.objectifs (
  id uuid primary key default gen_random_uuid(),
  annee int not null,
  periode text not null check (periode in ('annee','trimestre','mois')),
  numero int not null default 0, -- trimestre 1-4, mois 1-12, 0 pour l'année
  indicateur text not null check (indicateur in ('ca_signe','ca_encaisse','prospects','rdv','signes')),
  cible numeric(12,2) not null default 0,
  unique (annee, periode, numero, indicateur)
);

-- ───────────── RLS ─────────────
alter table public.profiles   enable row level security;
alter table public.clients    enable row level security;
alter table public.devis      enable row level security;
alter table public.projets    enable row level security;
alter table public.taches     enable row level security;
alter table public.paiements  enable row level security;
alter table public.evenements enable row level security;
alter table public.objectifs  enable row level security;

-- profils : chacun lit l'équipe ; seul un gérant modifie
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (public.is_membre());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using (public.is_gerant()) with check (public.is_gerant());

-- données de production : toute l'équipe
do $$
declare t text;
begin
  foreach t in array array['clients','projets','taches','evenements'] loop
    execute format('drop policy if exists %1$s_all on public.%1$s', t);
    execute format('create policy %1$s_all on public.%1$s for all to authenticated using (public.is_membre()) with check (public.is_membre())', t);
  end loop;
  -- finance : gérants uniquement
  foreach t in array array['devis','paiements','objectifs'] loop
    execute format('drop policy if exists %1$s_gerant on public.%1$s', t);
    execute format('create policy %1$s_gerant on public.%1$s for all to authenticated using (public.is_gerant()) with check (public.is_gerant())', t);
  end loop;
end $$;
