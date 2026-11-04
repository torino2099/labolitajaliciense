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

-- Rango de boletos y estado de cada sorteo (siempre números de 8 dígitos: 00000001 a 99999999)
alter table public.rifas         add column if not exists num_desde int not null default 1;
alter table public.rifas         add column if not exists num_hasta int not null default 99999999;
alter table public.rifas         add column if not exists estado text not null default 'abierta';
alter table public.configuracion add column if not exists num_desde int not null default 1;
alter table public.configuracion add column if not exists num_hasta int not null default 99999999;
alter table public.configuracion add column if not exists estado text not null default 'abierta';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rifas_rango_ok') then
    alter table public.rifas add constraint rifas_rango_ok
      check (num_desde >= 1 and num_hasta <= 99999999 and num_desde <= num_hasta);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'config_rango_ok') then
    alter table public.configuracion add constraint config_rango_ok
      check (num_desde >= 1 and num_hasta <= 99999999 and num_desde <= num_hasta);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rifas_estado_ok') then
    alter table public.rifas add constraint rifas_estado_ok check (estado in ('abierta','cerrada','finalizada'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'config_estado_ok') then
    alter table public.configuracion add constraint config_estado_ok check (estado in ('abierta','cerrada','finalizada'));
  end if;
end $$;

-- Cinturón de seguridad: pase lo que pase en las funciones, la base NUNCA acepta un
-- número activo fuera del rango del sorteo.
create or replace function public.boletos_en_rango()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_d int; v_h int;
begin
  if new.activo then
    if new.rifa_key = '00000000-0000-0000-0000-000000000000'::uuid then
      select num_desde, num_hasta into v_d, v_h from public.configuracion where id = 1;
    else
      select num_desde, num_hasta into v_d, v_h from public.rifas where id = new.rifa_key;
    end if;
    if v_d is not null and (new.numero < v_d or new.numero > v_h) then
      raise exception 'numeros_invalidos';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.boletos_en_rango() from public, anon, authenticated;
drop trigger if exists trg_boletos_rango on public.boletos;
create trigger trg_boletos_rango before insert on public.boletos
  for each row execute function public.boletos_en_rango();

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
  v_desde int; v_hasta int; v_estado text; v_total bigint; v_tomados bigint;
  v_res int[] := '{}'; v_n int; v_try int := 0;
begin
  perform public.liberar_vencidas();
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 1000 then raise exception 'cantidad_invalida'; end if;

  if p_rifa is null then
    select num_desde, num_hasta, estado into v_desde, v_hasta, v_estado from public.configuracion where id = 1;
  else
    select num_desde, num_hasta, estado into v_desde, v_hasta, v_estado from public.rifas where id = p_rifa and activa;
    if not found then raise exception 'rifa_no_disponible'; end if;
  end if;
  if v_estado = 'cerrada' then raise exception 'sorteo_cerrado'; end if;
  if v_estado = 'finalizada' then raise exception 'sorteo_finalizado'; end if;

  v_total := v_hasta::bigint - v_desde + 1;
  select count(*) into v_tomados from public.boletos b
   where b.rifa_key = v_key and b.activo and b.numero between v_desde and v_hasta;
  if p_cantidad > v_total - v_tomados then raise exception 'sin_numeros_libres'; end if;

  -- Rangos pequeños: se eligen al azar entre los números realmente libres
  if v_total <= 200000 then
    select array_agg(s.n order by s.n) into v_res from (
      select g.n from generate_series(v_desde, v_hasta) as g(n)
       where not exists (select 1 from public.boletos b where b.rifa_key = v_key and b.numero = g.n and b.activo)
       order by random() limit p_cantidad) s;
    return v_res;
  end if;

  -- Rangos grandes: sorteo aleatorio con verificación
  while coalesce(array_length(v_res, 1), 0) < p_cantidad loop
    v_try := v_try + 1;
    if v_try > p_cantidad * 20 + 200 then raise exception 'sin_numeros_libres'; end if;
    v_n := v_desde + floor(random() * v_total)::int;
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
  v_desde int; v_hasta int; v_estado text;
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
    v_precio := v_cfg.precio; v_nombre := '';
    v_desde := v_cfg.num_desde; v_hasta := v_cfg.num_hasta; v_estado := v_cfg.estado;
  else
    select * into v_rifa from public.rifas where id = p_rifa and activa;
    if not found then raise exception 'rifa_no_disponible'; end if;
    v_precio := v_rifa.precio; v_nombre := v_rifa.nombre;
    v_desde := v_rifa.num_desde; v_hasta := v_rifa.num_hasta; v_estado := v_rifa.estado;
  end if;
  if v_estado = 'cerrada' then raise exception 'sorteo_cerrado'; end if;
  if v_estado = 'finalizada' then raise exception 'sorteo_finalizado'; end if;
  -- Todos los números deben estar dentro del rango del sorteo
  if exists (select 1 from unnest(p_nums) n where n < v_desde or n > v_hasta) then raise exception 'numeros_invalidos'; end if;

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

-- Cambia el rango de un sorteo (p_rifa = null: rifa principal). Nunca deja fuera números ya tomados.
create or replace function public.admin_cambiar_rango(p_rifa uuid, p_desde int, p_hasta int)
returns json language plpgsql security definer set search_path = public as $$
declare v_key uuid := coalesce(p_rifa, '00000000-0000-0000-0000-000000000000'::uuid); v_fuera bigint;
begin
  if not public.es_admin() then raise exception 'no_autorizado'; end if;
  if p_desde is null or p_hasta is null or p_desde < 1 or p_hasta > 99999999 or p_desde > p_hasta then
    raise exception 'rango_invalido';
  end if;
  perform public.liberar_vencidas();
  select count(*) into v_fuera from public.boletos
   where rifa_key = v_key and activo and (numero < p_desde or numero > p_hasta);
  if v_fuera > 0 then raise exception 'rango_con_boletos_fuera'; end if;
  if p_rifa is null then
    update public.configuracion set num_desde = p_desde, num_hasta = p_hasta, actualizada = now() where id = 1;
  else
    update public.rifas set num_desde = p_desde, num_hasta = p_hasta where id = p_rifa;
    if not found then raise exception 'rifa_no_encontrada'; end if;
  end if;
  return json_build_object('desde', p_desde, 'hasta', p_hasta);
end $$;
revoke all on function public.admin_cambiar_rango(uuid, int, int) from public, anon;
grant execute on function public.admin_cambiar_rango(uuid, int, int) to authenticated;

-- Abre, cierra o finaliza un sorteo (p_rifa = null: rifa principal)
create or replace function public.admin_cambiar_estado_rifa(p_rifa uuid, p_estado text)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'no_autorizado'; end if;
  if p_estado is null or p_estado not in ('abierta','cerrada','finalizada') then raise exception 'estado_invalido'; end if;
  if p_rifa is null then
    update public.configuracion set estado = p_estado, actualizada = now() where id = 1;
  else
    update public.rifas set estado = p_estado where id = p_rifa;
    if not found then raise exception 'rifa_no_encontrada'; end if;
  end if;
  return json_build_object('estado', p_estado);
end $$;
revoke all on function public.admin_cambiar_estado_rifa(uuid, text) from public, anon;
grant execute on function public.admin_cambiar_estado_rifa(uuid, text) to authenticated;

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

-- ---------- Borrar una campaña CON sus reservas (solo campañas cerradas o finalizadas) ----------
create or replace function public.admin_borrar_campana(p_rifa uuid)
returns json language plpgsql security definer set search_path = public as $$
declare v_estado text; v_n int; v_pend int;
begin
  if not public.es_admin() then raise exception 'no_autorizado'; end if;
  if p_rifa is null then raise exception 'rifa_principal'; end if;
  select estado into v_estado from public.rifas where id = p_rifa;
  if not found then raise exception 'rifa_no_encontrada'; end if;
  if v_estado = 'abierta' then raise exception 'campana_abierta'; end if;
  perform public.liberar_vencidas();
  select count(*) into v_pend from public.reservas
   where rifa_id = p_rifa and estado in ('pendiente', 'revision');
  if v_pend > 0 then raise exception 'campana_con_pagos_en_proceso'; end if;
  delete from public.reservas where rifa_id = p_rifa;      -- los boletos se borran en cascada
  get diagnostics v_n = row_count;
  delete from public.rifas where id = p_rifa;
  return json_build_object('reservas_borradas', v_n);
end $$;
revoke all on function public.admin_borrar_campana(uuid) from public, anon;
grant execute on function public.admin_borrar_campana(uuid) to authenticated;

-- Permite que SOLO el administrador borre archivos de comprobantes (al borrar una campaña)
drop policy if exists comprobantes_admin_borrar on storage.objects;
create policy comprobantes_admin_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'comprobantes' and public.es_admin());

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
-- DATOS DE PAGO + PAGOS EN LÍNEA (Mercado Pago)
-- =====================================================================
create table if not exists public.pagos_config (
  id               int primary key default 1 check (id = 1),
  titular          text not null default '',
  banco            text not null default '',
  cuenta           text not null default '',          -- CLABE, número de cuenta o tarjeta
  alias            text not null default '',
  concepto         text not null default '',
  mp_activo        boolean not null default false,    -- botón "Pagar con Mercado Pago"
  mp_validar_auto  boolean not null default false,    -- validar solo los pagos aprobados por Mercado Pago
  clip_activo      boolean not null default false,
  clip_link        text not null default '',          -- enlace de pago de Clip (https://...)
  actualizada      timestamptz not null default now()
);
insert into public.pagos_config (id) values (1) on conflict (id) do nothing;

alter table public.pagos_config enable row level security;
drop policy if exists pagos_leer   on public.pagos_config;
drop policy if exists pagos_editar on public.pagos_config;
-- Datos pensados para mostrarse al público (a dónde transferir). NUNCA guardes aquí claves secretas.
create policy pagos_leer   on public.pagos_config for select to anon, authenticated using (true);
create policy pagos_editar on public.pagos_config for update to authenticated
  using (public.es_admin()) with check (public.es_admin());

alter table public.reservas add column if not exists pago_proveedor text;
alter table public.reservas add column if not exists pago_ref       text;
alter table public.reservas add column if not exists pago_monto     numeric(12,2);
alter table public.reservas add column if not exists pago_fecha     timestamptz;
create unique index if not exists reservas_pago_unico on public.reservas (pago_proveedor, pago_ref)
  where pago_ref is not null;

-- La usan SOLO las funciones del servidor (webhook) con la clave service_role.
create or replace function public.registrar_pago_en_linea(p_codigo text, p_proveedor text, p_ref text, p_monto numeric)
returns json language plpgsql security definer set search_path = public as $$
declare v_r public.reservas; v_auto boolean;
begin
  select * into v_r from public.reservas where codigo = p_codigo for update;
  if not found then return json_build_object('ok', false, 'motivo', 'reserva_no_encontrada'); end if;

  if v_r.pago_ref = p_ref and v_r.pago_proveedor = p_proveedor then
    return json_build_object('ok', true, 'motivo', 'ya_registrado', 'estado', v_r.estado);
  end if;
  if p_monto is null or p_monto < v_r.total then
    return json_build_object('ok', false, 'motivo', 'monto_menor', 'esperado', v_r.total, 'recibido', p_monto);
  end if;
  if v_r.estado not in ('pendiente', 'revision') then
    -- El pago llegó cuando la reserva ya no estaba activa: se guarda la referencia para revisarla a mano
    update public.reservas set pago_proveedor = p_proveedor, pago_ref = p_ref, pago_monto = p_monto, pago_fecha = now()
     where id = v_r.id and pago_ref is null;
    return json_build_object('ok', false, 'motivo', 'reserva_' || v_r.estado);
  end if;

  select mp_validar_auto into v_auto from public.pagos_config where id = 1;
  update public.reservas
     set pago_proveedor = p_proveedor, pago_ref = p_ref, pago_monto = p_monto, pago_fecha = now(),
         estado = case when coalesce(v_auto, false) then 'validado' else 'revision' end
   where id = v_r.id;
  return json_build_object('ok', true, 'motivo', 'pago_registrado',
                           'estado', case when coalesce(v_auto, false) then 'validado' else 'revision' end);
end $$;
revoke all on function public.registrar_pago_en_linea(text, text, text, numeric) from public, anon, authenticated;
grant execute on function public.registrar_pago_en_linea(text, text, text, numeric) to service_role;

-- ---------- Pagos en línea, transferencia y borrado de campañas ------------
-- 1) Datos de pago que ve el público (titular, CLABE, qué métodos están activos)
alter table public.configuracion add column if not exists pagos jsonb not null default '{}'::jsonb;

