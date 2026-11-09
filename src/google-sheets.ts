import {randomBytes,randomUUID,createHash,createCipheriv,createDecipheriv} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {z} from 'zod';
import {type FastifyInstance} from 'fastify';
import {pool,transaction,type DB} from './db.js';
import {actor,type Actor} from './auth.js';
import {config} from './config.js';
import {assert,hash} from './domain.js';
import {loadJob,mutate} from './market.js';
import {latestDelivery} from './delivery-decisions.js';
import {requireWorkspaceRole} from './workspace-access.js';

const scope='https://www.googleapis.com/auth/spreadsheets';
export const googleReady=()=>!!(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET);
function key(){
  if(process.env.INTEGRATION_ENCRYPTION_KEY){const k=Buffer.from(process.env.INTEGRATION_ENCRYPTION_KEY,'base64');assert(k.length===32,'CONFIG_INVALID','Integration encryption key must be 32 random bytes in base64.',503);return k;}
  mkdirSync('.data',{recursive:true});const path='.data/google-token.key';
  if(!existsSync(path)){try{writeFileSync(path,randomBytes(32),{flag:'wx',mode:0o600});}catch(e:any){if(e.code!=='EEXIST')throw e;}}
  const k=readFileSync(path);assert(k.length===32,'CONFIG_INVALID','The local integration key is invalid.',503);return k;
}
export function encryptTokens(value:any){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv),bytes=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),bytes]).toString('base64');}
function decryptTokens(value:string){const bytes=Buffer.from(value,'base64'),cipher=createDecipheriv('aes-256-gcm',key(),bytes.subarray(0,12));cipher.setAuthTag(bytes.subarray(12,28));return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)),cipher.final()]).toString());}
async function tokenExchange(body:Record<string,string>){
  assert(googleReady(),'GOOGLE_NOT_CONFIGURED','Configure the Google OAuth client on the server before connecting.',503);
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...body,client_id:process.env.GOOGLE_CLIENT_ID!,client_secret:process.env.GOOGLE_CLIENT_SECRET!}),signal:AbortSignal.timeout(20000)});
  assert(response.ok,'GOOGLE_AUTH_FAILED','Google authorization failed. Reconnect your Google account.',401);
  const value=await response.json() as any;assert(typeof value.access_token==='string'&&Number(value.expires_in)>0,'GOOGLE_AUTH_FAILED','Google did not return a valid access token.',502);return value;
}
async function accessToken(db:DB,a:Actor){
  await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',['google:'+a.book+':'+a.id]);
  const row=(await db.query('SELECT encrypted_tokens FROM google_connections WHERE owner_id=$1 AND book=$2 FOR UPDATE',[a.id,a.book])).rows[0];
  assert(row,'GOOGLE_NOT_CONNECTED','Connect Google Sheets in workspace tools first.',409);
  let tokens=decryptTokens(row.encrypted_tokens);
  if(tokens.expiresAt<Date.now()+60000){assert(tokens.refresh_token,'GOOGLE_AUTH_FAILED','Reconnect Google Sheets to renew access.',401);const next=await tokenExchange({grant_type:'refresh_token',refresh_token:tokens.refresh_token});tokens={...tokens,...next,expiresAt:Date.now()+Number(next.expires_in)*1000};await db.query('UPDATE google_connections SET encrypted_tokens=$3,updated_at=now() WHERE owner_id=$1 AND book=$2',[a.id,a.book,encryptTokens(tokens)]);}
  return tokens.access_token as string;
}
const targetSchema=z.object({spreadsheetId:z.string().regex(/^[A-Za-z0-9_-]{10,160}$/),range:z.string().trim().min(1).max(120).refine(v=>!/[\r\n]/.test(v))});
async function googleValues(db:DB,a:Actor,target:any,rows?:string[][]){
  const token=await accessToken(db,a),base='https://sheets.googleapis.com/v4/spreadsheets/'+target.spreadsheetId+'/values/'+encodeURIComponent(target.range);
  const response=await fetch(base+(rows?':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS':''),{method:rows?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(rows?{body:JSON.stringify({majorDimension:'ROWS',values:rows})}:{}),signal:AbortSignal.timeout(30000)});
  assert(response.ok,'GOOGLE_SHEETS_FAILED','Google Sheets rejected this request. Check the sheet ID, range and granted access.',response.status===403?403:502);
  const value=await response.json() as any;
  assert(Buffer.byteLength(JSON.stringify(value))<=1048576,'SHEET_TOO_LARGE','Select a smaller sheet range.');return value;
}
export function sheetExportTarget(range:string){
 const match=/^(?:(.+)!)?([A-Za-z]+)\d*(?::([A-Za-z]+)\d*)?$/.exec(range);
 assert(match,'INVALID_RANGE','Use an explicit destination tab and A1 columns, for example Results!A:G.');
 const toNumber=(s:string)=>[...s.toUpperCase()].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);
 const letters=(n:number)=>{let s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;};
 const start=toNumber(match[2]),end=match[3]?toNumber(match[3]):start+6;
 assert(end-start>=6&&end<=18278,'INVALID_RANGE','The destination must have room for seven output columns.');
 return {prefix:match[1]?match[1]+'!':'',first:letters(start),last:letters(start+6)};
}
async function reconcileExport(db:DB,a:Actor,row:any){
 const target=sheetExportTarget(row.data.range),expected=new Map<string,number>();
 const rowHash=(r:any[])=>hash(Array.from({length:7},(_,i)=>String(r[i]??'')));
 for(const wanted of row.data.rows.slice(1)){const h=rowHash(wanted);expected.set(h,(expected.get(h)||0)+1);}
 const found:Record<string,string>={...(row.data.scanFound||{})};let cursor=Number(row.data.scanCursor||1),exhausted=false;
 for(let page=0;page<20;page++){
  const range=target.prefix+target.first+cursor+':'+target.last+(cursor+499),value=await googleValues(db,a,{...row.data,range}),values=value.values||[];
  for(let i=0;i<values.length;i++)if(values[i][0]===row.id){const h=rowHash(values[i]);if(expected.has(h))found[String(cursor+i)]=h;}
  const counts=new Map<string,number>();for(const h of Object.values(found))counts.set(h,(counts.get(h)||0)+1);
  if([...expected].every(([h,count])=>(counts.get(h)||0)>=count)){await db.query("UPDATE sheet_exports SET state='CONFIRMED',data=data||$2::jsonb WHERE id=$1",[row.id,JSON.stringify({reconciled:true,scanFound:found})]);return {state:'CONFIRMED',reconciled:true};}
  cursor+=500;if(values.length<500){exhausted=true;break;}
 }
 await db.query('UPDATE sheet_exports SET data=data||$2::jsonb WHERE id=$1',[row.id,JSON.stringify({scanFound:found,scanCursor:exhausted?1:cursor})]);
 return {state:row.state,nextScanRow:exhausted?1:cursor,message:exhausted?'The complete export marker is not visible yet. No second append was submitted. Check the sheet and reconcile again.':'The bounded scan will continue from row '+cursor+'. No second write was submitted.'};
}
export async function googleRoutes(app:FastifyInstance){
  const post=(path:string,fn:any)=>app.post('/api/v1'+path,async(req:any)=>{const a=await actor(req);requireWorkspaceRole(a,'OWNER');return mutate(a,req.headers['idempotency-key'],{path,params:req.params,body:req.body||{},workspace:a.workspaceId},db=>fn(db,a,req.body||{},req.params));});
  app.get('/api/v1/integrations/google',async req=>{const a=await actor(req);return {configured:googleReady(),connected:!!(await pool.query('SELECT 1 FROM google_connections WHERE owner_id=$1 AND book=$2',[a.id,a.book])).rowCount,redirectUri:config.origin+'/api/v1/integrations/google/callback'};});
  app.post('/api/v1/integrations/google/connect',async(req,reply)=>{
    const a=await actor(req);requireWorkspaceRole(a,'OWNER');assert(googleReady(),'GOOGLE_NOT_CONFIGURED','Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server.',503);
    const state=randomBytes(32).toString('base64url'),verifier=randomBytes(32).toString('base64url');
    await pool.query("INSERT INTO google_oauth_states VALUES($1,$2,$3,$4,now()+interval '10 minutes')",[hash(state),a.id,a.book,verifier]);
    reply.setCookie('orby_google_state',hash(state),{path:'/api/v1/integrations/google/callback',httpOnly:true,sameSite:'lax',secure:config.secure,maxAge:600});
    const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID!,redirect_uri:config.origin+'/api/v1/integrations/google/callback',response_type:'code',scope,state,access_type:'offline',prompt:'consent',code_challenge_method:'S256',code_challenge:createHash('sha256').update(verifier).digest('base64url')}).toString();return {url:url.href};
  });
  app.get('/api/v1/integrations/google/callback',async(req:any,reply)=>{
    const state=z.string().min(30).max(100).parse(req.query.state);assert(req.cookies.orby_google_state===hash(state),'FORBIDDEN','This authorization was started in another browser.',403);
    if(req.query.error){await pool.query('DELETE FROM google_oauth_states WHERE id_hash=$1',[hash(state)]);reply.clearCookie('orby_google_state',{path:'/api/v1/integrations/google/callback'});return reply.redirect(config.origin+'/settings?google=cancelled');}
    const code=z.string().min(1).max(2000).parse(req.query.code);
    await transaction(async db=>{
      const row=(await db.query('DELETE FROM google_oauth_states WHERE id_hash=$1 AND expires_at>now() RETURNING *',[hash(state)])).rows[0];assert(row,'AUTH_INVALID','Google authorization expired or was already consumed.',401);
      const tokens=await tokenExchange({grant_type:'authorization_code',code,code_verifier:row.verifier,redirect_uri:config.origin+'/api/v1/integrations/google/callback'});
      assert(String(tokens.scope||'').split(' ').includes(scope),'GOOGLE_AUTH_FAILED','Google Sheets permission was not granted.',403);
      await db.query('INSERT INTO google_connections(owner_id,book,encrypted_tokens) VALUES($1,$2,$3) ON CONFLICT(owner_id,book) DO UPDATE SET encrypted_tokens=EXCLUDED.encrypted_tokens,updated_at=now()',[row.owner_id,row.book,encryptTokens({...tokens,expiresAt:Date.now()+Number(tokens.expires_in)*1000})]);
    });reply.clearCookie('orby_google_state',{path:'/api/v1/integrations/google/callback'});return reply.redirect(config.origin+'/settings?google=connected');
  });
  post('/integrations/google/disconnect',async(db:DB,a:Actor)=>{await db.query('DELETE FROM google_connections WHERE owner_id=$1 AND book=$2',[a.id,a.book]);return {ok:true,message:'Disconnected from Orby. Revoke the application in your Google account to remove the grant there.'};});
  post('/integrations/google/read',async(db:DB,a:Actor,b:any)=>{const target=targetSchema.parse(b),value=await googleValues(db,a,target),rows=(value.values||[]).map((r:any[])=>r.map(v=>String(v??''))) as string[][];assert(rows.length<=101&&rows.every(r=>r.length<=30),'SHEET_TOO_LARGE','Select up to 100 data rows plus a header, and 30 columns.');assert(Buffer.byteLength(JSON.stringify(rows))<=200000,'SHEET_TOO_LARGE','Select less source text.');return {target,rows};});
  post('/jobs/:id/sheets/preview',async(db:DB,a:Actor,b:any,p:any)=>{
    const job=await loadJob(db,z.uuid().parse(p.id),a);assert(job.client_id===a.id,'FORBIDDEN','Only the client can export this job.',403);
    const d=await latestDelivery(db,job,b.revision,b.deliveryHash),target=targetSchema.parse(b),id=randomUUID();sheetExportTarget(target.range);
    assert(!(await db.query("SELECT 1 FROM sheet_exports WHERE owner_id=$1 AND job_id=$2 AND state='UNKNOWN'",[a.id,job.id])).rowCount,'EXPORT_UNKNOWN','Reconcile the previous uncertain export before preparing another.');
    const rows=[['Orby export ID','Job','Version','Option','Strengths','Limitations','Sources'],...d.content.comparison.map((r:any)=>[id,job.data.title,String(d.revision),r.option,r.strengths,r.limits,(r.sources||[]).join(', ')]),[id,job.data.title,String(d.revision),'Recommendation',d.content.recommendation,'','']];
    const existing=await googleValues(db,a,target),data={...target,rows,revision:d.revision,deliveryHash:d.hash,previousRows:(existing.values||[]).length};
    await db.query("INSERT INTO sheet_exports(id,owner_id,book,job_id,data,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '5 minutes')",[id,a.id,a.book,job.id,data]);return {id,...data,mode:'APPEND_NEW_ROWS',message:'Review this write. Existing rows will be preserved.'};
  });
  app.get('/api/v1/sheets/exports',async(req:any)=>{const a=await actor(req);return (await pool.query("SELECT id,state,data,expires_at FROM sheet_exports WHERE job_id=$1 AND owner_id=$2 AND book=$3 ORDER BY created_at DESC LIMIT 10",[z.uuid().parse(req.query.jobId),a.id,a.book])).rows;});
  const ownedExport=async(db:DB,a:Actor,id:string)=>{const row=(await db.query('SELECT * FROM sheet_exports WHERE id=$1 AND owner_id=$2 AND book=$3 FOR UPDATE',[z.uuid().parse(id),a.id,a.book])).rows[0];assert(row,'NOT_FOUND','Export not found.',404);await loadJob(db,row.job_id,a);return row;};
  post('/sheets/exports/:id/reconcile',async(db:DB,a:Actor,b:any,p:any)=>{const row=await ownedExport(db,a,p.id);return row.state==='CONFIRMED'?{state:'CONFIRMED',...row.data.result}:reconcileExport(db,a,row);});
  // Commit the write intent before contacting Google. A crash cannot return it to PREVIEW.
  app.post('/api/v1/sheets/exports/:id/commit',async(req:any)=>{
    const a=await actor(req);requireWorkspaceRole(a,'OWNER');z.string().min(8).max(128).parse(req.headers['idempotency-key']);
    const claim=await transaction(async db=>{
      await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',['sheet-write:'+a.book+':'+a.id]);
      const row=await ownedExport(db,a,req.params.id);
      if(row.state==='CONFIRMED')return {row,write:false};
      if(row.state==='UNKNOWN')return {row,write:false};
      assert(!(await db.query("SELECT 1 FROM sheet_exports WHERE owner_id=$1 AND job_id=$2 AND state='UNKNOWN' AND id<>$3",[a.id,row.job_id,row.id])).rowCount,'EXPORT_UNKNOWN','Reconcile the other uncertain export before confirming this one.');
      assert(row.state==='PREVIEW'&&new Date(row.expires_at).getTime()>Date.now(),'EXPORT_EXPIRED','Preview this export again before writing.');
      const job=await loadJob(db,row.job_id,a);await latestDelivery(db,job,row.data.revision,row.data.deliveryHash);
      await db.query("UPDATE sheet_exports SET state='UNKNOWN',data=data||$2::jsonb WHERE id=$1",[row.id,JSON.stringify({writeStartedAt:new Date().toISOString()})]);return {row,write:true};
    });
    if(!claim.write)return claim.row.state==='CONFIRMED'?{state:'CONFIRMED',...claim.row.data.result}:{state:'UNKNOWN',message:'A write was already started. Reconcile this export; no second append was submitted.'};
    try{
      const result=await transaction(db=>googleValues(db,a,claim.row.data,claim.row.data.rows));
      assert(typeof result.updates?.updatedRange==='string'&&result.updates.updatedRows===claim.row.data.rows.length,'EXPORT_UNVERIFIED','Google did not confirm the complete row write.');
      await pool.query("UPDATE sheet_exports SET state='CONFIRMED',data=data||$2::jsonb WHERE id=$1",[claim.row.id,JSON.stringify({result:{updatedRange:result.updates.updatedRange}})]);return {state:'CONFIRMED',updatedRange:result.updates.updatedRange};
    }catch{return {state:'UNKNOWN',message:'Google did not return a reliable result. The durable intent was preserved. Reconcile before writing again.'};}
  });
}
