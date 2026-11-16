CREATE TABLE IF NOT EXISTS birthday_categories (
  id text PRIMARY KEY,
  label text NOT NULL
);
INSERT INTO birthday_categories VALUES
 ('soobin','Soobin'),('yeonjun','Yeonjun'),('beomgyu','Beomgyu'),
 ('taehyun','Taehyun'),('kai','Huening Kai'),('ot5','OT5')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE members ADD COLUMN IF NOT EXISTS bias text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS birthday_category text REFERENCES birthday_categories(id);
CREATE OR REPLACE VIEW birthday_bias_review AS
SELECT id, nickname, bias, birthday_category,
 CASE regexp_replace(lower(btrim(bias)), '[^a-z0-9]', '', 'g')
  WHEN 'soobin' THEN 'soobin' WHEN 'choisoobin' THEN 'soobin'
  WHEN 'yeonjun' THEN 'yeonjun' WHEN 'choiyeonjun' THEN 'yeonjun'
  WHEN 'beomgyu' THEN 'beomgyu' WHEN 'choibeomgyu' THEN 'beomgyu'
  WHEN 'taehyun' THEN 'taehyun' WHEN 'kangtaehyun' THEN 'taehyun'
  WHEN 'kai' THEN 'kai' WHEN 'hueningkai' THEN 'kai' WHEN 'hyukakai' THEN 'kai' WHEN 'hyuka' THEN 'kai'
  WHEN 'ot5' THEN 'ot5' WHEN 'todos' THEN 'ot5' WHEN 'txt' THEN 'ot5'
 END AS proposed_category
FROM members;
REVOKE ALL ON birthday_bias_review FROM PUBLIC;
DO $$
BEGIN
 IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
   EXECUTE 'REVOKE ALL ON birthday_bias_review FROM anon';
 END IF;
 IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
   EXECUTE 'REVOKE ALL ON birthday_bias_review FROM authenticated';
 END IF;
END $$;

UPDATE members AS m SET birthday_category = r.proposed_category
FROM birthday_bias_review AS r
WHERE m.id = r.id AND m.birthday_category IS NULL AND r.proposed_category IS NOT NULL;

CREATE TABLE IF NOT EXISTS birthday_templates (
  category text PRIMARY KEY REFERENCES birthday_categories(id),
  image bytea NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS birthday_messages (
  member_id bigint NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  birthday_year integer NOT NULL CHECK (birthday_year BETWEEN 1900 AND 9999),
  admin_id bigint NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 160),
  approved boolean NOT NULL DEFAULT false,
  PRIMARY KEY (member_id, birthday_year, admin_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_approved_birthday_message
 ON birthday_messages(member_id, birthday_year) WHERE approved;
ALTER TABLE birthday_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE birthday_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE birthday_messages ENABLE ROW LEVEL SECURITY;
