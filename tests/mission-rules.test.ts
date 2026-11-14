import {test} from 'node:test';
import assert from 'node:assert/strict';
import {safeQuoteBody} from '../src/intents.js';
import {requireMissionApproval} from '../src/mission.js';
const tokens=[{assetId:'usdc',blockchain:'eth'},{assetId:'near',blockchain:'near'}];
const request={originAsset:'usdc',destinationAsset:'near',amount:'10000000',recipient:'orby.near',refundTo:'0x'+'1'.repeat(40)};
test('mainnet previews always force dry mode and reject execution fields or testnet accounts',()=>{assert.equal(safeQuoteBody(request,tokens).dry,true);assert.throws(()=>safeQuoteBody({...request,dry:false},tokens));assert.throws(()=>safeQuoteBody({...request,depositAddress:'attacker'},tokens));assert.throws(()=>safeQuoteBody({...request,recipient:'client.testnet'},tokens));assert.throws(()=>safeQuoteBody({...request,destinationAsset:'usdc'},tokens));});
test('mission funding is bound to the approved proposal and immutable agreement',()=>{const j={data:{missionPlanRequired:true,termsHash:'terms'}};assert.throws(()=>requireMissionApproval(j,'bid'));(j.data as any).missionPlan={approved:true,bidId:'bid',termsHash:'terms'};assert.doesNotThrow(()=>requireMissionApproval(j,'bid'));assert.throws(()=>requireMissionApproval(j,'another-bid'));j.data.termsHash='changed';assert.throws(()=>requireMissionApproval(j,'bid'));});
