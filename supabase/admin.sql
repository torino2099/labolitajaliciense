-- =====================================================================
-- La Bolita Jalisciense · diagnóstico y arreglo del acceso de administrador
-- Supabase → SQL Editor → New query. Ejecuta los pasos UNO POR UNO.
-- Reemplaza TU_CORREO@ejemplo.com por el correo del administrador.
-- =====================================================================

-- PASO 1 · DIAGNÓSTICO (no modifica nada): ¿cómo están tus usuarios?
--   confirmado        debe ser true
--   tiene_identidad   debe ser true  (si es false, el usuario se creó con SQL y NO puede iniciar sesión)
--   es_admin          debe ser true
select u.id, u.email,
       u.email_confirmed_at is not null                                  as confirmado,
       exists (select 1 from auth.identities i where i.user_id = u.id)   as tiene_identidad,
       exists (select 1 from public.admins a where a.user_id = u.id)     as es_admin
from auth.users u
order by u.created_at desc;

-- PASO 2 · Si tiene_identidad = false: ese usuario está dañado.
--   BÓRRALO desde Authentication → Users (menú ⋯ → Delete user) y créalo de nuevo con
--   "Add user → Create new user": tu correo, tu contraseña y la casilla "Auto Confirm User" marcada.
--   (No crees usuarios con INSERT en auth.users: Supabase no los reconoce para iniciar sesión.)
--   Al borrar y crear, el usuario recibe un id NUEVO, así que hay que repetir el PASO 3.

-- PASO 3 · Dar permiso de administrador al usuario (ejecútalo después de crear el usuario)
insert into public.admins (user_id)
select id from auth.users where email = 'TU_CORREO@ejemplo.com'
on conflict do nothing;

-- PASO 4 · Verifica: debe aparecer 1 fila con tu correo
select a.user_id, u.email from public.admins a join auth.users u on u.id = a.user_id;

-- OPCIONAL · Cambiar la contraseña de un usuario que SÍ se creó con "Add user"
-- update auth.users
--    set encrypted_password = extensions.crypt('NUEVA_CONTRASEÑA_LARGA', extensions.gen_salt('bf')),
--        updated_at = now()
--  where email = 'TU_CORREO@ejemplo.com';

-- OPCIONAL · Confirmar un correo que quedó sin confirmar
-- update auth.users set email_confirmed_at = now()
--  where email = 'TU_CORREO@ejemplo.com' and email_confirmed_at is null;
