# 🎱 La Bolita Jalisciense

Sitio web de la rifa **La Bolita Jalisciense** ("Sorteos reales entre amigos"): venta y reserva de boletos con números al azar, comprobantes de pago, boleto en PDF y panel de administración.

Es un sitio estático (HTML + CSS + JavaScript, sin dependencias ni compilación).

> **Importante:** esta versión **no tiene servidor ni base de datos**. Toda la información (reservas, comprobantes, rifas, costos, textos) se guarda en el navegador de cada persona (`localStorage` e `IndexedDB`). Sirve para probar el flujo completo o para uso personal; no sincroniza compradores y administrador entre dispositivos. Ver [Limitaciones](#limitaciones).

## Qué incluye

**Para el público**
- Sesión automática al escribir el celular de 10 dígitos (sin contraseña ni códigos).
- Reserva de boletos con **números al azar libres** (del 00000001 al 99999999, por rifa), con vista previa antes de aceptar y botón **🔄 Cambiar números**.
- Compra rápida de 50, 100 y 200 boletos.
- Subida de comprobante de pago (JPG, PNG, WebP o PDF, máx. 5 MB) con aviso de "Archivo aceptado".
- Cada compra se muestra como un **boleto**: rifa, código, fecha y hora, y boletos seleccionados.
- Estados: pendiente de pago → revisión de pago → validado, o rechazado/expirado (los números se liberan al instante). Las reservas sin comprobante expiran a las 24 h.
- **Descarga del boleto en PDF**, habilitada solo cuando el pago está validado.
- Varias rifas, cada una con imagen o video, premio, fecha y precio propios.

**Para el administrador** (celular configurado en `js/config.js` + contraseña)
- Costos: precio por boleto.
- Contenido: nombre, premio, descripción, fecha, lugar, método de sorteo, instrucciones de pago, contacto, reglamento y pie de página.
- Imágenes: cambiar logo e imagen principal.
- Nueva rifa: formulario con botón para cargar imagen o video.
- Reservas: ver comprobantes junto al celular de cada usuario, validar, rechazar o liberar.
- Bases de datos por rifa, con búsqueda, filtros y exportación a CSV.
- **No comprobado**: referencia de números liberados por falta de pago y quién los tomó después.
- Historial de versiones (últimas 10) con restauración.

## Estructura

```
├── index.html             Página (estructura)
├── css/styles.css         Estilos (tema claro/oscuro)
├── js/config.js           Celular y hash de contraseña del administrador
├── js/app.js              Lógica de la página
├── assets/                Logo, imagen principal y QR del canal de WhatsApp
└── .github/workflows/     Publicación automática en GitHub Pages
```

## Probar en local

Abre la carpeta con un servidor estático (no con doble clic en `index.html`, porque el navegador bloquea el boleto en PDF por seguridad al leer imágenes desde `file://`):

```bash
python3 -m http.server 8000
# luego abre http://localhost:8000
```

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub y sube estos archivos a la rama `main`.
2. En **Settings → Pages**, en *Source* elige **GitHub Actions**.
3. Cada `push` a `main` publica el sitio. La dirección aparece en la pestaña **Actions** y en **Settings → Pages**.

## Configurar el administrador

Edita `js/config.js`:

- `adminTel`: celular de 10 dígitos que abre el panel.
- `adminHash`: SHA-256 de la contraseña. Para generarlo:

```bash
printf '%s' 'TU_CONTRASEÑA' | sha256sum
```

Para entrar como administrador, escribe ese celular en el campo de acceso; aparecerá el campo de contraseña.

> ⚠️ Con un sitio estático, el hash queda visible en el código. Usa una contraseña larga y única, o mantén el repositorio privado. Esto **no** es seguridad real: cualquiera puede leer el código de la página.

## Personalizar

- **Colores y estilo:** variables al inicio de `css/styles.css`.
- **Textos, precio e imágenes:** desde el panel de administración (se guardan en el navegador).
- **Valores iniciales:** `CFG` al inicio de `js/app.js` (precio por defecto $1.50 MXN).
- **QR de WhatsApp:** reemplaza `assets/qr-whatsapp.jpg` y el enlace del botón en `index.html`.

## Limitaciones

- Los datos no se comparten entre dispositivos: el administrador no ve las reservas ni los comprobantes de otros compradores, y dos personas pueden recibir los mismos números.
- No hay autenticación real ni protección de comprobantes.
- Los videos y comprobantes pesados dependen del espacio que permita el navegador.

## Siguiente paso recomendado

Para operar la rifa con público real hace falta un servidor y base de datos compartida. La ruta sugerida:

- Next.js + TypeScript + Tailwind en Vercel
- Supabase (PostgreSQL, Realtime y Storage para comprobantes e imágenes)
- Autenticación del administrador con correo y contraseña, y acceso del público solo con celular
- Reglas de seguridad para que cada usuario vea solo sus reservas y solo el administrador vea todo

## Licencia

Sin licencia definida. Agrega un archivo `LICENSE` según cómo quieras compartir el código.
