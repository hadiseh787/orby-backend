import {existsSync,readFileSync,mkdirSync,writeFileSync,rmSync,openSync,closeSync,readdirSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import net from 'node:net';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
const require=createRequire(import.meta.url);
const state=resolve('.data/local-run.json'),lock=resolve('.data/local-launch.lock');
mkdirSync('.data',{recursive:true});
const children=[];
let stopping=false,startedDatabase=false,pgControl='',lockHandle;
const arg=name=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1]};
const port=Number(arg('--port')||process.env.LOCAL_PORT||4200);
const dbPort=Number(arg('--db-port')||process.env.LOCAL_DB_PORT||5433);
const url='http://127.0.0.1:'+port;
for(const value of [port,dbPort])if(!Number.isInteger(value)||value<1024||value>65535)throw Error('Ports must be integers between 1024 and 65535.');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const alive=pid=>{try{process.kill(pid,0);return true}catch{return false}};
function run(command,args,options={}){
  return new Promise((done,reject)=>{
    const child=spawn(command,args,{cwd:root,env:process.env,stdio:'inherit',windowsHide:true,...options});
    child.once('error',reject);child.once('exit',(code,signal)=>code===0?done():reject(Error(`${command} exited ${signal||code}`)));
  });
}
function npmArgs(args){
  const candidates=[process.env.npm_execpath,join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),resolve(dirname(process.execPath),'../lib/node_modules/npm/bin/npm-cli.js')];
  const cli=candidates.find(p=>p&&existsSync(p));
  if(cli)return [process.execPath,[cli,...args]];
  if(process.platform==='win32')throw Error('npm was not found. Install Node.js 22 LTS or 24 LTS with npm.');
  return ['npm',args];
}
function gitRead(args,cwd){const result=spawnSync('git',args,{cwd,encoding:'utf8',windowsHide:true});if(result.status!==0)throw Error('Could not inspect the managed frontend Git checkout.');return result.stdout.trim();}
async function npm(args,cwd){const [command,parameters]=npmArgs(args);await run(command,parameters,{cwd});}
async function free(candidatePort){return new Promise(r=>{const socket=net.connect(candidatePort,'127.0.0.1');socket.once('connect',()=>{socket.destroy();r(false)});socket.once('error',()=>r(true));});}
async function healthy(target){try{return (await fetch(target,{signal:AbortSignal.timeout(1500)})).ok}catch{return false}}
async function stopFromAnotherProcess(){
  if(!existsSync(state)){console.log('No local launcher is running.');return;}
  const current=JSON.parse(readFileSync(state,'utf8'));
  if(current.token&&await healthy(current.url)){
    const response=await fetch(current.url+'/api/v1/local/shutdown',{method:'POST',headers:{'x-local-shutdown':current.token},signal:AbortSignal.timeout(5000)});
    if(!response.ok)throw Error('The local server rejected shutdown. Use Ctrl+C in its terminal.');
  }
  for(let i=0;i<30&&alive(current.pid);i++)await delay(300);
  if(alive(current.pid))throw Error('The launcher is still shutting down. Use Ctrl+C in its terminal.');
  if(existsSync(state))rmSync(state);
  console.log('Local application stopped.');
}
async function install(cwd,label){
  const fingerprint=createHash('sha256').update(readFileSync(join(cwd,'package-lock.json'))).digest('hex');
  const stamp=resolve('.data','installed-'+label+'.txt');
  if(!existsSync(join(cwd,'node_modules'))||!existsSync(stamp)||readFileSync(stamp,'utf8')!==fingerprint){
    console.log('Installing locked '+label+' dependencies…');await npm(['ci','--include=dev','--no-audit','--no-fund'],cwd);writeFileSync(stamp,fingerprint);
  }
}
function launch(name,args,env){
  const child=spawn(process.execPath,args,{cwd:root,env,stdio:['inherit','inherit','inherit','ipc'],windowsHide:true});children.push({name,child});
  child.on('message',message=>{if(message?.type==='local-shutdown'&&message.token===env.LOCAL_SHUTDOWN_TOKEN)void shutdown()});
  child.once('error',error=>{console.error(name+': '+error.message);void shutdown(1)});
  child.once('exit',code=>{if(!stopping){console.error(name+' stopped unexpectedly ('+code+').');void shutdown(1)}});
  return child;
}
async function terminate(child){
  if(child.exitCode!==null||child.signalCode)return;
  child.kill('SIGTERM');
  for(let n=0;n<30&&child.exitCode===null&&!child.signalCode;n++)await delay(100);
  if(alive(child.pid)){if(process.platform==='win32')spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else child.kill('SIGKILL');}
}
async function shutdown(code=0){
  if(stopping)return;stopping=true;
  for(const item of children.filter(c=>c.name!=='postgres'))await terminate(item.child);
  if(startedDatabase&&pgControl){try{await run(pgControl,['-D',resolve('.data/postgres'),'-m','fast','-w','stop'],{stdio:'ignore'})}catch{}}
  for(const item of children.filter(c=>c.name==='postgres'))await terminate(item.child);
  if(existsSync(state)&&JSON.parse(readFileSync(state,'utf8')).pid===process.pid)rmSync(state);
  if(lockHandle!==undefined){closeSync(lockHandle);lockHandle=undefined;if(existsSync(lock))rmSync(lock);}
  process.exitCode=code;
}

