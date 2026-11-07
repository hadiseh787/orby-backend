import {type DB} from './db.js';
import {type Actor} from './auth.js';
import {assert,hash} from './domain.js';
import {proposal,view} from './near.js';

export async function recoverRegistration(db:DB,a:Actor,id:string) {
  assert(a.book==='TESTNET','INVALID_STATE','Registration recovery is only available on testnet.');
  await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',['agent-registration:'+a.book+':'+id]);
  const row=(await db.query('SELECT * FROM agents WHERE id=$1 AND book=$2 FOR UPDATE',[id,a.book])).rows[0];
  assert(row?.owner_id===a.id,'FORBIDDEN','Only the agent owner can recover this registration.',403);
  assert(row.state==='PENDING','AGENT_EXISTS','This agent is already registered.',409);
  const latest=(await db.query("SELECT * FROM chain_operations WHERE account_id=$1 AND proposal->'args'->>'agent_id'=$2 AND proposal->>'methodName' IN ('register_agent','register_near_agent') ORDER BY created_at DESC LIMIT 1 FOR UPDATE",[a.id,id])).rows[0];
  if(latest && ['SUBMITTED','UNKNOWN'].includes(latest.state)) {
    assert(false,'RECONCILIATION_REQUIRED','Check the existing registration transaction before retrying.',409);
  }
  const chain=await view('get_agent',{agent_id:id});
  if(chain) {
    assert(chain.owner===a.id,'AGENT_EXISTS','This Agent ID belongs to another account on the contract.',409);
    assert(chain.manifest_hash===hash(row.data),'MANIFEST_MISMATCH','The on-chain manifest differs from this pending registration. Reconcile the agent metadata before activating it.',409);
    await db.query('UPDATE agents SET state=$3,version=$4 WHERE id=$1 AND book=$2',[id,a.book,chain.active?'ACTIVE':'SUSPENDED',chain.version]);
    return {id,recovered:true};
  }
  // Reuse unsigned operations so a delayed wallet submission and a retry share one request_id.
  if(latest?.state==='PREPARED')return {id,operation:latest.proposal};
  assert(!latest || latest.state==='FAILED','RECONCILIATION_REQUIRED','The registration requires receipt reconciliation.',409);
  return {id,...await proposal(db,a.id,row.data.minPriceNear?'register_near_agent':'register_agent',{
    agent_id:id,manifest_hash:hash(row.data),min_price:row.data.minPriceNear||row.data.minPriceUsdMicro,
  })};
}
