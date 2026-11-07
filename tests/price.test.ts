import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createQuoteService} from '../src/price.js';

test('USD quotes reject stale, future and undated fallback data and preserve observation time',async()=>{
  let time=Date.now(),calls=0,scenario='fresh';
  const quote=createQuoteService((async()=>{
    calls++;
    if(calls%2===1)return new Response('{}',{status:503});
    return Response.json({price:'2.125',...(scenario==='undated'?{}:{time:new Date(time+(scenario==='future'?60000:scenario==='stale'?-360000:0)).toISOString()})});
  }) as typeof fetch,()=>time);
  const fresh=await quote();assert.equal(fresh.priceMicro,'2125000');assert.equal(fresh.stale,false);assert.equal(fresh.observedAt,time);
  assert.equal((await quote()).observedAt,time);assert.equal(calls,2);
  time+=60001;scenario='stale';const stale=await quote();assert.equal(stale.stale,true);assert.equal(stale.observedAt,fresh.observedAt);
  scenario='future';assert.equal((await quote()).stale,true);
  scenario='undated';assert.equal((await quote()).stale,true);
});

test('CoinGecko requires a real recent timestamp and concurrent quote requests share one fetch',async()=>{
  const time=Date.now();let calls=0;
  const quote=createQuoteService((async()=>{calls++;return Response.json({near:{usd:1.5,last_updated_at:Math.floor(time/1000)}});}) as typeof fetch,()=>time);
  const results=await Promise.all([quote(),quote(),quote()]);assert.equal(calls,1);assert.ok(results.every(q=>q.priceMicro==='1500000'&&!q.stale));
  const unavailable=createQuoteService((async()=>Response.json({near:{usd:9},price:'9'})) as typeof fetch,()=>time);
  assert.equal((await unavailable()).priceMicro,null);
});
