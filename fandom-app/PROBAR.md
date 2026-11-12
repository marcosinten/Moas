# Cómo probar el sistema

Necesitas Node.js 18 o superior (https://nodejs.org) y una base PostgreSQL: lo más fácil es un proyecto gratis de Supabase
(mira DESPLIEGUE.md, paso 1). Usa un proyecto de **pruebas**, separado del real.

    cp .env.example .env     # pega tu DATABASE_URL; para probar en local borra la línea NODE_ENV=production
    npm install
    npm run seed-demo        # SOLO PARA PRUEBAS: crea 3 administradoras y 12 integrantes de ejemplo
    npm start

Abre http://localhost:3000   (con un Postgres local sin SSL agrega `DB_SSL=false` en .env)

Usuarios de prueba (clave `demo1234`): **laura** (superadmin), **sofia**, **mia**.
Para ver las invitaciones abre dos ventanas: una en modo normal con laura y otra en modo incógnito con sofia.

## Qué probar
1. laura -> Votaciones -> Crear: nombre, fecha, hora, supervisora (Sofía) y colaboradoras.
2. sofia -> 🔔: aparece la invitación; Aceptar. laura recibe el aviso y ve a Sofía confirmada (✔).
3. Entrar a la votación: ✔/✖ por integrante; al marcar ✔ se abre la ventana de votos (+ / −, nunca menos de 0). Guardar participación.
4. Finalizar: queda bloqueada (solo se puede eliminar). Aparece en 🕒 Historial.
5. laura -> Administradoras: crear, editar (nombre, usuario, rol, activa), restablecer clave (muestra la clave temporal una sola vez) y eliminar. Quien ya participó en dinámicas o votaciones se da de baja en lugar de borrarse; nadie puede eliminarse a sí misma y siempre queda al menos una superadmin activa.
6. **Seleccionar varios**: en Integrantes, Dinámicas, Votaciones y Administradoras, el botón "Seleccionar varios" activa la selección (clic en las cards, "Seleccionar todo", Esc para salir) y permite eliminar en bloque. Dentro de una dinámica o votación sirve para marcar varios integrantes como "Participó" / "No participó" de una vez (luego se pulsa "Guardar participación").

## Para usar de verdad (sin datos de prueba)
Usa la base real y crea tu cuenta con `npm run create-admin -- usuario "Nombre" superadmin`. Luego sigue DESPLIEGUE.md.
