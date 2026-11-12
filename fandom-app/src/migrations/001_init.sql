CREATE TABLE admins(
 id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 username TEXT NOT NULL UNIQUE CHECK(username ~ '^[a-z0-9._-]{3,30}$'),
 display_name TEXT NOT NULL CHECK(char_length(btrim(display_name)) BETWEEN 1 AND 60),
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'admin' CHECK(role IN('superadmin','admin')),
 must_change_password INTEGER NOT NULL DEFAULT 1 CHECK(must_change_password IN(0,1)),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE sessions(id TEXT PRIMARY KEY, admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL);
CREATE TABLE members(
 id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 nickname TEXT NOT NULL CHECK(char_length(btrim(nickname)) BETWEEN 1 AND 40),
 birth_date TEXT CHECK(birth_date IS NULL OR birth_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
 country TEXT CHECK(country IS NULL OR char_length(country)<=40), joined_at TEXT,
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
-- Dinamicas y votaciones comparten tabla: misma logica de colaboradores, estados e invitaciones.
CREATE TABLE events(
 id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 kind TEXT NOT NULL CHECK(kind IN('dynamic','voting')),
 name TEXT NOT NULL CHECK(char_length(btrim(name)) BETWEEN 1 AND 80),
 description TEXT CHECK(description IS NULL OR char_length(description)<=1000),
 event_date TEXT NOT NULL, start_time TEXT,
 created_by INTEGER NOT NULL REFERENCES admins(id), supervisor_id INTEGER REFERENCES admins(id),
 status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN('scheduled','finished')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE event_collaborators(
 event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE, admin_id INTEGER NOT NULL REFERENCES admins(id),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','confirmed','cancelled')), PRIMARY KEY(event_id,admin_id));
CREATE TABLE participations(
 event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE, member_id INTEGER NOT NULL REFERENCES members(id),
 participated INTEGER NOT NULL DEFAULT 0 CHECK(participated IN(0,1)),
 votes INTEGER NOT NULL DEFAULT 0 CHECK(votes>=0), PRIMARY KEY(event_id,member_id),
 CHECK(participated=1 OR votes=0));
CREATE TABLE notifications(
 id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE, type TEXT NOT NULL,
 event_id INTEGER REFERENCES events(id) ON DELETE CASCADE, message TEXT NOT NULL,
 read_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX idx_notif_admin ON notifications(admin_id, read_at);
CREATE INDEX idx_events_kind_date ON events(kind, event_date);
CREATE INDEX idx_events_created_by ON events(created_by);
CREATE INDEX idx_events_supervisor ON events(supervisor_id);
CREATE INDEX idx_collab_admin ON event_collaborators(admin_id);
CREATE INDEX idx_partic_member ON participations(member_id);
CREATE INDEX idx_sessions_admin ON sessions(admin_id);
CREATE INDEX idx_sessions_exp ON sessions(expires_at);

-- SEGURIDAD EN SUPABASE: Supabase publica por defecto las tablas del esquema "public" en una API abierta (REST).
-- Activar RLS sin crear politicas la bloquea por completo. Esta app NO usa esa API: se conecta directo a Postgres
-- con su propio login, asi que nadie mas puede leer ni escribir los datos usando la clave publica del proyecto.
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