try{
  if(process.argv.includes('--stop')){await stopFromAnotherProcess();process.exit(0);}
  const [major,minor]=process.versions.node.split('.').map(Number);
  if(!((major===22&&minor>=19)||major===24))throw Error('Use Node.js 22.19+ LTS or Node.js 24 LTS.');
  if(existsSync(state)){
    const current=JSON.parse(readFileSync(state,'utf8'));
    if(alive(current.pid)&&await healthy(current.url)){console.log('Already running: '+current.url);process.exit(0);}
    if(alive(current.pid))throw Error('Another launcher is starting. Wait for its ready message.');
    rmSync(state);
  }
  if(existsSync(lock)){
    const previous=Number(readFileSync(lock,'utf8'));if(alive(previous))throw Error('Another local setup is running.');rmSync(lock);
  }
  lockHandle=openSync(lock,'wx');writeFileSync(lockHandle,String(process.pid));
  const workspace=JSON.parse(readFileSync('workspace.json','utf8'));
  const zipSiblings=readdirSync(dirname(root),{withFileTypes:true}).filter(d=>d.isDirectory()&&d.name.startsWith('orby-frontend')).slice(0,20).map(d=>resolve('..',d.name));
  const candidates=[arg('--frontend'),process.env.FRONTEND_DIR,resolve('../frontend'),resolve('../orby-frontend'),...zipSiblings,resolve('.workspace/frontend')].filter(Boolean).map(p=>resolve(p));
  let frontend=candidates.find(p=>{try{return JSON.parse(readFileSync(join(p,'package.json'),'utf8')).name==='orby-frontend'}catch{return false}});
  const managed=resolve('.workspace/frontend');
  if(!frontend&&existsSync(join(managed,'.git')))frontend=managed;
  if(frontend===managed&&existsSync(join(managed,'.git'))&&gitRead(['rev-parse','HEAD'],managed)!==workspace.frontendRevision){
    if(gitRead(['status','--porcelain'],managed))throw Error('The managed frontend has local changes. Preserve them and use --frontend with your development checkout.');
    console.log('Updating the managed frontend to the pinned Orby revision…');
    await run('git',['remote','set-url','origin',workspace.frontendRepository],{cwd:managed});
    await run('git',['fetch','origin',workspace.frontendRevision],{cwd:managed});
    await run('git',['checkout','--detach',workspace.frontendRevision],{cwd:managed});
  }
  if(!frontend){
    frontend=resolve('.workspace/frontend');mkdirSync(dirname(frontend),{recursive:true});console.log('Fetching the matching private frontend repository…');
    if(existsSync(frontend)&&readdirSync(frontend).length)throw Error('The frontend destination is not empty. Use --frontend to select your existing checkout.');
    await run('git',['clone',workspace.frontendRepository,frontend]);
    await run('git',['checkout','--detach',workspace.frontendRevision],{cwd:frontend});
  }
  await install(root,'backend');await install(frontend,'frontend');
  if(!existsSync('.env')){
    const generated=readFileSync('.env.example','utf8').replace('agent_local_only',randomBytes(24).toString('hex'));
    writeFileSync('.env',generated,{mode:0o600});console.log('Created local .env with a new development database password.');
  }
  const localEnv={...require('dotenv').parse(readFileSync('.env')),...process.env};
  const connection=new URL(localEnv.DATABASE_URL||'postgresql://agent:agent_local_only@127.0.0.1:5433/orby');
  if(arg('--db-port')||process.env.LOCAL_DB_PORT)connection.port=String(dbPort);
  const env={...localEnv,HOST:'127.0.0.1',PORT:String(port),APP_ORIGIN:url,FRONTEND_DIST:join(frontend,'dist/orby/browser'),DATABASE_URL:connection.href,LOCAL_SHUTDOWN_TOKEN:randomBytes(32).toString('hex'),NODE_ENV:'development'};
  if(!await free(port))throw Error(`Port ${port} is already in use. Use --port with another local port.`);
  console.log('Building backend and frontend…');await npm(['run','build'],root);await npm(['run','build'],frontend);
  if(['127.0.0.1','localhost'].includes(connection.hostname)&&await free(Number(connection.port||5432))){
    if(process.platform!=='win32'&&process.getuid?.()===0)throw Error('Embedded PostgreSQL requires a non-root user. Use a normal user or an existing PostgreSQL DATABASE_URL.');
    const native=await import('@embedded-postgres/'+(process.platform==='win32'?'windows':process.platform)+'-'+process.arch);pgControl=native.pg_ctl;
    startedDatabase=true;
    launch('postgres',['--import','tsx','scripts/postgres.ts'],{...env,AF_POSTGRES_PORT:connection.port||'5432',AF_POSTGRES_USER:decodeURIComponent(connection.username),AF_POSTGRES_PASSWORD:decodeURIComponent(connection.password)});
  }
  await run(process.execPath,['--import','tsx','scripts/wait-db.ts'],{env});
  await run(process.execPath,['--import','tsx','scripts/migrate.ts'],{env});
  await run(process.execPath,['--import','tsx','scripts/seed.ts'],{env});
  launch('api',['dist/server.js'],env);launch('worker',['dist/worker.js'],env);
  writeFileSync(state,JSON.stringify({pid:process.pid,url,token:env.LOCAL_SHUTDOWN_TOKEN,frontend},null,2),{mode:0o600});
  process.on('SIGINT',()=>void shutdown());process.on('SIGTERM',()=>void shutdown());
  for(let n=0;n<60;n++){if(stopping)break;if(await healthy(url+'/api/v1/health')&&await healthy(url)){console.log('\nOrby ready: '+url+'\nPress Ctrl+C to stop all local services.');
      if(!process.argv.includes('--no-browser')){const command=process.platform==='win32'?'rundll32.exe':process.platform==='darwin'?'open':'xdg-open';const args=process.platform==='win32'?['url.dll,FileProtocolHandler',url]:[url];const browser=spawn(command,args,{stdio:'ignore',windowsHide:true});browser.on('error',()=>{});browser.unref();}
      break;
    }if(n===59)throw Error('Application did not become ready.');await delay(1000);}
}catch(error){console.error('\nLocal setup failed: '+error.message);await shutdown(1);}
