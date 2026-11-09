import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nextWeekly,localParts} from '../src/programs.js';
import {sheetExportTarget} from '../src/google-sheets.js';
import {zipFiles} from '../src/evidence-pack.js';
import {receiptHtml} from '../src/evidence.js';
test('weekly schedules skip spring gaps and use an autumn repeated time only once',()=>{
 assert.equal(new Date(nextWeekly(Date.parse('2027-03-08T12:00:00Z'),0,2,30,'America/New_York')).toISOString(),'2027-03-21T06:30:00.000Z');
 const first=nextWeekly(Date.parse('2027-11-01T12:00:00Z'),0,1,30,'America/New_York');assert.equal(new Date(first).toISOString(),'2027-11-07T05:30:00.000Z');assert.equal(new Date(nextWeekly(first,0,1,30,'America/New_York')).toISOString(),'2027-11-14T06:30:00.000Z');
 assert.equal(new Date(nextWeekly(Date.parse('2027-01-31T12:00:00Z'),1,9,0,'UTC')).toISOString(),'2027-02-01T09:00:00.000Z');const lordHowe=nextWeekly(Date.parse('2027-09-27T00:00:00Z'),0,2,15,'Australia/Lord_Howe');assert.equal(localParts(lordHowe,'Australia/Lord_Howe').hour,2);assert.equal(localParts(lordHowe,'Australia/Lord_Howe').day,10);
});
test('sheet recovery derives output columns independently of the original row bounds',()=>{assert.deepEqual(sheetExportTarget('Results!A1:G20'),{prefix:'Results!',first:'A',last:'G'});assert.deepEqual(sheetExportTarget("'Team results'!C15:I20"),{prefix:"'Team results'!",first:'C',last:'I'});assert.throws(()=>sheetExportTarget('Results!A:B'));});
test('evidence archives use standard CRC and reject unsafe paths',()=>{const bytes=zipFiles([{name:'test.txt',data:Buffer.from('123456789')}]);assert.equal(bytes.readUInt32LE(14),0xcbf43926);assert.equal(bytes.readUInt32LE(bytes.length-22),0x06054b50);assert.throws(()=>zipFiles([{name:'../secret',data:Buffer.from('x')} ]));});

test('printed evidence displays atomic amounts in the labelled unit and escapes private content',()=>{const html=receiptHtml({visibility:'PRIVATE',book:'TESTNET',unit:'testNEAR',contracts:[{jobId:'one',amounts:{escrow:'1000000000000000000000001'},decisions:[],delivery:{revision:1,hash:'a',content:{comparison:[{name:'<script>alert(1)</script>',strengths:'Evidence',sources:['one']}],recommendation:'Use supplied evidence.'}}}],digest:'digest'});assert.ok(html.includes('1.000000000000000000000001 testNEAR'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('<table>'));});
