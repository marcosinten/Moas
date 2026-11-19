-- Separate account identity from members; keep generated card selections stable.
CREATE TABLE admin_birthday_assignments (
 admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
 birthday_year INTEGER NOT NULL,
 template_id INTEGER REFERENCES birthday_templates(id) ON DELETE SET NULL,
 message_id INTEGER REFERENCES birthday_profile_messages(id) ON DELETE SET NULL,
 song_id INTEGER REFERENCES birthday_songs(id) ON DELETE SET NULL,
 message_text TEXT,
 song_url TEXT,
 song_title TEXT,
 song_provider TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(admin_id,birthday_year)
);
ALTER TABLE admin_birthday_assignments ENABLE ROW LEVEL SECURITY;
-- Normalize simple legacy labels, leave ambiguous values untouched for manual review.
UPDATE admins SET profile_bias = CASE regexp_replace(lower(btrim(profile_bias)), '[^a-z0-9]', '', 'g')
 WHEN 'soobin' THEN 'Soobin' WHEN 'yeonjun' THEN 'Yeonjun'
 WHEN 'beomgyu' THEN 'Beomgyu' WHEN 'taehyun' THEN 'Taehyun'
 WHEN 'kai' THEN 'Huening Kai' WHEN 'hueningkai' THEN 'Huening Kai'
 WHEN 'ot5' THEN 'OT5' ELSE profile_bias END
WHERE profile_bias IS NOT NULL;
