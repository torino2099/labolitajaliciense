# 🎱 La Bolita Jalisciense

Sitio web de la rifa **La Bolita Jalisciense** ("Sorteos reales entre amigos"): reserva de boletos con números al azar, comprobantes de pago, boleto en PDF y panel de administración.

Ahora funciona con **base de datos real (Supabase)**: compradores y administrador comparten la misma información desde cualquier dispositivo. El sitio sigue siendo estático (HTML + CSS + JavaScript) y se publica gratis en GitHub Pages; Supabase pone la base de datos, el almacenamiento de archivos y el inicio de sesión del administrador.

## Cómo funciona

```
Navegador (GitHub Pages)  ──►  Supabase
  index.html + js/app.js         ├─ PostgreSQL: rifas, reservas, boletos, configuración, historial
  js/db.js (capa de datos)       ├─ Storage:    comprobantes (privado) · imágenes y videos (público)
                                 └─ Auth:       correo y contraseña del administrador
```

- Los **números de boleto** los asigna el servidor y la base de datos impide que dos personas tengan el mismo número activo en la misma rifa.
- El **precio** lo calcula el servidor; el navegador no puede alterarlo.
- Las reservas sin comprobante **expiran a las 24 h** y sus números se liberan. Al rechazar o liberar una reserva, sus números se liberan al instante.
- El público **no puede leer ni escribir las tablas directamente**: solo usa funciones (`proponer_numeros`, `crear_reserva`, `mis_reservas`, `registrar_comprobante`). Los comprobantes están en un bucket privado y solo el administrador los ve.
- El administrador entra con **correo y contraseña** (Supabase Auth) y su cuenta debe estar en la tabla `admins`.

## Puesta en marcha (≈ 15 minutos)

### 1) Crear el proyecto en Supabase
1. Crea una cuenta y un proyecto en <https://supabase.com> (el plan gratuito basta para empezar).
2. Abre **SQL Editor → New query**, pega todo el contenido de [`supabase/schema.sql`](supabase/schema.sql) y pulsa **Run**. Crea las tablas, funciones, reglas de seguridad y los dos buckets de archivos.

### 2) Crear al administrador
1. **Authentication → Users → Add user**: tu correo y una contraseña larga (marca *Auto Confirm User*).
2. **Authentication → Sign In / Providers**: desactiva *Allow new users to sign up*.
3. En el SQL Editor ejecuta (con tu correo):

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'TU_CORREO@ejemplo.com';
```

### 3) Conectar la página
En **Project Settings → API** copia el *Project URL* y la clave **anon / publishable**, y pégalos en [`js/config.js`](js/config.js):

```js
window.BJ_CONFIG={
  supabaseUrl:"https://XXXX.supabase.co",
  supabaseAnonKey:"eyJ...",
  adminTel:"3325941532",          // celular que pide la contraseña de administrador
  adminEmail:"TU_CORREO@ejemplo.com" // el correo del usuario creado en el paso 2
};
```

Guarda el archivo y haz `commit`: en unos minutos la página se vuelve a publicar y el aviso de "Modo demostración" desaparece.

La clave anon es pública por diseño (la protegen las reglas de seguridad del SQL). **Nunca** pongas la clave `service_role` en el sitio.

### 4) Publicar en GitHub Pages
1. Sube estos archivos al repositorio (rama `main`).
2. **Settings → Pages → Source: GitHub Actions**. Cada `push` publica el sitio.
3. Si el proyecto vive dentro de una subcarpeta del repositorio (por ejemplo `la-bolita-jalisciense/`), mueve `.github/` a la raíz del repositorio y en `pages.yml` cambia `path: .` por `path: la-bolita-jalisciense`.

### 5) Primer ingreso
Abre el sitio y escribe tu celular de administrador (`adminTel`): aparece el campo **Contraseña de administrador**. Entra con la contraseña del usuario que creaste en el paso 2 y configura precio, textos, imágenes y rifas. Prueba una reserva completa con otro celular. (También puedes entrar con correo y contraseña desde **Acceso administrador**.)

## Cambiar la contraseña de administrador

- **Desde la página:** entra como administrador → pestaña **Cuenta** → escribe la nueva contraseña (mínimo 10 caracteres) dos veces.
- **Si la olvidaste:** en Supabase, **Authentication → Users**, abre tu usuario y elige *Send password recovery*; o, en el SQL Editor:

```sql
update auth.users
   set encrypted_password = extensions.crypt('NUEVA_CONTRASEÑA_LARGA', extensions.gen_salt('bf'))
 where email = 'TU_CORREO@ejemplo.com';
