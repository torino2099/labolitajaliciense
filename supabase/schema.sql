-- =====================================================================
-- La Bolita Jalisciense · esquema de base de datos para Supabase
-- Ejecuta TODO este archivo en: Supabase → SQL Editor → New query → Run
-- =====================================================================

-- ---------- Tablas ----------------------------------------------------

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- Una sola fila (id = 1) con precio, textos e imágenes de la rifa principal
create table if not exists public.configuracion (
  id          int primary key default 1 check (id = 1),
  precio      numeric(10,2) not null default 1.50 check (precio > 0),
  txt         jsonb not null default '{}'::jsonb,
  imagenes    jsonb not null default '{}'::jsonb,
  actualizada timestamptz not null default now()
);
insert into public.configuracion (id) values (1) on conflict (id) do nothing;

create table if not exists public.config_historial (
  id        bigint generated always as identity primary key,
  creada    timestamptz not null default now(),
  precio    numeric(10,2) not null,
  txt       jsonb not null default '{}'::jsonb,
  imagenes  jsonb not null default '{}'::jsonb,
  autor     uuid default auth.uid()
);

create table if not exists public.rifas (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null check (char_length(nombre) between 1 and 120),
  premio      text,
  descr       text,
  fecha       date,
  precio      numeric(10,2) not null check (precio > 0),
  media_tipo  text check (media_tipo in ('image','video')),
  media_path  text,
  activa      boolean not null default true,
  creada      timestamptz not null default now()
);

create table if not exists public.reservas (
  id                 uuid primary key default gen_random_uuid(),
  codigo             text not null unique,
  celular            text not null check (celular ~ '^[0-9]{10}$'),
  rifa_id            uuid references public.rifas(id),   -- null = rifa principal
  rifa_nombre        text not null default '',
  cantidad           int  not null check (cantidad between 1 and 1000),
  precio_unit        numeric(10,2) not null,
  total              numeric(12,2) not null,
  estado             text not null default 'pendiente'
                     check (estado in ('pendiente','revision','validado','rechazado','liberada','expirada')),
  creada             timestamptz not null default now(),
  validada           timestamptz,
  comprobante_path   text,
  comprobante_subido timestamptz
);
create index if not exists reservas_celular on public.reservas (celular);
create index if not exists reservas_estado  on public.reservas (estado, creada);
create index if not exists reservas_rifa    on public.reservas (rifa_id);

-- Un renglón por número reservado. "activo" = el número está tomado.
-- Los números liberados se conservan (activo = false) como historial.
create table if not exists public.boletos (
  id          bigint generated always as identity primary key,
  reserva_id  uuid not null references public.reservas(id) on delete cascade,
  rifa_key    uuid not null,   -- id de la rifa, o 00000000-... para la principal
  numero      int  not null check (numero between 1 and 99999999),
  activo      boolean not null default true
);
-- Garantiza que dos personas NUNCA tengan el mismo número activo en la misma rifa
create unique index if not exists boletos_unico_activo on public.boletos (rifa_key, numero) where activo;
create index if not exists boletos_reserva on public.boletos (reserva_id);
create index if not exists boletos_numero  on public.boletos (rifa_key, numero);

-- ---------- Funciones auxiliares -------------------------------------

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

-- Marca como expiradas las reservas sin comprobante tras 24 horas
create or replace function public.liberar_vencidas()
returns void language sql security definer set search_path = public as $$
  update public.reservas set estado = 'expirada'
   where estado = 'pendiente' and creada < now() - interval '24 hours'
$$;

-- Al rechazar/liberar/expirar una reserva se liberan sus números; al validar se guarda la fecha
create or replace function public.reservas_estado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estado is distinct from old.estado then
    if new.estado in ('rechazado','liberada','expirada') then
      update public.boletos set activo = false where reserva_id = new.id;
    end if;
    if new.estado = 'validado' and new.validada is null then
      new.validada := now();
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_reservas_estado on public.reservas;
create trigger trg_reservas_estado before update on public.reservas
  for each row execute function public.reservas_estado();

create or replace function public.reserva_json(p_id uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', r.id, 'codigo', r.codigo, 'celular', r.celular, 'rifa_id', r.rifa_id,
    'rifa_nombre', r.rifa_nombre, 'cantidad', r.cantidad, 'precio_unit', r.precio_unit,
    'total', r.total, 'estado', r.estado, 'creada', r.creada, 'validada', r.validada,
    'comprobante_path', r.comprobante_path, 'comprobante_subido', r.comprobante_subido,
    'nums', coalesce((select array_agg(b.numero order by b.numero) from public.boletos b where b.reserva_id = r.id), '{}'))
  from public.reservas r where r.id = p_id
