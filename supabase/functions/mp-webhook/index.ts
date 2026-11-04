// Supabase Edge Function · mp-webhook
// Recibe los avisos de Mercado Pago. NO confía en el aviso: consulta el pago directamente a Mercado Pago
// con tu Access Token, y solo si está APROBADO, es en MXN, el monto cubre el total y la reserva sigue
// pendiente o en revisión, la marca como validada. Cada pago se registra en pagos_log.
//
// IMPORTANTE: al desplegar esta función, desactiva "Verify JWT" (Mercado Pago no envía credenciales de Supabase).
// Secretos: MP_ACCESS_TOKEN (el mismo de mp-crear-pago).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

function ok(texto) { return new Response(texto || "ok", { status: 200 }); }

async function manejar(req, E, sb, fetchFn) {
  if (req.method !== "POST") return ok("ok");
  const url = new URL(req.url);
  let body = {};
  try { body = await req.json(); } catch (_) {}
  const tipo = body.type || body.topic || url.searchParams.get("type") || url.searchParams.get("topic");
  const id = (body.data && body.data.id) || url.searchParams.get("data.id") || url.searchParams.get("id");
  if (tipo !== "payment" || !id) return ok("ignorado");

  const token = E("MP_ACCESS_TOKEN");
  if (!token) return new Response("sin token", { status: 503 });

  // Se consulta el pago real a Mercado Pago (lo que llegue en el aviso nunca se toma como cierto)
  const pr = await fetchFn("https://api.mercadopago.com/v1/payments/" + encodeURIComponent(id), { headers: { Authorization: "Bearer " + token } });
  if (pr.status === 404) return ok("pago no pertenece a esta cuenta");
  if (!pr.ok) return new Response("error al consultar", { status: 502 });   // Mercado Pago reintenta después
  const p = await pr.json();

  const codigo = String(p.external_reference || "").toUpperCase();
  const monto = Number(p.transaction_amount);
  const registrar = (resultado, detalle) => sb.from("pagos_log").upsert({
    proveedor: "mercadopago", pago_id: String(p.id), codigo: codigo || null,
    monto: isFinite(monto) ? monto : null, estado: p.status, resultado,
    detalle: detalle || { status_detail: p.status_detail, moneda: p.currency_id },
  }, { onConflict: "proveedor,pago_id" });

  if (p.status !== "approved") { await registrar("pendiente"); return ok("estado " + p.status); }

  // Un pago ya validado no se vuelve a procesar ni se sobrescribe su registro
  const { data: previo } = await sb.from("pagos_log").select("resultado").eq("proveedor", "mercadopago").eq("pago_id", String(p.id)).maybeSingle();
  if (previo && previo.resultado === "validada") return ok("ya procesado");

  if (!/^BJ-[A-Z0-9]{6,14}$/.test(codigo)) { await registrar("sin_reserva"); return ok("sin reserva"); }
  const { data: r } = await sb.from("reservas").select("id,estado,total").eq("codigo", codigo).maybeSingle();
  if (!r) { await registrar("reserva_no_encontrada"); return ok("reserva no encontrada"); }
  if (p.currency_id !== "MXN" || !(monto >= Number(r.total))) {
    await registrar("monto_incorrecto", { esperado: Number(r.total), recibido: monto, moneda: p.currency_id });
    return ok("monto incorrecto");
  }
  if (r.estado === "validado") { await registrar("ya_validada"); return ok("ya validada"); }

  const { data: up } = await sb.from("reservas").update({ estado: "validado" }).eq("id", r.id).in("estado", ["pendiente", "revision"]).select("id");
  if (up && up.length) { await registrar("validada"); return ok("validada"); }
  await registrar("reserva_no_pendiente", { estado_reserva: r.estado });
  return ok("la reserva ya no estaba pendiente");
}

Deno.serve((req) => manejar(
  req,
  (k) => Deno.env.get(k),
  createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } }),
  fetch,
));
