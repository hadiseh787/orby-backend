CREATE TABLE workspaces(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),book text NOT NULL CHECK(book IN ('SIMULATION','TESTNET')),owner_id text NOT NULL REFERENCES accounts(id),payment_account text NOT NULL REFERENCES accounts(id),name text NOT NULL,kind text NOT NULL CHECK(kind IN ('PERSONAL','TEAM')),created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX personal_workspace ON workspaces(owner_id,book) WHERE kind='PERSONAL';
CREATE TABLE workspace_members(workspace_id uuid NOT NULL REFERENCES workspaces(id),account_id text NOT NULL REFERENCES accounts(id),role text NOT NULL CHECK(role IN ('OWNER','MEMBER','REVIEWER')),active boolean NOT NULL DEFAULT true,joined_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(workspace_id,account_id));
CREATE TABLE workspace_invites(id uuid PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES workspaces(id),token_hash text NOT NULL UNIQUE,role text NOT NULL CHECK(role IN ('MEMBER','REVIEWER')),expires_at timestamptz NOT NULL,accepted_by text REFERENCES accounts(id),revoked boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now());
CREATE FUNCTION orby_personal_workspace(who text,which_book text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE wid uuid;
BEGIN
 INSERT INTO workspaces(owner_id,payment_account,book,name,kind) VALUES(who,who,which_book,'Personal workspace','PERSONAL') ON CONFLICT(owner_id,book) WHERE kind='PERSONAL' DO NOTHING;
 SELECT id INTO wid FROM workspaces WHERE owner_id=who AND book=which_book AND kind='PERSONAL';
 INSERT INTO workspace_members(workspace_id,account_id,role) VALUES(wid,who,'OWNER') ON CONFLICT DO NOTHING;
 RETURN wid;
END;$$;
ALTER TABLE jobs ADD COLUMN workspace_id uuid REFERENCES workspaces(id);
ALTER TABLE job_attachments ADD COLUMN workspace_id uuid REFERENCES workspaces(id);
ALTER TABLE knowledge_collections ADD COLUMN workspace_id uuid REFERENCES workspaces(id);
ALTER TABLE job_templates ADD COLUMN workspace_id uuid REFERENCES workspaces(id);
ALTER TABLE workspace_programs ADD COLUMN workspace_id uuid REFERENCES workspaces(id);
UPDATE jobs SET workspace_id=orby_personal_workspace(client_id,book) WHERE parent_id IS NULL;
UPDATE jobs child SET workspace_id=root.workspace_id FROM jobs root WHERE child.parent_id=root.id;
UPDATE job_attachments SET workspace_id=orby_personal_workspace(owner_id,book);
UPDATE knowledge_collections SET workspace_id=orby_personal_workspace(owner_id,book);
UPDATE job_templates SET workspace_id=orby_personal_workspace(owner_id,book);
UPDATE workspace_programs SET workspace_id=orby_personal_workspace(owner_id,book);
CREATE FUNCTION orby_resource_workspace() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.workspace_id IS NULL THEN
  IF TG_TABLE_NAME='jobs' THEN
   IF NEW.parent_id IS NOT NULL THEN SELECT workspace_id INTO NEW.workspace_id FROM jobs WHERE id=NEW.parent_id; END IF;
   IF NEW.workspace_id IS NULL THEN NEW.workspace_id:=orby_personal_workspace(NEW.client_id,NEW.book); END IF;
  ELSE NEW.workspace_id:=orby_personal_workspace(NEW.owner_id,NEW.book); END IF;
 END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER jobs_workspace BEFORE INSERT ON jobs FOR EACH ROW EXECUTE FUNCTION orby_resource_workspace();
CREATE TRIGGER attachments_workspace BEFORE INSERT ON job_attachments FOR EACH ROW EXECUTE FUNCTION orby_resource_workspace();
CREATE TRIGGER knowledge_workspace BEFORE INSERT ON knowledge_collections FOR EACH ROW EXECUTE FUNCTION orby_resource_workspace();
CREATE TRIGGER templates_workspace BEFORE INSERT ON job_templates FOR EACH ROW EXECUTE FUNCTION orby_resource_workspace();
CREATE TRIGGER programs_workspace BEFORE INSERT ON workspace_programs FOR EACH ROW EXECUTE FUNCTION orby_resource_workspace();
ALTER TABLE jobs ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE job_attachments ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE knowledge_collections ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE job_templates ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE workspace_programs ALTER COLUMN workspace_id SET NOT NULL;
CREATE TABLE workspace_drafts(id uuid PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES workspaces(id),author_id text NOT NULL REFERENCES accounts(id),data jsonb NOT NULL,revision integer NOT NULL DEFAULT 1,published_job_id uuid REFERENCES jobs(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE workspace_reviews(id uuid PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES workspaces(id),job_id uuid NOT NULL REFERENCES jobs(id),actor text NOT NULL REFERENCES accounts(id),revision integer NOT NULL,delivery_hash text NOT NULL,recommendation text NOT NULL CHECK(recommendation IN ('APPROVE','CHANGES')),comment text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(job_id,actor,revision,delivery_hash));
CREATE INDEX jobs_workspace_index ON jobs(workspace_id,updated_at DESC);
