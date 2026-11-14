CREATE TABLE model_runs (
  run_key text PRIMARY KEY,
  job_id uuid REFERENCES jobs(id),
  input_hash text NOT NULL,
  state text NOT NULL CHECK(state IN ('RUNNING','SUCCEEDED','UNKNOWN')),
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX model_runs_job ON model_runs(job_id);