```

> La contraseña **no** se guarda en el código ni en este repositorio: la valida Supabase. En `js/config.js` solo están tu celular de administrador y tu correo.

## ¿Ves el aviso "Modo demostración"?

Significa que `supabaseUrl` y `supabaseAnonKey` en `js/config.js` siguen vacíos (o no se publicaron todavía). Llénalos como en el paso 3. Mientras tanto la página funciona solo con datos del navegador y la contraseña de administrador de prueba es `demo1234`.

## Modo demostración

Si `js/config.js` tiene los valores vacíos, la página funciona sin Supabase guardando todo en el navegador (solo para probar el flujo). Muestra un aviso arriba y el administrador de prueba es `admin@demo.test` / `demo1234`. **No lo uses con público real**: los datos no se comparten entre dispositivos.

## Probar en local

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

No abras `index.html` con doble clic: el navegador bloquea el boleto en PDF al leer imágenes desde `file://`.

## Estructura

```
├── index.html               Página
├── css/styles.css           Estilos (tema claro/oscuro)
├── js/config.js             URL y clave pública de Supabase
├── js/db.js                 Capa de datos: Supabase (o demostración si no hay configuración)
├── js/db-local.js           Modo demostración (localStorage)
├── js/app.js                Lógica de la página
├── supabase/schema.sql      Tablas, funciones, seguridad (RLS) y almacenamiento
├── assets/                  Logo, imagen principal y QR de WhatsApp
└── .github/workflows/       Publicación automática en GitHub Pages
```

## Seguridad: lo que debes saber

- **Acceso del público solo con celular (sin contraseña ni código):** quien conozca el número de un comprador puede ver sus reservas y sus números (no ve comprobantes, pagos ni datos personales). También puede subir un comprobante a una reserva pendiente si conoce su código. Así se pidió el flujo; si quieres cerrarlo, activa verificación por SMS/WhatsApp con Supabase Auth (*Phone*) y ajusta las funciones para exigir esa sesión.
- **Sin límite de intentos:** cualquiera puede llamar a las funciones públicas repetidamente. Para reducir abuso considera Cloudflare Turnstile, límites en un servicio intermedio (Edge Function) y revisar el *rate limiting* de Supabase Auth.
- **El administrador** usa Supabase Auth: elige una contraseña larga y única. Las reglas RLS impiden que otras cuentas lean reservas, comprobantes o cambien precios.
- **Respalda tu base** (Database → Backups) antes de operar la rifa con dinero real.
- Esto es una rifa con cobro: revisa los permisos que exija la ley en tu zona antes de operarla.

## Actualización automática de estados

Las reservas vencidas se marcan como expiradas cada vez que alguien reserva, consulta o el administrador abre el panel. Para hacerlo también en segundo plano (opcional), habilita `pg_cron` y ejecuta:

```sql
select cron.schedule('liberar-vencidas', '*/5 * * * *', $$select public.liberar_vencidas()$$);
```

Los datos se refrescan solos cada 20 segundos mientras la página está abierta.

## Límites actuales

- El panel de administración carga hasta 20 000 reservas; con más volumen conviene paginar.
- Videos hasta 20 MB y comprobantes hasta 5 MB (límite de los buckets).
- El historial de versiones muestra las últimas 10 de costos, textos e imágenes de la rifa principal.

## Licencia

Sin licencia definida. Agrega un archivo `LICENSE` según cómo quieras compartir el código.
