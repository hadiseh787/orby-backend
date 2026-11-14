import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import dotenv from 'dotenv';
test('setup preserves existing database configuration and literal unrelated values on repeat',async()=>{
 const base=path.resolve('.data');fs.mkdirSync(base,{recursive:true});const dir=fs.mkdtempSync(path.join(base,'setup-preservation-'));
 try{fs.mkdirSync(path.join(dir,'scripts'));fs.copyFileSync('scripts/setup-support.mjs',path.join(dir,'scripts/setup-support.mjs'));const before="# Existing installation\nDATABASE_URL='postgresql://owner:unchanged@127.0.0.1:5433/orby'\nUNRELATED='literal $value and replacement suffix'\nOLLAMA_MODEL=old\n";fs.writeFileSync(path.join(dir,'.env'),before);const helper=await import(pathToFileURL(path.join(dir,'scripts/setup-support.mjs')).href);helper.updateSettings({OLLAMA_MODEL:'project-model:1.5b',NEAR_CONTRACT_ID:'owned.testnet'});const after=fs.readFileSync(path.join(dir,'.env'),'utf8');assert.equal(dotenv.parse(after).DATABASE_URL,dotenv.parse(before).DATABASE_URL);assert.equal(dotenv.parse(after).UNRELATED,dotenv.parse(before).UNRELATED);assert.ok(after.startsWith(before.slice(0,before.indexOf('OLLAMA_MODEL'))));helper.updateSettings({OLLAMA_MODEL:'project-model:1.5b',NEAR_CONTRACT_ID:'owned.testnet'});assert.equal(fs.readFileSync(path.join(dir,'.env'),'utf8'),after);assert.equal(dotenv.parse(after).OLLAMA_MODEL,'project-model:1.5b');assert.equal(dotenv.parse(after).NEAR_CONTRACT_ID,'owned.testnet');if(process.platform!=='win32')assert.equal(fs.statSync(path.join(dir,'.env')).mode&0o777,0o600);
 }finally{assert.ok(path.resolve(dir).startsWith(base+path.sep));fs.rmSync(dir,{recursive:true,force:true})}
});
