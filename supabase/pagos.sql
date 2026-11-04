-- =====================================================================
-- La Bolita Jalisciense · registro de pagos del cobro automático (Mercado Pago)
-- SE EJECUTA UNA SOLA VEZ: Supabase → SQL Editor → New query → pega todo → Run
--
-- Es SEGURO con la página en operación: solo AGREGA una tabla nueva.
-- No modifica ni borra nada existente. Se puede repetir sin problema.
-- =====================================================================

create table if not exists public.pagos_log (
  id        bigint generated always as identity primary key,
  creada    timestamptz not null default now(),
  proveedor text not null,                 -- 'mercadopago'
  pago_id   text not null,                 -- id del pago en el proveedor
  codigo    text,                          -- código de la reserva (external_reference)
  monto     numeric(12,2),
  estado    text,                          -- estado que reporta el proveedor
  resultado text not null,                 -- validada · ya_validada · pendiente · monto_incorrecto · reserva_no_pendiente · ...
  detalle   jsonb,
  unique (proveedor, pago_id)
);
create index if not exists pagos_log_codigo on public.pagos_log (codigo);

alter table public.pagos_log enable row level security;
drop policy if exists pagos_log_admin on public.pagos_log;
-- Solo el administrador puede leerla. Las funciones de Mercado Pago escriben con la clave de servicio.
create policy pagos_log_admin on public.pagos_log for select to authenticated using (public.es_admin());
