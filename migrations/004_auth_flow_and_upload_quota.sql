ALTER TABLE auth_nonces ADD COLUMN flow text NOT NULL DEFAULT 'DIRECT' CHECK(flow IN ('DIRECT','REDIRECT'));
CREATE INDEX attachments_owner ON job_attachments(owner_id);
