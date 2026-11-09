import {z} from 'zod';
import {pool,type DB} from './db.js';
import {type Actor} from './auth.js';
import {assert} from './domain.js';
export async function resolveWorkspace(a:Actor,requested?:string,db:DB=pool){
 const existing=requested?null:(await db.query("SELECT id FROM workspaces WHERE owner_id=$1 AND book=$2 AND kind='PERSONAL'",[a.id,a.book])).rows[0];
 const id=requested?z.uuid().parse(requested):existing?.id||(await db.query('SELECT orby_personal_workspace($1,$2) AS id',[a.id,a.book])).rows[0].id;
 const w=(await db.query('SELECT w.*,m.role FROM workspaces w JOIN workspace_members m ON m.workspace_id=w.id WHERE w.id=$1 AND w.book=$2 AND m.account_id=$3 AND m.active',[id,a.book,a.id])).rows[0];
 assert(w,'FORBIDDEN','You are not an active member of this workspace.',403);
 return {...a,workspaceId:w.id,workspaceRole:w.role as 'OWNER'|'MEMBER'|'REVIEWER',workspaceName:w.name,paymentAccount:w.payment_account,workspaceKind:w.kind};
}
export function requireWorkspaceRole(a:Actor,...roles:string[]){assert(!a.workspaceRole||roles.includes(a.workspaceRole),'FORBIDDEN','Your workspace role cannot perform this action. The payment owner must sign financial actions.',403);}
export async function canReadWorkspace(db:DB,a:Actor,id:string){return !!(await db.query('SELECT 1 FROM workspace_members m JOIN workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=$1 AND m.account_id=$2 AND m.active AND w.book=$3',[id,a.id,a.book])).rowCount;}
