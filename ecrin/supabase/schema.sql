-- Écrin · schéma Supabase
-- À coller une seule fois dans Supabase > SQL Editor > New query > Run.

-- 1. Table des chansons
create table if not exists public.tracks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 120),
  artist      text not null check (char_length(artist) between 1 and 80),
  genre       text check (genre is null or char_length(genre) <= 40),
  source      text not null check (source in ('suno', 'upload')),
  suno_id     uuid unique,
  audio_url   text not null,
  cover_url   text,
  plays       integer not null default 0,
  reports     integer not null default 0,
  hidden      boolean not null default false,
  created_at  timestamptz not null default now(),
  -- l'audio doit venir de Suno ou de notre propre stockage
  constraint audio_origin check (
    audio_url like 'https://cdn1.suno.ai/%'
    or audio_url like '%/storage/v1/object/public/songs/%'
  )
);

create index if not exists tracks_created_idx on public.tracks (created_at desc);
create index if not exists tracks_plays_idx   on public.tracks (plays desc);

-- 2. Sécurité : tout le monde lit, tout le monde ajoute, personne ne modifie directement
alter table public.tracks enable row level security;

drop policy if exists "lecture publique" on public.tracks;
create policy "lecture publique" on public.tracks
  for select using (hidden = false);

drop policy if exists "ajout public" on public.tracks;
create policy "ajout public" on public.tracks
  for insert with check (plays = 0 and reports = 0 and hidden = false);

-- 3. Compteur d'écoutes et signalements (seules modifications permises)
create or replace function public.count_play(track uuid)
returns void language sql security definer set search_path = public as $$
  update tracks set plays = plays + 1 where id = track;
$$;

-- Une chanson signalée 5 fois disparaît jusqu'à ce que tu la vérifies
create or replace function public.report_track(track uuid)
returns void language sql security definer set search_path = public as $$
  update tracks set reports = reports + 1,
                    hidden  = (reports + 1) >= 5
  where id = track;
$$;

grant execute on function public.count_play(uuid)   to anon, authenticated;
grant execute on function public.report_track(uuid) to anon, authenticated;

-- 4. Stockage des MP3 et pochettes envoyés (15 Mo max par fichier)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('songs', 'songs', true, 15728640,
        array['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/mp4','audio/x-m4a','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "envoi public" on storage.objects;
create policy "envoi public" on storage.objects
  for insert with check (bucket_id = 'songs');

drop policy if exists "lecture fichiers" on storage.objects;
create policy "lecture fichiers" on storage.objects
  for select using (bucket_id = 'songs');
