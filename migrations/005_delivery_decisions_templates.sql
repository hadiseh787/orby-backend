ALTER TABLE chain_operations ADD COLUMN candidate_tx_hash text;
ALTER TABLE chain_operations ADD COLUMN context jsonb NOT NULL DEFAULT '{}';
CREATE TABLE delivery_decisions (
  id uuid PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES jobs(id),
  revision integer NOT NULL,
  delivery_hash text NOT NULL,
  actor text NOT NULL REFERENCES accounts(id),
  kind text NOT NULL CHECK(kind IN ('APPROVE','REVISION_REQUEST','EVIDENCE_FLAG')),
  section text NOT NULL DEFAULT '',
  reason text NOT NULL DEFAULT '',
  tx_hash text,
  basis text NOT NULL DEFAULT 'EXPLICIT_ACTION',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(job_id,revision,kind,actor,section)
);
CREATE TABLE job_templates (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL REFERENCES accounts(id),
  book text NOT NULL CHECK(book IN ('SIMULATION','TESTNET')),
  name text NOT NULL,
  blueprint jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX job_templates_owner ON job_templates(owner_id,book);
-- Preserve only evidence of a real client decision; a dispute award is not an approval.
INSERT INTO delivery_decisions(id,job_id,revision,delivery_hash,actor,kind,basis,created_at)
SELECT md5(j.id::text||':approval:'||d.revision)::uuid,j.id,d.revision,d.hash,j.client_id,'APPROVE','SETTLEMENT_EVENT',e.created_at
FROM jobs j
JOIN LATERAL (SELECT * FROM deliveries WHERE job_id=j.id ORDER BY revision DESC LIMIT 1) d ON true
JOIN LATERAL (SELECT * FROM job_events WHERE job_id=j.id AND type='job_settled' AND actor=j.client_id AND data->>'reason'='approved' ORDER BY id DESC LIMIT 1) e ON true
WHERE j.book='SIMULATION' AND j.state='SETTLED' AND j.data->>'approvalPolicy'='MANUAL_APPROVAL';
INSERT INTO delivery_decisions(id,job_id,revision,delivery_hash,actor,kind,tx_hash,basis,created_at)
SELECT md5(o.id::text||':client-approval')::uuid,j.id,d.revision,d.hash,j.client_id,'APPROVE',o.tx_hash,'FINAL_TESTNET_RECEIPT',o.updated_at
FROM chain_operations o JOIN jobs j ON j.id=o.job_id
JOIN LATERAL (SELECT * FROM deliveries WHERE job_id=j.id ORDER BY revision DESC LIMIT 1) d ON true
WHERE o.state='CONFIRMED' AND o.account_id=j.client_id AND o.proposal->>'methodName' IN ('approve_job','approve_delivery') AND j.state='SETTLED'
ON CONFLICT DO NOTHING;
