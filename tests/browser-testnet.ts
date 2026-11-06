// Opt-in test harness: signs with ignored development keys and submits real testnet transactions.
// Nothing in this adapter is included in the browser application's production build.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {connect,keyStores,KeyPair} from 'near-api-js';
const frontend=[process.env.FRONTEND_DIR,'../frontend','../orby-frontend','.workspace/frontend'].filter(Boolean).map(p=>path.resolve(p!)).find(p=>fs.existsSync(path.join(p,'package.json')));
assert.ok(frontend,'Set FRONTEND_DIR to the built Orby frontend.');
const require=createRequire(path.join(frontend,'package.json'));
const {chromium,expect}=require('@playwright/test');
assert.notEqual(process.env.NEAR_NETWORK,'mainnet');
const port=Number(process.env.TESTNET_BROWSER_PORT||4320),origin='http://127.0.0.1:'+port;
process.env.APP_ORIGIN=origin;process.env.HOST='127.0.0.1';process.env.FRONTEND_DIST=path.join(frontend,'dist/orby/browser');
const {buildApp}=await import('../src/server.js');const {pool}=await import('../src/db.js');
const {config}=await import('../src/config.js');const {messageDigest}=await import('../src/auth.js');const {tickNear,view}=await import('../src/near.js');
assert.ok(config.contract,'A deployed testnet contract is required.');assert.equal(await view('get_version'),2);
const credentials=JSON.parse(fs.readFileSync('.data/near/accounts.json','utf8'));
const keyStore=new keyStores.InMemoryKeyStore();for(const role of ['client','writer'])await keyStore.setKey('testnet',credentials[role].accountId,KeyPair.fromString(credentials[role].privateKey));
const near=await connect({networkId:'testnet',nodeUrl:config.rpc,keyStore});
const receipts:any[]=[];let worker:any;let running=false;
const app=await buildApp();await app.listen({host:'127.0.0.1',port});
const executable=process.env.PLAYWRIGHT_EXECUTABLE_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const browser=await chromium.launch({headless:true,...(executable?{executablePath:executable}:{})});
const errors:string[]=[];
async function walletPage(role:string){
  const context=await browser.newContext();
  await context.exposeBinding('orbyTestWallet',async(_:any,method:string,params:any)=>{
    const c=credentials[role],key=KeyPair.fromString(c.privateKey);
    if(method==='accounts')return [{accountId:c.accountId,publicKey:key.getPublicKey().toString()}];
    if(method==='message')return {accountId:c.accountId,publicKey:key.getPublicKey().toString(),signature:Buffer.from(key.sign(messageDigest(params.message,Buffer.from(params.nonce),params.recipient,params.callbackUrl)).signature).toString('base64')};
    assert.equal(method,'transaction');assert.equal(params.network,'testnet');assert.equal(params.receiverId,config.contract);assert.equal(params.actions.length,1);
    const call=params.actions[0].params;
    assert.ok(['register_near_agent','set_execution_policy','open_near_job','deposit_bond','record_bid','award_and_fund','approve_job','withdraw'].includes(call.methodName));
    assert.ok(BigInt(call.deposit)<=10n**24n,'Browser smoke deposit safety ceiling exceeded.');
    const outcome=await(await near.account(c.accountId)).functionCall({contractId:config.contract,methodName:call.methodName,args:call.args,gas:BigInt(call.gas),attachedDeposit:BigInt(call.deposit)});
    receipts.push({method:call.methodName,signer:c.accountId,hash:outcome.transaction.hash});
    console.log('Confirmed real wallet transaction:',call.methodName,outcome.transaction.hash);
    return {transaction:{hash:outcome.transaction.hash}};
  });
  await context.addInitScript({content:`(()=>{
    const w=window;
    const wallet={manifest:{id:'orby-testnet-wallet',name:'Orby testnet wallet',icon:'/brand/orby-icon-transparent.png',website:'https://near.org',version:'1.0.0',features:{signMessage:true,testnet:true,mainnet:false,signInWithoutAddKey:true,signAndSendTransaction:true},permissions:{}},
      signIn:()=>w.orbyTestWallet('accounts'),getAccounts:()=>w.orbyTestWallet('accounts'),signOut:async()=>{},
      signMessage:(p)=>w.orbyTestWallet('message',{...p,nonce:Array.from(p.nonce)}),
      signAndSendTransaction:(p)=>w.orbyTestWallet('transaction',p)};
    window.addEventListener('near-selector-ready',()=>window.dispatchEvent(new CustomEvent('near-wallet-injected',{detail:wallet})));
  })();`});
  const page=await context.newPage();page.on('pageerror',(e:any)=>errors.push(e.message));
  await page.goto(origin);await page.getByRole('button',{name:'Connect wallet',exact:true}).click();
  try{await page.locator('.connect-item[data-type="orby-testnet-wallet"]').click({timeout:30000});}
  catch(e){console.error('Wallet UI diagnostic:',await page.locator('[role="alert"]').allTextContents(),errors);await page.screenshot({path:'.data/near/wallet-failure.png'});throw e;}
  await expect(page.getByRole('button',{name:credentials[role].accountId,exact:true})).toBeVisible({timeout:45000});
  return page;
}
try{
  const writer=await walletPage('writer'),client=await walletPage('client');
  const suffix=Date.now(),agentId='orby-browser-'+suffix,jobTitle='Orby wallet comparison '+suffix,agentName='Orby wallet writer '+suffix;
  await writer.goto(origin+'/creator/agents');await writer.getByRole('button',{name:'Register agent',exact:true}).first().click();
  await writer.getByLabel('Agent ID',{exact:true}).fill(agentId);await writer.getByLabel('Name',{exact:true}).fill(agentName);await writer.getByLabel('Description',{exact:true}).fill('Processes supplied source evidence with deterministic checks.');await writer.getByLabel('Minimum price · NEAR',{exact:true}).fill('0.1');
  await writer.getByRole('dialog').getByRole('button',{name:'Register agent',exact:true}).click();await expect(writer.getByRole('dialog')).not.toBeVisible({timeout:60000});
  const row=writer.getByRole('row').filter({hasText:agentId});await row.getByRole('button',{name:'Policy',exact:true}).click();await writer.getByRole('button',{name:'Save permissions',exact:true}).click();await expect(writer.getByRole('dialog')).not.toBeVisible({timeout:60000});
  await writer.getByRole('button',{name:'Add reserve →',exact:true}).click();await writer.getByRole('dialog').getByLabel(/Amount/).fill('0.1');await writer.getByRole('dialog').getByRole('button',{name:/Sign deposit|Add reserve|Deposit/i}).last().click();await expect(writer.getByRole('dialog')).not.toBeVisible({timeout:60000});
  await client.goto(origin+'/client/jobs/new');await client.getByLabel('Title',{exact:true}).fill(jobTitle);await client.getByLabel('Budget · NEAR',{exact:false}).fill('0.2');await client.getByRole('button',{name:'Add source',exact:true}).click();await client.getByLabel('Source text',{exact:true}).nth(3).fill('Proposal D offers a documented support plan and clear acceptance milestones.');
  await client.getByLabel('Add files',{exact:true}).setInputFiles({name:'testnet-evidence.txt',mimeType:'text/plain',buffer:Buffer.from('Testnet attachment: real upload, hash commitment and authenticated download.')});await expect(client.getByRole('link',{name:'testnet-evidence.txt',exact:true})).toBeVisible();
  await client.getByRole('button',{name:'Continue',exact:true}).click();await client.getByRole('button',{name:'Continue',exact:true}).click();await client.getByRole('button',{name:'Publish job',exact:true}).click();await expect(client.getByRole('heading',{name:jobTitle})).toBeVisible({timeout:60000});
  const jobId=client.url().split('/').pop()!;
  await writer.goto(origin+'/creator/agents');
  // Match the actual job ID through the rendered action's parent record.
  const available=(await writer.request.get(origin+'/api/v1/jobs/open')).json();assert.ok((await available).some((j:any)=>j.id===jobId));
  await writer.locator('[aria-label="Open jobs"] .record-row').filter({hasText:jobTitle}).getByRole('button',{name:'Submit proposal',exact:true}).click();
  await writer.getByRole('dialog').getByLabel('Agent',{exact:true}).selectOption(agentId);await writer.getByRole('dialog').getByLabel('Proposal · NEAR',{exact:true}).fill('0.1');await writer.getByRole('dialog').getByRole('button',{name:'Submit proposal',exact:true}).click();await expect(writer.getByRole('dialog')).not.toBeVisible({timeout:60000});
  await client.reload();await client.getByRole('tab',{name:'Bids'}).click();await client.locator('.bid-row').filter({hasText:agentName}).getByRole('button',{name:'Review funding'}).click();await client.getByRole('button',{name:'Sign in wallet',exact:true}).click();await expect(client.getByRole('dialog')).not.toBeVisible({timeout:60000});
  worker=setInterval(async()=>{if(running)return;running=true;try{await tickNear()}catch(e){console.error('Testnet worker tick failed',e)}finally{running=false}},1000);
  await expect(client.getByRole('button',{name:'Review settlement'})).toBeVisible({timeout:240000});await client.getByRole('button',{name:'Review settlement'}).click();await client.getByRole('button',{name:'Approve & settle'}).click();await expect(client.getByRole('heading',{name:'Settlement',exact:true})).toBeVisible({timeout:60000});
  const job=await view('get_job',{job_id:jobId});assert.equal(job.state,'SETTLED');assert.equal(job.settlement.award,'100000000000000000000000');assert.equal(BigInt(job.escrow),BigInt(job.settlement.refund)+BigInt(job.settlement.fee)+BigInt(job.settlement.creator_credit));
  const detail=await(await client.request.get(origin+'/api/v1/jobs/'+jobId)).json();assert.equal(detail.termsHash,job.terms_hash);assert.equal(detail.attachments.length,1);
  const file=await client.request.get(origin+'/api/v1/uploads/'+detail.attachments[0].id);assert.equal(await file.text(),'Testnet attachment: real upload, hash commitment and authenticated download.');
  await writer.goto(origin+'/creator/earnings');await writer.getByRole('button',{name:'Withdraw →',exact:true}).click();await writer.getByRole('dialog').getByLabel(/Amount/).fill('0.01');await writer.getByRole('dialog').getByRole('button',{name:/Sign withdrawal|Withdraw/i}).last().click();await expect(writer.getByRole('dialog')).not.toBeVisible({timeout:60000});
  await client.reload();await expect(client.getByRole('button',{name:credentials.client.accountId,exact:true})).toBeVisible();
  await client.goto(origin+'/settings');await expect(client.locator('a[href*="testnet.nearblocks.io/txns/"]').first()).toBeVisible();await client.getByRole('button',{name:'Disconnect wallet'}).click();await expect(client.getByText('No active session.')).toBeVisible();
  assert.deepEqual(errors,[]);const result={network:'testnet',contractId:config.contract,jobId,agentId,passed:true,checkedAt:new Date().toISOString(),adapter:'Injected development wallet using real NEP-413 signatures and real RPC transactions; no mocked API/chain',receipts,checks:['production connector','real wallet authentication and persistence','native agent registration','signed execution policy','real bond deposit','native job and attachment hash','owner-signed bid','exact funding','worker delivery and checks','client approval and settlement','withdrawal callback','authenticated file download','explorer links','disconnect']};
  fs.mkdirSync('.data/near',{recursive:true});fs.writeFileSync('.data/near/browser-smoke.json',JSON.stringify(result,null,2));console.log('Browser-to-testnet end-to-end flow passed.');
}finally{clearInterval(worker);while(running)await new Promise(r=>setTimeout(r,200));await browser.close();await app.close();await pool.end();}
