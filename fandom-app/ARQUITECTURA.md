# Arquitectura – Panel del Fandom

## Decisiones
| Tema | Decisión | Por qué |
|---|---|---|
| Backend | Node.js + Express | Simple, muy documentado, fácil de ampliar con módulos |
| Base de datos | **PostgreSQL en Supabase** con el paquete `pg` | Gratis y siempre en la nube: los datos no dependen del servidor, que puede reiniciarse o dormirse sin perder nada |
| Frontend | HTML/JS en `public/` (hoy simple) | Se puede cambiar a React/Vue después sin tocar el backend: todo pasa por `/api/...` |
| Sesiones | Cookie HttpOnly + sesión guardada en la base | No se pierde al reiniciar; JavaScript no puede leer la cookie |
| Contraseñas | scrypt con sal (nativo de Node) | Nunca se guarda la clave real |

Los módulos usan `db.all / db.one / db.run / db.tx` con SQL de Postgres (parámetros `$1, $2…`). Todo el código de rutas es `async` y va envuelto en `ah(...)` para que los errores lleguen al manejador central.

## Estructura
```
src/
  server.js            arranque (seguridad básica, apagado limpio)
  core/                config, db + migraciones, validación, cargador de módulos
  migrations/          001_init.sql, 002_...sql  (cada cambio de tablas = archivo nuevo)
  modules/
    auth/              login, logout, cambio de clave, crear administradoras
    (members/ events/ notifications/ ...)   <- siguientes módulos
scripts/create-admin.js   crea la primera administradora (superadmin)
public/                   pantallas: index.html + app.css (vidrio, tokens) + app.js (sin dependencias) + icons.svg (Lucide) + fonts/ (autoalojadas)
```
**Agregar un módulo** = crear `src/modules/nombre/index.js` que exporte `register({app,db})`. Se carga solo.
Dinámicas y votaciones comparten la tabla `events` (`kind`): misma lógica de colaboradoras, invitaciones y estados.

## Usuarios
1. Tú creas la primera cuenta (superadmin): `npm run create-admin -- laura "Laura" superadmin`. Imprime una clave temporal.
2. La superadmin crea al resto desde la página (`POST /api/admins`): se genera una clave temporal que se muestra una sola vez y cada administradora la cambia al entrar.
3. Máximo 5 intentos fallidos por 15 minutos.

## Datos limpios
- **ASCII estricto solo en usuarios** (`a-z 0-9 . _ -`). Nombres y descripciones van en UTF-8 porque necesitan tildes y ñ; se normalizan (sin espacios dobles ni caracteres de control, con largo máximo).
- **RLS activado** en todas las tablas (sin políticas): la API pública de Supabase no puede leer ni escribir; solo esta app, conectada directo a Postgres.
- La base se protege sola con `CHECK`: votos nunca negativos, sin votos si no participó, fechas válidas, solo estados permitidos.
- Consultas siempre parametrizadas.

## Reglas de dinámicas/votaciones ya reflejadas en las tablas
- `events.status`: `scheduled` (editable) -> `finished` (bloqueada, solo eliminable). **El bloqueo se aplica en el módulo events** (siguiente paso).
- `event_collaborators.status`: `pending` / `confirmed` / `cancelled`, más `notifications` para la barra de avisos.
- `participations`: ✔/✖ por integrante y, en votaciones, número de votos.

## Para que no se caiga ni se pierdan datos
- Los datos están en Supabase; el servidor (Render) no guarda nada, así que se puede reiniciar o redesplegar sin riesgo.
- Plan gratis: Render se duerme tras 15 min sin visitas y Supabase se pausa tras 1 semana sin actividad -> monitor externo (UptimeRobot) sobre `GET /api/health`, que consulta la base. Ver DESPLIEGUE.md.
- Sin respaldos automáticos en el plan gratis de Supabase: `pg_dump` periódico (ver DESPLIEGUE.md).
- HTTPS lo da Render; usar `NODE_ENV=production` (cookie `Secure`).

## Arranque
    npm install
    npm run create-admin -- usuario "Nombre" superadmin
    npm start      # http://localhost:3000   (requiere DATABASE_URL, ver .env.example)

## Próximos pasos
1. **members** (registro de integrantes). 2. **events** (dinámicas/votaciones, edición, bloqueo al finalizar). 3. **notifications** (aceptar/rechazar invitaciones). 4. Pantallas con cards, historial, ✔/✖ y +/- de votos.

## API de administradoras y selección múltiple
- `GET /api/admins` (activas, para selectores) · `GET /api/admins?manage=1` (superadmin: todas, con estado e historial)
- `POST /api/admins` · `PATCH /api/admins/:id` (nombre, usuario, rol, active, `reset_password`) · `DELETE /api/admins/:id`
- Borrado múltiple: `POST /api/admins/bulk-delete`, `POST /api/members/bulk-delete`, `POST /api/events/bulk-delete` con `{ids:[...]}`. Devuelven cuántas se borraron / dieron de baja y cuáles se omitieron con el motivo.
