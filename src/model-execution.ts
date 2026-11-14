import {pool} from './db.js';
import {hash,assert} from './domain.js';
import {runModel,deterministicBrief} from './runtime.js';
import {config} from './config.js';

export async function executeModel(job:any,input:any,revision:number){
 if(job.data.runtimeMode==='DETERMINISTIC')return {content:deterministicBrief(input),mode:'DETERMINISTIC',usage:null,forcedFailure:null};
 if(!config.model&&job.data.runtimeMode!=='REAL_AI')return {content:deterministicBrief(input),mode:'DETERMINISTIC',usage:null,forcedFailure:null};
 const key=job.id+':delivery:'+revision,digest=hash(input);
 const inserted=await pool.query("INSERT INTO model_runs(run_key,job_id,input_hash,state) VALUES($1,$2,$3,'RUNNING') ON CONFLICT DO NOTHING RETURNING run_key",[key,job.id,digest]);
 if(!inserted.rowCount){const old=(await pool.query('SELECT * FROM model_runs WHERE run_key=$1',[key])).rows[0];assert(old.input_hash===digest,'RUNTIME_INPUT_CHANGED','The immutable execution input changed.');if(old.state==='SUCCEEDED')return old.data;return failure('UNKNOWN_PREVIOUS_RESULT');}
 try{assert(config.model,'MODEL_NOT_CONFIGURED','Real AI is not configured.');const result=await runModel(input);const output={...result,forcedFailure:null};await pool.query("UPDATE model_runs SET state='SUCCEEDED',data=$2,updated_at=now() WHERE run_key=$1",[key,output]);return output;}catch(error:any){const data=failure(error.name==='TimeoutError'?'TIMEOUT':error.code||'MODEL_UNAVAILABLE');await pool.query("UPDATE model_runs SET state='UNKNOWN',data=$2,updated_at=now() WHERE run_key=$1",[key,data]);return data;}
}
function failure(code:string){return {content:{comparison:[],recommendation:'The model attempt did not produce a confirmed result. No accepted work or payment is claimed.',sources:[]},mode:'REAL_AI_UNAVAILABLE',usage:{model:config.model,provider:config.modelProvider,costComplete:false,billedUsd:null,notice:'Attempt outcome/cost unknown; the same request will not be blindly repeated.'},forcedFailure:code};}
export function executionChecks(job:any,revision:number,result:any,checks:any[]){
 const controlled=!!job.parent_id&&!!job.data.missionPlan?.controlledFailure&&revision===0;
 if(result.forcedFailure||controlled)checks.push({id:controlled?'demo-controlled-first-attempt':'runtime-completion',type:'AUTO_CHECK',required:true,result:'FAIL',description:controlled?'Explicitly requested demo fault: reject the first specialist attempt.':'A confirmed real model result is required.',detail:result.forcedFailure||'CONTROLLED_DEMO_FAILURE'});
 return checks;
}