$$;

-- Indica si una reserva existe y todavía acepta comprobante (se usa en la política de Storage)
create or replace function public.reserva_acepta_comprobante(p_codigo text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.reservas
                  where codigo = p_codigo and estado = 'pendiente'
                    and creada >= now() - interval '24 hours')
$$;

-- ---------- Funciones que usa el público (sin cuenta) ----------------

create or replace function public.proponer_numeros(p_rifa uuid, p_cantidad int)
returns int[] language plpgsql security definer set search_path = public as $$
declare
  v_key uuid := coalesce(p_rifa, '00000000-0000-0000-0000-000000000000'::uuid);
  v_res int[] := '{}'; v_n int; v_try int := 0;
begin
  perform public.liberar_vencidas();
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 1000 then raise exception 'cantidad_invalida'; end if;
  while coalesce(array_length(v_res, 1), 0) < p_cantidad loop
    v_try := v_try + 1;
    if v_try > p_cantidad * 20 + 200 then raise exception 'sin_numeros_libres'; end if;
    v_n := 1 + floor(random() * 99999999)::int;
    if v_n = any (v_res) then continue; end if;
    if exists (select 1 from public.boletos b where b.rifa_key = v_key and b.numero = v_n and b.activo) then continue; end if;
    v_res := array_append(v_res, v_n);
  end loop;
  return (select array_agg(x order by x) from unnest(v_res) x);
end $$;

create or replace function public.crear_reserva(p_cel text, p_rifa uuid, p_nums int[])
returns json language plpgsql security definer set search_path = public as $$
declare
  v_key uuid := coalesce(p_rifa, '00000000-0000-0000-0000-000000000000'::uuid);
  v_cel text; v_q int; v_precio numeric; v_nombre text; v_id uuid; v_cod text; v_try int := 0;
  v_cfg public.configuracion; v_rifa public.rifas;
begin
  perform public.liberar_vencidas();
  v_cel := regexp_replace(coalesce(p_cel, ''), '\D', '', 'g');
  if length(v_cel) <> 10 then raise exception 'celular_invalido'; end if;
  v_q := coalesce(array_length(p_nums, 1), 0);
  if v_q < 1 or v_q > 1000 then raise exception 'cantidad_invalida'; end if;
  if exists (select 1 from unnest(p_nums) n where n is null or n < 1 or n > 99999999) then raise exception 'numeros_invalidos'; end if;
  if (select count(distinct n) from unnest(p_nums) n) <> v_q then raise exception 'numeros_invalidos'; end if;

  select * into v_cfg from public.configuracion where id = 1;
  if p_rifa is null then
    v_precio := v_cfg.precio;
    v_nombre := '';
  else
    select * into v_rifa from public.rifas where id = p_rifa and activa;
    if not found then raise exception 'rifa_no_disponible'; end if;
    v_precio := v_rifa.precio; v_nombre := v_rifa.nombre;
  end if;

  loop
    v_try := v_try + 1;
    v_cod := 'BJ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    begin
      insert into public.reservas (codigo, celular, rifa_id, rifa_nombre, cantidad, precio_unit, total)
      values (v_cod, v_cel, p_rifa, v_nombre, v_q, v_precio, round(v_precio * v_q, 2))
      returning id into v_id;
      exit;
    exception when unique_violation then
      if v_try > 5 then raise; end if;
    end;
  end loop;

  begin
    insert into public.boletos (reserva_id, rifa_key, numero)
    select v_id, v_key, n from unnest(p_nums) n;
  exception when unique_violation then
    raise exception 'numeros_ocupados';
  end;

  return public.reserva_json(v_id);
end $$;

create or replace function public.mis_reservas(p_cel text)
returns json language plpgsql security definer set search_path = public as $$
declare v_cel text := regexp_replace(coalesce(p_cel, ''), '\D', '', 'g');
begin
  perform public.liberar_vencidas();
  if length(v_cel) <> 10 then raise exception 'celular_invalido'; end if;
  return coalesce((select json_agg(public.reserva_json(id) order by creada)
                     from public.reservas where celular = v_cel), '[]'::json);
end $$;

create or replace function public.registrar_comprobante(p_cel text, p_codigo text, p_path text)
returns void language plpgsql security definer set search_path = public as $$
declare v_cel text := regexp_replace(coalesce(p_cel, ''), '\D', '', 'g');
begin
  perform public.liberar_vencidas();
  update public.reservas
     set estado = 'revision', comprobante_path = p_path, comprobante_subido = now()
   where codigo = p_codigo and celular = v_cel and estado = 'pendiente'
     and p_path like p_codigo || '/%';
  if not found then raise exception 'reserva_no_acepta_comprobante'; end if;