-- 2) Credenciales de Mercado Pago y Clip. La página NUNCA las puede leer:
--    sin políticas y sin permisos para anon/authenticated; solo las funciones y las Edge Functions.
create table if not exists public.pagos_secretos (
  clave       text primary key check (clave in ('mp_access_token','clip_api_key','clip_api_secret')),
  valor       text not null,
  actualizada timestamptz not null default now()
);
alter table public.pagos_secretos enable row level security;
revoke all on public.pagos_secretos from anon, authenticated;
grant all on public.pagos_secretos to service_role;

create or replace function public.admin_guardar_secreto(p_clave text, p_valor text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'no_autorizado'; end if;
  if p_clave not in ('mp_access_token','clip_api_key','clip_api_secret') then raise exception 'clave_invalida'; end if;
  if p_valor is null or btrim(p_valor) = '' then
    delete from public.pagos_secretos where clave = p_clave;
  else
    insert into public.pagos_secretos (clave, valor) values (p_clave, btrim(p_valor))
    on conflict (clave) do update set valor = excluded.valor, actualizada = now();
  end if;
end $$;

-- Solo dice QUÉ credenciales existen (true/false); nunca devuelve su valor
create or replace function public.admin_secretos_estado()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'no_autorizado'; end if;
  return jsonb_build_object(
    'mp_access_token', exists (select 1 from public.pagos_secretos where clave = 'mp_access_token'),
    'clip_api_key',    exists (select 1 from public.pagos_secretos where clave = 'clip_api_key'),
    'clip_api_secret', exists (select 1 from public.pagos_secretos where clave = 'clip_api_secret'));
end $$;

revoke all on function public.admin_guardar_secreto(text, text) from public, anon;
revoke all on function public.admin_secretos_estado()           from public, anon;
grant execute on function public.admin_guardar_secreto(text, text) to authenticated;
grant execute on function public.admin_secretos_estado()           to authenticated;

-- 3) Registro de pagos en línea (lo escriben las Edge Functions; lo lee solo el administrador)
create table if not exists public.pagos (
  id         bigint generated always as identity primary key,
  creada     timestamptz not null default now(),
  proveedor  text not null,
  referencia text,
  codigo     text,
  monto      numeric(12,2),
  estado     text not null default 'creado',
  aplicado   boolean not null default false
);
create index if not exists pagos_ref    on public.pagos (proveedor, referencia);
create index if not exists pagos_codigo on public.pagos (codigo);
alter table public.pagos enable row level security;
revoke all on public.pagos from anon, authenticated;
grant select on public.pagos to authenticated;
grant all on public.pagos to service_role;
drop policy if exists pagos_admin_ver on public.pagos;
create policy pagos_admin_ver on public.pagos for select to authenticated using (public.es_admin());

