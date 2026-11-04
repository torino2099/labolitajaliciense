// Supabase Edge Function · mp-crear-pago
// Crea el pago de una reserva en Mercado Pago (Checkout Pro) y devuelve el enlace para pagar.
// También permite al administrador verificar con qué cuenta de Mercado Pago está conectado.
//
// Secretos necesarios (Edge Functions → Secrets):
//   MP_ACCESS_TOKEN  Access Token de PRODUCCIÓN de tu aplicación de Mercado Pago (nunca va en la página)
//   SITE_URL         Dirección pública de tu página, con https:// (para regresar después de pagar)
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya los provee Supabase automáticamente.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
function fallo(mensaje, codigo, status = 400) { return json({ error: mensaje, codigo }, status); }

async function manejar(req, E, sb, fetchFn) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fallo("Método no permitido.", "metodo", 405);
  let body = {};
  try { body = await req.json(); } catch (_) {}
  const token = E("MP_ACCESS_TOKEN");

  // ---- Administrador: ¿a qué cuenta de Mercado Pago estamos conectados? ----
  if (body.action === "estado") {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await sb.auth.getUser(jwt);
    const user = u && u.user;
    if (!user) return fallo("Inicia sesión como administrador.", "no_autorizado", 401);
    const { data: adm } = await sb.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!adm) return fallo("Solo el administrador puede ver esto.", "no_autorizado", 403);
    if (!token) return json({ configurado: false, detalle: "falta guardar el secreto MP_ACCESS_TOKEN en Supabase." });
    const r = await fetchFn("https://api.mercadopago.com/users/me", { headers: { Authorization: "Bearer " + token } });
    if (!r.ok) return json({ configurado: false, detalle: "Mercado Pago rechazó el token (revisa que sea el de producción y esté completo)." });
    const m = await r.json();
    const nombre = [m.first_name, m.last_name].filter(Boolean).join(" ") || m.nickname || "";
    const email = m.email ? String(m.email).replace(/^(.).*(@.*)$/, "$1***$2") : "";
    return json({ configurado: true, cuenta: { id: m.id, nombre, nickname: m.nickname || "", email, pais: m.site_id || "" } });
  }

  // ---- Público: crear el pago de una reserva ----
  if (body.action === "crear") {
    const codigo = String(body.codigo || "").trim().toUpperCase();
    const cel = String(body.celular || "").replace(/\D/g, "");
    if (!/^BJ-[A-Z0-9]{6,14}$/.test(codigo) || cel.length !== 10) return fallo("Datos de reserva inválidos.", "datos_invalidos");
    if (!token) return fallo("El cobro con Mercado Pago aún no está configurado.", "mp_no_configurado", 503);

    const { data: r } = await sb.from("reservas")
      .select("codigo,celular,estado,total,cantidad,rifa_nombre,creada")
      .eq("codigo", codigo).eq("celular", cel).maybeSingle();
    if (!r) return fallo("No encontramos esa reserva.", "no_encontrada", 404);
    if (!(r.estado === "pendiente" || r.estado === "revision")) return fallo("Esta reserva ya no acepta pago.", "reserva_no_pendiente");
    if (r.estado === "pendiente" && Date.now() - Date.parse(r.creada) > 24 * 3600 * 1000) return fallo("La reserva expiró.", "reserva_expirada");
    const total = Number(r.total);
    if (!(total > 0)) return fallo("La reserva no tiene un monto válido.", "datos_invalidos");

    let nombre = r.rifa_nombre;
    if (!nombre) {
      const { data: c } = await sb.from("configuracion").select("txt").eq("id", 1).maybeSingle();
      nombre = (c && c.txt && c.txt.nombre) || "La Bolita Jalisciense";
    }
    const site = String(E("SITE_URL") || "").replace(/\/+$/, "");
    const pref = {
      items: [{ id: codigo, title: ("Boletos " + nombre + " (" + r.cantidad + ")").slice(0, 250), quantity: 1, unit_price: total, currency_id: "MXN" }],
      external_reference: codigo,                                  // así sabemos a qué reserva corresponde el pago
      notification_url: E("SUPABASE_URL") + "/functions/v1/mp-webhook",
      statement_descriptor: "LA BOLITA",
    };
    if (site.startsWith("https://")) {
      pref.back_urls = { success: site + "/?pago=ok", pending: site + "/?pago=pendiente", failure: site + "/?pago=error" };
      pref.auto_return = "approved";
    }
    const res = await fetchFn("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(pref),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out.init_point) return fallo("Mercado Pago no pudo crear el pago. Intenta de nuevo.", "mp_error", 502);
    return json({ url: out.init_point });
  }

  return fallo("Acción no válida.", "accion");
}

Deno.serve((req) => manejar(
  req,
  (k) => Deno.env.get(k),
  createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } }),
  fetch,
));
