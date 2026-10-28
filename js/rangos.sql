-- =====================================================================
-- La Bolita Jalisciense · rango de boletos por sorteo (SE EJECUTA UNA SOLA VEZ)
-- Supabase → SQL Editor → New query → pega todo → Run
--
-- Es compatible con la página en operación:
--  · Agrega 2 columnas con valor por defecto 00000001–99999999, así que todos tus
--    sorteos y reservas actuales quedan EXACTAMENTE como están.
--  · Reemplaza proponer_numeros y crear_reserva por versiones que respetan el rango
--    (con el rango por defecto se comportan igual que antes).
--  · No borra datos, usuarios, llaves ni políticas. Se puede repetir sin problema.
-- =====================================================================

-- Rango de boletos por sorteo (siempre números de 8 dígitos: 00000001 a 99999999)
alter table public.rifas         add column if not exists num_desde int not null default 1;
alter table public.rifas         add column if not exists num_hasta int not null default 99999999;
alter table public.configuracion add column if not exists num_desde int not null default 1;
alter table public.configuracion add column if not exists num_hasta int not null default 99999999;
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
end $$;

create or replace function public.proponer_numeros(p_rifa uuid, p_cantidad int)
returns int[] language plpgsql security definer set search_path = public as $$
declare
  v_key uuid := coalesce(p_rifa, '00000000-0000-0000-0000-000000000000'::uuid);
  v_desde int; v_hasta int; v_total bigint; v_tomados bigint;
  v_res int[] := '{}'; v_n int; v_try int := 0;
begin
  perform public.liberar_vencidas();
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 1000 then raise exception 'cantidad_invalida'; end if;

  if p_rifa is null then
    select num_desde, num_hasta into v_desde, v_hasta from public.configuracion where id = 1;
  else
    select num_desde, num_hasta into v_desde, v_hasta from public.rifas where id = p_rifa and activa;
    if not found then raise exception 'rifa_no_disponible'; end if;
  end if;

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
  v_desde int; v_hasta int;
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
    v_desde := v_cfg.num_desde; v_hasta := v_cfg.num_hasta;
  else
    select * into v_rifa from public.rifas where id = p_rifa and activa;
    if not found then raise exception 'rifa_no_disponible'; end if;
    v_precio := v_rifa.precio; v_nombre := v_rifa.nombre;
    v_desde := v_rifa.num_desde; v_hasta := v_rifa.num_hasta;
  end if;
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
