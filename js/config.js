/* Configuración de la página.

   CONEXIÓN CON SUPABASE (Project Settings → API):
     supabaseUrl      = "Project URL"
     supabaseAnonKey  = clave "anon" / "publishable" (es pública por diseño; la seguridad la dan las reglas de supabase/schema.sql)
   NUNCA pongas aquí la clave "service_role".
   Si supabaseUrl y supabaseAnonKey están vacíos, la página funciona en modo demostración (datos solo en el navegador).

   ADMINISTRADOR:
     Este archivo es público (vive en un repositorio visible en GitHub), así que
     a propósito NO guarda tu correo ni tu teléfono personales. Para entrar como
     administrador, abre la página, en "Compra tus boletos" pulsa "Acceso
     administrador" y escribe ahí tu correo y contraseña (los mismos que creaste
     en Supabase → Authentication → Users). Esa cuenta se valida en Supabase;
     aquí no se guarda ninguna contraseña. */
window.BJ_CONFIG={
  supabaseUrl:"https://soeurzbfwioldvkkfkpd.supabase.co",
  supabaseAnonKey:"sb_publishable_xFMGM4xQSSpYspeYl2jbpg_MOgXYPdJ"
};
