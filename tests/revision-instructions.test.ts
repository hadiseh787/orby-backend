import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recommendationPrefix,requireSupportedRevision} from '../src/revision-instructions.js';
import {deterministicBrief,runModel} from '../src/runtime.js';
import {config} from '../src/config.js';
test('a requested recommendation prefix changes the actual content and preserves the other sections',()=>{
 const sources=[{id:'a',text:'Proposal A has testing and maintenance.'}];const original=deterministicBrief({sources});const feedback={section:'recommendation',reason:'Start Recommendation with Audit revision:',previousOutput:original};
 assert.equal(recommendationPrefix(feedback.reason),'Audit revision:');requireSupportedRevision(feedback,true);const revised=deterministicBrief({sources,revisionFeedback:feedback});assert.ok(revised.recommendation.startsWith('Audit revision:'));assert.deepEqual(revised.comparison,original.comparison);assert.notEqual(revised.recommendation,original.recommendation);assert.ok(!original.recommendation.startsWith('Audit revision:'));
});
test('unsupported free-form deterministic requests are rejected before consuming a revision',()=>{
 assert.throws(()=>requireSupportedRevision({section:'recommendation',reason:'Translate the entire recommendation into Japanese.'},true),{code:'REVISION_UNSUPPORTED'});assert.doesNotThrow(()=>requireSupportedRevision({section:'recommendation',reason:'Translate the entire recommendation into Japanese.'},false));
});
test('the real-model schema accepts the requested prefix and a model ignoring it cannot pass',async()=>{
 const old={fetch:globalThis.fetch,model:config.model,provider:config.modelProvider};config.model='EXPLICIT_SCHEMA_FIXTURE';config.modelProvider='OPENAI_COMPATIBLE';let ignore=false;
 try{globalThis.fetch=(async(_url:any,init:any)=>{const request=JSON.parse(init.body),pattern=request.response_format.json_schema.schema.properties.recommendation.pattern;assert.ok(pattern.includes('[^ ]+'));assert.ok(!pattern.includes(String.fromCharCode(92)+'S'));assert.ok(new RegExp(pattern).test('Audit revision: one two three four five six seven eight nine ten'));assert.ok(!new RegExp(pattern).test('one two three four five six seven eight nine ten'));assert.ok(request.messages[0].content.includes('Start Recommendation with Audit revision:'));return Response.json({choices:[{message:{content:JSON.stringify({comparison:[],sources:['a'],recommendation:ignore?'The unchanged result.':'Audit revision: one two three four five six seven eight nine ten'})}}]});}) as typeof fetch;
 const input={sources:[{id:'a',text:'Fabricated evidence'}],criteria:[{config:{check:'word-count',min:10,max:100}}],revisionFeedback:{section:'recommendation',reason:'Start Recommendation with Audit revision:'}};assert.ok((await runModel(input)).content.recommendation.startsWith('Audit revision:'));ignore=true;await assert.rejects(runModel(input),{code:'MODEL_REVISION_NOT_APPLIED'});
 }finally{globalThis.fetch=old.fetch;config.model=old.model;config.modelProvider=old.provider;}
});
