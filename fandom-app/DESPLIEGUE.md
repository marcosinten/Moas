# Publicar gratis y que quede siempre activa

Piezas (todas con plan gratuito): **Supabase** guarda los datos · **Render** corre el servidor · **UptimeRobot** lo mantiene despierto.
Los datos viven en Supabase, no en el servidor: si Render reinicia o se duerme, no se pierde nada.

## 1. Supabase (base de datos)
1. Crea una cuenta en supabase.com y un proyecto nuevo. Guarda la **contraseña de la base** que eliges (no la podrás ver después, solo restablecer).
2. Botón **Connect** (arriba) → copia la cadena **Session pooler** (puerto 5432). Se parece a:
   `postgresql://postgres.xxxx:[TU-CLAVE]@aws-0-REGION.pooler.supabase.com:5432/postgres`
   Reemplaza `[TU-CLAVE]` por tu contraseña. Si tiene símbolos (`@ : / # ?`), escríbelos codificados (`%40 %3A %2F %23 %3F`) o elige una clave solo con letras y números.
3. No necesitas crear tablas: la app las crea sola al arrancar (`src/migrations/001_init.sql`). Esa migración también activa **RLS** en todas las tablas para que nadie pueda leerlas con la clave pública de Supabase.

## 2. Crear tu cuenta de superadmin (desde tu computadora, una sola vez)
Necesitas Node.js 18+ (https://nodejs.org).

    cp .env.example .env        # y pega tu DATABASE_URL dentro de .env
    npm install
    npm run create-admin -- tuusuario "Tu Nombre" superadmin

Imprime una clave temporal; la app te pedirá cambiarla al entrar. **No uses `seed-demo` con la base real** (crea usuarios con clave `demo1234`).

## 3. Render (servidor)
1. Sube esta carpeta a un repositorio de GitHub (`.env` y `node_modules` ya están excluidos por `.gitignore`).
2. En Render: **New → Blueprint** (usa `render.yaml`) o **New → Web Service** con Build `npm install`, Start `npm start`, plan **Free**, Health Check Path `/api/health`.
3. Variables de entorno: `DATABASE_URL` (la cadena del paso 1), `NODE_ENV=production`, `SESSION_HOURS=12`.
4. Despliega. Render te da una dirección `https://...onrender.com`.

## 4. Mantenerla siempre activa (UptimeRobot)
El plan gratis de Render se duerme tras 15 minutos sin visitas, y los proyectos gratis de Supabase se pausan tras 1 semana sin actividad.
1. Crea una cuenta gratis en uptimerobot.com → **Add New Monitor** → tipo HTTP(s).
2. URL: `https://TU-APP.onrender.com/api/health`, intervalo: el más corto que permita el plan gratis (5 minutos).
3. Ese endpoint consulta la base, así que **también evita la pausa de Supabase**.

## Respaldos (importante)
El plan gratis de Supabase no incluye copias de seguridad automáticas. De vez en cuando, desde tu computadora (necesita `pg_dump`, viene con PostgreSQL):

    pg_dump "TU_DATABASE_URL" -Fc -f respaldo-$(date +%F).dump

## Si algo falla
- *No arranca en Render*: mira los Logs. "Falta la variable DATABASE_URL" = no la pegaste en el panel.
- *Error de conexión / ENETUNREACH*: usa la cadena **Session pooler**, no la "Direct connection".
- *Tras días sin uso la base no responde*: entra al panel de Supabase y pulsa **Resume project**.
