ALTER TABLE members ADD COLUMN created_by INTEGER REFERENCES admins(id) ON DELETE SET NULL;
CREATE INDEX idx_members_created_by ON members(created_by);

