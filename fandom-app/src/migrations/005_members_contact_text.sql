ALTER TABLE members
  DROP CONSTRAINT members_phone_check,
  ALTER COLUMN phone TYPE VARCHAR(80);
