import {assert} from './domain.js';
export function recommendationPrefix(reason:string){
 const match=/(?:start|begin)\s+(?:the\s+)?recommendation\s+with\s+["'“]?([^\n]+)|شروع\s+Recommendation\s+با\s+([^\n]+)/i.exec(reason);
 return match?String(match[1]||match[2]).trim().replace(/["'”]+$/,'').slice(0,100):null;
}
export function requireSupportedRevision(feedback:any,deterministic:boolean){
 if(!deterministic)return;
 const supported=feedback.section==='recommendation'&&recommendationPrefix(feedback.reason)||/^comparison:\d+(?:\s|$)/.test(feedback.section)&&/evidence|claim|source|quotation|support|limitation/i.test(feedback.reason);
 assert(supported,'REVISION_UNSUPPORTED','Simulation supports a recommendation prefix (Start Recommendation with Audit revision:) or targeted source-evidence clarification. Free-form rewrites require a real-AI job. Your revision has not been consumed.',422);
}
