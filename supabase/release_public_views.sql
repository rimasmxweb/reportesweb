-- Conteos públicos de YouTube por lanzamiento. Lo escribe /api/sync
-- cuando existe YOUTUBE_API_KEY. No forma parte de las métricas pagadas.
create table if not exists release_public_views (
  release_id text primary key,
  youtube_video_id text not null,
  public_views bigint not null,
  fetched_at timestamptz not null
);