-- 4) Aplica un pago aprobado a su reserva (solo la llaman las Edge Functions, con service_role)
create or replace function public.aplicar_pago(p_codigo text, p_monto numeric, p_proveedor text, p_referencia text)
returns text language plpgsql security definer set search_path = public as $$
declare r public.reservas; v_res text; v_id bigint;
begin
  select * into r from public.reservas where codigo = p_codigo for update;
  if not found then
    v_res := 'reserva_no_encontrada';
  elsif p_monto is null or p_monto < r.total then
    v_res := 'monto_insuficiente';
  elsif r.estado = 'validado' then
    v_res := 'ya_validada';
  elsif r.estado in ('pendiente','revision') then
    update public.reservas set estado = 'validado' where id = r.id;
    v_res := 'validado';
  elsif r.estado = 'expirada' then
    -- Pagó después de que venció: se recupera solo si sus números siguen libres
    begin
      update public.reservas set estado = 'validado' where id = r.id;
      update public.boletos set activo = true where reserva_id = r.id;
      v_res := 'validado_tardio';
    exception when unique_violation then
      v_res := 'reserva_inactiva';
    end;
  else
    v_res := 'reserva_inactiva';   -- rechazada o liberada por el administrador: revisar a mano
  end if;

  select id into v_id from public.pagos
   where proveedor = p_proveedor and codigo = p_codigo and estado = 'creado'
   order by creada desc limit 1;
  if v_id is not null then
    update public.pagos set estado = v_res, referencia = p_referencia, monto = p_monto,
           aplicado = (v_res in ('validado','validado_tardio','ya_validada')) where id = v_id;
  else
    insert into public.pagos (proveedor, referencia, codigo, monto, estado, aplicado)
    values (p_proveedor, p_referencia, p_codigo, p_monto, v_res, v_res in ('validado','validado_tardio','ya_validada'));
  end if;
  return v_res;
end $$;
revoke all on function public.aplicar_pago(text, numeric, text, text) from public, anon, authenticated;
grant execute on function public.aplicar_pago(text, numeric, text, text) to service_role;

-- 5) Borrar una campaña con reservas, SOLO si no hay dinero de por medio
--    (no permite borrar si tiene reservas validadas o en revisión de pago)
create or replace function public.admin_borrar_campana(p_rifa uuid)
returns json language plpgsql security definer set search_path = public as $$
declare v_res int;
begin
  if not public.es_admin() then raise exception 'no_autorizado'; end if;
  if p_rifa is null then raise exception 'rifa_invalida'; end if;
  if exists (select 1 from public.reservas where rifa_id = p_rifa and estado in ('validado','revision')) then
    raise exception 'rifa_con_pagos';
  end if;
  delete from public.reservas where rifa_id = p_rifa;   -- sus boletos se borran en cascada
  get diagnostics v_res = row_count;
  delete from public.rifas where id = p_rifa;
  return json_build_object('reservas_borradas', v_res);
end $$;
revoke all on function public.admin_borrar_campana(uuid) from public, anon;
grant execute on function public.admin_borrar_campana(uuid) to authenticated;

notify pgrst, 'reload schema';

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
