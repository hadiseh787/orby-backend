import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomBytes} from 'node:crypto';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');process.chdir(root);
if(process.platform!=='win32'||process.arch!=='x64')throw Error('This portable setup is Windows x64. On other systems configure an Ollama model using OLLAMA_MODEL and OLLAMA_URL.');
const dir=path.join(root,'.tools/mission-ai');fs.mkdirSync(dir,{recursive:true});
async function sha(file){const h=createHash('sha256');for await(const bytes of fs.createReadStream(file))h.update(bytes);return h.digest('hex');}
async function download(url,name,expected){const file=path.join(dir,name);if(fs.existsSync(file)&&await sha(file)===expected){console.log('Verified existing '+name);return file;}console.log('Downloading '+name+'; model is approximately 1.12 GB.');const r=await fetch(url,{signal:AbortSignal.timeout(3600000)});if(!r.ok)throw Error('Download HTTP '+r.status);await pipeline(Readable.fromWeb(r.body),fs.createWriteStream(file+'.part'));if(await sha(file+'.part')!==expected)throw Error('Checksum failed; incomplete file has not been enabled.');fs.renameSync(file+'.part',file);return file;}
const modelHash='6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e';
const zip=await download('https://github.com/ggml-org/llama.cpp/releases/download/b12375/llama-b12375-bin-win-cpu-x64.zip','llama.zip','3aa7046f1b310c404418625d4e7e7b057c2d0e0eef5557925561381373d8f026');
const model=await download('https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf','qwen2.5-1.5b-instruct-q4_k_m.gguf',modelHash);
const runtime=path.join(dir,'runtime'),literal=v=>"'"+v.replaceAll("'","''")+"'";
const ps=`$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; Expand-Archive -LiteralPath ${literal(zip)} -DestinationPath ${literal(runtime)} -Force`;
const expanded=spawnSync('powershell.exe',['-NoProfile','-EncodedCommand',Buffer.from(ps,'utf16le').toString('base64')],{stdio:'inherit',windowsHide:true});if(expanded.status!==0)throw Error('Runtime extraction failed.');
const server=fs.readdirSync(runtime,{recursive:true}).find(f=>path.basename(f)==='llama-server.exe');if(!server)throw Error('Verified runtime has no server executable.');
let env=fs.existsSync('.env')?fs.readFileSync('.env','utf8'):fs.readFileSync('.env.example','utf8').replace('agent_local_only',randomBytes(24).toString('hex'));
for(const [key,value] of Object.entries({LLM_PROVIDER:'OPENAI_COMPATIBLE',LLM_URL:'http://127.0.0.1:11435/v1',OLLAMA_MODEL:'Qwen2.5-1.5B-Instruct-Q4_K_M',LLM_MODEL_SHA256:modelHash,LLAMA_SERVER_PATH:path.join(runtime,server),LLAMA_MODEL_PATH:model})){const line=key+'='+value,pattern=new RegExp('^'+key+'=.*$','m');env=pattern.test(env)?env.replace(pattern,()=>line):env.trimEnd()+'\n'+line+'\n';}
fs.writeFileSync('.env',env,{mode:0o600});fs.writeFileSync(path.join(dir,'sources.json'),JSON.stringify({runtime:'b12375',runtimeSha256:'3aa7046f1b310c404418625d4e7e7b057c2d0e0eef5557925561381373d8f026',model:'Qwen2.5-1.5B-Instruct-Q4_K_M',modelSha256:modelHash},null,2));
console.log('Real local model configured. npm run local starts the model, database, API, worker and frontend together. No credentials were printed.');
