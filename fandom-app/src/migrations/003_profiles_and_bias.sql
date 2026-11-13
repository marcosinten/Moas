ALTER TABLE admins
  ADD COLUMN profile_birth_date TEXT,
  ADD COLUMN profile_country VARCHAR(40),
  ADD COLUMN profile_bias VARCHAR(60),
  ADD COLUMN profile_photo BYTEA CHECK (octet_length(profile_photo) <= 65536),
  ADD COLUMN profile_palette TEXT NOT NULL DEFAULT 'default'
    CHECK (profile_palette IN ('default','rose','lavender','mint','peach'));

ALTER TABLE members ADD COLUMN bias VARCHAR(60);
