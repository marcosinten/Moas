ALTER TABLE members ADD COLUMN phone VARCHAR(16)
  CHECK (phone IS NULL OR phone ~ '^[+]?[0-9]{7,15}$');
