CREATE TABLE birthday_profile_messages (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_id INTEGER NOT NULL UNIQUE REFERENCES admins(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 180),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE birthday_songs (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  url TEXT NOT NULL CHECK (char_length(url) BETWEEN 1 AND 2048),
  provider TEXT,
  title TEXT,
  thumbnail_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (admin_id, url)
);

ALTER TABLE notifications ADD COLUMN birthday_item_id INTEGER;
ALTER TABLE birthday_profile_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE birthday_songs ENABLE ROW LEVEL SECURITY;
