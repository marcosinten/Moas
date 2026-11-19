-- Preserve the old template as the first variant of its category.
CREATE TABLE birthday_template_variants (
 id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 category TEXT NOT NULL REFERENCES birthday_categories(id),
 image BYTEA NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO birthday_template_variants(category,image,updated_at)
 SELECT category,image,updated_at FROM birthday_templates;
DROP TABLE birthday_templates;
ALTER TABLE birthday_template_variants RENAME TO birthday_templates;
CREATE INDEX birthday_templates_category ON birthday_templates(category,id);
ALTER TABLE birthday_templates ENABLE ROW LEVEL SECURITY;

CREATE TABLE birthday_assignments (
 member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
 birthday_year INTEGER NOT NULL,
 template_id INTEGER REFERENCES birthday_templates(id) ON DELETE SET NULL,
 message_id INTEGER REFERENCES birthday_profile_messages(id) ON DELETE SET NULL,
 song_id INTEGER REFERENCES birthday_songs(id) ON DELETE SET NULL,
 message_text TEXT,
 song_url TEXT,
 song_title TEXT,
 song_provider TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(member_id,birthday_year)
);
ALTER TABLE birthday_assignments ENABLE ROW LEVEL SECURITY;

CREATE TABLE admin_participations (
 event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
 admin_id INTEGER NOT NULL REFERENCES admins(id),
 participated INTEGER NOT NULL DEFAULT 0 CHECK(participated IN (0,1)),
 votes INTEGER NOT NULL DEFAULT 0 CHECK(votes>=0),
 PRIMARY KEY(event_id,admin_id), CHECK(participated=1 OR votes=0)
);
ALTER TABLE admin_participations ENABLE ROW LEVEL SECURITY;
CREATE INDEX admin_participations_admin ON admin_participations(admin_id);