end $$;

-- Permisos de ejecución: solo lo necesario
revoke all on function public.reserva_json(uuid)              from public, anon, authenticated;
revoke all on function public.reservas_estado()               from public, anon, authenticated;
revoke all on function public.reserva_acepta_comprobante(text) from public;
grant execute on function public.reserva_acepta_comprobante(text) to anon, authenticated;
grant execute on function public.es_admin()                   to anon, authenticated;
grant execute on function public.liberar_vencidas()           to anon, authenticated;
grant execute on function public.proponer_numeros(uuid, int)  to anon, authenticated;
grant execute on function public.crear_reserva(text, uuid, int[]) to anon, authenticated;
grant execute on function public.mis_reservas(text)           to anon, authenticated;
grant execute on function public.registrar_comprobante(text, text, text) to anon, authenticated;

-- ---------- Seguridad por fila (RLS) ---------------------------------
alter table public.admins           enable row level security;
alter table public.configuracion    enable row level security;
alter table public.config_historial enable row level security;
alter table public.rifas            enable row level security;
alter table public.reservas         enable row level security;
alter table public.boletos          enable row level security;

drop policy if exists admins_ver_propio     on public.admins;
create policy admins_ver_propio on public.admins for select to authenticated using (user_id = auth.uid());

drop policy if exists config_leer           on public.configuracion;
drop policy if exists config_editar         on public.configuracion;
create policy config_leer   on public.configuracion for select to anon, authenticated using (true);
create policy config_editar on public.configuracion for update to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists hist_admin            on public.config_historial;
create policy hist_admin on public.config_historial for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists rifas_leer            on public.rifas;
drop policy if exists rifas_admin           on public.rifas;
create policy rifas_leer  on public.rifas for select to anon, authenticated using (activa or public.es_admin());
create policy rifas_admin on public.rifas for all    to authenticated using (public.es_admin()) with check (public.es_admin());

-- reservas y boletos: el público NO puede leerlas ni escribirlas directamente (solo con las funciones de arriba)
drop policy if exists reservas_admin_ver    on public.reservas;
drop policy if exists reservas_admin_editar on public.reservas;
create policy reservas_admin_ver    on public.reservas for select to authenticated using (public.es_admin());
create policy reservas_admin_editar on public.reservas for update to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists boletos_admin_ver     on public.boletos;
create policy boletos_admin_ver on public.boletos for select to authenticated using (public.es_admin());

-- ---------- Almacenamiento de archivos (Storage) ---------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('rifa-assets', 'rifa-assets', true,  20971520, array['image/jpeg','image/png','image/webp','video/mp4','video/webm']),
  ('comprobantes', 'comprobantes', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Imágenes y videos de la rifa: lectura pública (bucket público), escritura solo administrador
drop policy if exists assets_admin on storage.objects;
create policy assets_admin on storage.objects for all to authenticated
  using (bucket_id = 'rifa-assets' and public.es_admin())
  with check (bucket_id = 'rifa-assets' and public.es_admin());

-- Comprobantes: cualquiera puede subir SOLO a la carpeta de una reserva pendiente (<codigo>/archivo); solo el admin los lee
drop policy if exists comprobantes_subir on storage.objects;
drop policy if exists comprobantes_leer  on storage.objects;
create policy comprobantes_subir on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'comprobantes' and public.reserva_acepta_comprobante((storage.foldername(name))[1]));
create policy comprobantes_leer on storage.objects for select to authenticated
  using (bucket_id = 'comprobantes' and public.es_admin());

-- =====================================================================
-- DESPUÉS de ejecutar lo anterior:
-- 1) Authentication → Users → Add user: crea tu usuario administrador (correo + contraseña larga).
-- 2) Authentication → Sign In / Providers: desactiva "Allow new users to sign up".
-- 3) Ejecuta esto con TU correo para darle permisos de administrador:
--
--    insert into public.admins (user_id)
--    select id from auth.users where email = 'TU_CORREO@ejemplo.com';
--
-- Opcional (recomendado): programa la liberación automática de reservas vencidas cada 5 min
-- (Database → Extensions → habilita pg_cron):
--
--    select cron.schedule('liberar-vencidas', '*/5 * * * *', $$select public.liberar_vencidas()$$);
-- =====================================================================
