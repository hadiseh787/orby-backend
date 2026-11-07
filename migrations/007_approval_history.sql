INSERT INTO job_events(job_id,actor,type,data,created_at)
SELECT d.job_id,d.actor,'client_approved',jsonb_strip_nulls(jsonb_build_object('revision',d.revision,'deliveryHash',d.delivery_hash,'basis',d.basis,'txHash',d.tx_hash)),d.created_at
FROM delivery_decisions d WHERE d.kind='APPROVE'
AND NOT EXISTS(SELECT 1 FROM job_events e WHERE e.job_id=d.job_id AND e.type='client_approved' AND (e.data->>'revision')::int=d.revision);
