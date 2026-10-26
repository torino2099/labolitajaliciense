/* Configuración de la página.

   CONEXIÓN CON SUPABASE (Project Settings → API):
     supabaseUrl      = "Project URL"
     supabaseAnonKey  = clave "anon" / "publishable" (es pública por diseño; la seguridad la dan las reglas de supabase/schema.sql)
   NUNCA pongas aquí la clave "service_role".
   Si supabaseUrl y supabaseAnonKey están vacíos, la página funciona en modo demostración (datos solo en el navegador).

   ADMINISTRADOR:
     adminTel   = celular que, al escribirlo, pide la contraseña de administrador.
     adminEmail = correo del usuario administrador creado en Supabase (Authentication → Users).
                  La contraseña se valida en Supabase; aquí NO se guarda ninguna contraseña. */
window.BJ_CONFIG={
  supabaseUrl:"https://soeurzbfwioldvkkfkpd.supabase.co",
  supabaseAnonKey:"sb_publishable_xFMGM4xQSSpYspeYl2jbpg_MOgXYPdJ",
  adminTel:"3325941532",
  adminEmail:"viveros.flores@gmail.com"
};
