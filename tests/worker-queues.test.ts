import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runQueues} from '../src/worker.js';
test('a blocked testnet RPC does not starve simulation and both queues stop without duplicate ticks',async()=>{
 let release!:()=>void,done!:()=>void,stopped=false,simTicks=0,nearTicks=0,timer:any;const blocked=new Promise<void>(r=>release=r),simDone=new Promise<void>(r=>done=r);
 const running=runQueues([{name:'testnet fixture',interval:1,task:async()=>{nearTicks++;await blocked;}},{name:'simulation fixture',interval:1,task:async()=>{simTicks++;if(simTicks===3){stopped=true;done();}}}],()=>stopped);
 try{await Promise.race([simDone,new Promise<void>(r=>timer=setTimeout(r,1000))]);assert.equal(simTicks,3);assert.equal(nearTicks,1);}finally{clearTimeout(timer);stopped=true;release();await running;}
});
