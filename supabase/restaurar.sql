-- =====================================================================
-- La Bolita Jalisciense · habilita la pestaña "Restaurar" (SE EJECUTA UNA SOLA VEZ)
-- Supabase → SQL Editor → New query → pega todo → Run
--
-- Es SEGURO con la página en operación: solo AGREGA una función y una política.
-- No modifica ni borra tablas, datos, usuarios, llaves ni políticas existentes,
-- y se puede ejecutar varias veces sin problema.
-- =====================================================================

create or replace function public.admin_restaurar_reservas(p_reservas jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r jsonb; v_id uuid; v_key uuid; v_rifa uuid; v_estado text; v_nums int[]; v_activo boolean;
  v_creada timestamptz; v_ins int := 0; v_exist int := 0;
  v_conf jsonb := '[]'::jsonb; v_sinrifa jsonb := '[]'::jsonb; v_err jsonb := '[]'::jsonb;
  v_zero uuid := '00000000-0000-0000-0000-000000000000';
begin
  if not public.es_admin() then raise exception 'no_autorizado'; end if;

  for r in select * from jsonb_array_elements(coalesce(p_reservas, '[]'::jsonb)) loop
    begin
      -- Nunca toca una reserva que ya existe
      if exists (select 1 from public.reservas where codigo = r->>'code') then
        v_exist := v_exist + 1; continue;
      end if;

      v_rifa := nullif(r->>'rid', '')::uuid;
      if v_rifa is not null and not exists (select 1 from public.rifas where id = v_rifa) then
        v_sinrifa := v_sinrifa || to_jsonb(r->>'code'); continue;
      end if;
      v_key := coalesce(v_rifa, v_zero);

      select coalesce(array_agg(x::int), '{}') into v_nums from jsonb_array_elements_text(r->'nums') x;

      v_estado := r->>'estado';
      if v_estado = 'pagado' then v_estado := 'validado'; end if;
      if v_estado is null or v_estado not in ('pendiente','revision','validado','rechazado','liberada','expirada') then
        v_estado := 'liberada';
      end if;
      v_creada := to_timestamp(coalesce((r->>'ts')::numeric, extract(epoch from now()) * 1000) / 1000.0);
      if v_estado = 'pendiente' and v_creada < now() - interval '24 hours' then v_estado := 'expirada'; end if;
      v_activo := v_estado in ('pendiente','revision','validado');

      insert into public.reservas (codigo, celular, rifa_id, rifa_nombre, cantidad, precio_unit, total,
                                   estado, creada, validada, comprobante_path, comprobante_subido)
      values (r->>'code', r->>'cel', v_rifa,
              case when v_rifa is null then '' else coalesce(r->>'rn', '') end,
              coalesce(array_length(v_nums, 1), 0), (r->>'p')::numeric, (r->>'t')::numeric,
              v_estado, v_creada,
              case when coalesce((r->>'vts')::numeric, 0) > 0 then to_timestamp((r->>'vts')::numeric / 1000.0) end,
              nullif(r->>'cpath', ''),
              case when coalesce((r->>'cp')::numeric, 0) > 0 then to_timestamp((r->>'cp')::numeric / 1000.0) end)
      returning id into v_id;

      -- Si algún número ya lo tiene otra persona (activo), el índice único lo impide
      insert into public.boletos (reserva_id, rifa_key, numero, activo)
      select v_id, v_key, n, v_activo from unnest(v_nums) n;

      v_ins := v_ins + 1;
    exception
      when unique_violation then
        v_conf := v_conf || to_jsonb(r->>'code');
      when others then
        v_err := v_err || jsonb_build_object('codigo', r->>'code', 'error', sqlerrm);
    end;
  end loop;

  return jsonb_build_object('insertadas', v_ins, 'existentes', v_exist,
                            'conflictos', v_conf, 'sin_rifa', v_sinrifa, 'errores', v_err);
end $$;

revoke all on function public.admin_restaurar_reservas(jsonb) from public, anon;
grant execute on function public.admin_restaurar_reservas(jsonb) to authenticated;

-- Permite que SOLO el administrador suba comprobantes antiguos al restaurar
-- (la política para el público no cambia).
drop policy if exists comprobantes_admin_subir on storage.objects;
create policy comprobantes_admin_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'comprobantes' and public.es_admin());
