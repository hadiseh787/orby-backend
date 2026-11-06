import 'dotenv/config';
import assert from 'node:assert/strict';
import {buildApp} from '../src/server.js';
import {pool} from '../src/db.js';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
assert.ok(process.env.IPFS_API_URL,'Set IPFS_API_URL to a running trusted Kubo RPC endpoint.');
const app=await buildApp();await app.ready();
try{
  const login=await app.inject({method:'POST',url:'/api/v1/auth/demo',payload:{account:'alex.demo'}});assert.equal(login.statusCode,200);
  const cookie=String(login.headers['set-cookie']).split(';')[0],csrf=login.json().csrf;
  const headers={cookie,'x-csrf-token':csrf,'idempotency-key':randomUUID()};
  const content='Orby IPFS integration verification. Public synthetic test evidence.';
  const response=await app.inject({method:'POST',url:'/api/v1/uploads',headers,payload:{name:'orby-ipfs-check.txt',dataBase64:Buffer.from(content).toString('base64'),publishToIpfs:true}});assert.equal(response.statusCode,200,response.body);
  const file=response.json();assert.match(file.cid,/^b[a-z2-7]+$/);
  const read=await fetch(new URL('/api/v0/cat?arg='+file.cid,process.env.IPFS_API_URL),{method:'POST',signal:AbortSignal.timeout(10000)});assert.equal(await read.text(),content);
  const pins=await fetch(new URL('/api/v0/pin/ls?arg='+file.cid,process.env.IPFS_API_URL),{method:'POST'});assert.ok((await pins.json() as any).Keys[file.cid]);
  const backupRead=await app.inject({url:'/api/v1/uploads/'+file.id,headers:{cookie}});assert.equal(backupRead.body,content);
  fs.writeFileSync('docs/orby-ipfs.json',JSON.stringify({passed:true,checkedAt:new Date().toISOString(),implementation:'Real Kubo node: add, pin, CID retrieval and authenticated PostgreSQL fallback',cid:file.cid,sha256:file.sha256,bytes:file.bytes,verificationLimit:'Local offline node; external replication and production pinning availability not verified.'},null,2));
  await app.inject({method:'POST',url:'/api/v1/uploads/'+file.id+'/remove',headers:{...headers,'idempotency-key':randomUUID()},payload:{}});
  console.log('Real IPFS add/pin/read and private download fallback passed. CID:',file.cid);
}finally{await app.close();await pool.end();}
