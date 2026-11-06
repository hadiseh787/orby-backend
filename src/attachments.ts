import { randomUUID, createHash } from "node:crypto";
import { assert } from "./domain.js";
import { type DB } from "./db.js";
import { type Actor } from "./auth.js";
export const attachmentLimit = 2 * 1024 * 1024;
export const attachmentTypes: Record<string, string[]> = {
  txt: ["text/plain"], md: ["text/markdown", "text/plain"], json: ["application/json", "text/plain"],
  pdf: ["application/pdf"], png: ["image/png"], jpg: ["image/jpeg"], jpeg: ["image/jpeg"],
};
export async function uploadAttachment(db: DB, a: Actor, body: any) {
  assert(typeof body.name === "string" && body.name.length > 0 && body.name.length <= 180 && !/[\/\\\x00-\x1f]/.test(body.name), "INVALID_FILE", "Use a filename without folders or control characters.");
  const ext = body.name.split(".").pop()?.toLowerCase();
  assert(ext && attachmentTypes[ext], "INVALID_FILE", "Allowed files: PDF, TXT, MD, JSON, PNG and JPEG.");
  assert(typeof body.dataBase64 === "string" && body.dataBase64.length <= Math.ceil(attachmentLimit / 3) * 4 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body.dataBase64), "INVALID_FILE", "File data is invalid or exceeds 2 MiB.");
  const bytes = Buffer.from(body.dataBase64, "base64");
  assert(bytes.length > 0 && bytes.length <= attachmentLimit, "INVALID_FILE", "Each file must be between 1 byte and 2 MiB.");
  if (ext === "pdf") assert(bytes.subarray(0, 5).toString() === "%PDF-", "INVALID_FILE", "The file is not a PDF document.");
  if (ext === "png") assert(bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), "INVALID_FILE", "The file is not a PNG image.");
  if (ext === "jpg" || ext === "jpeg") assert(bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255, "INVALID_FILE", "The file is not a JPEG image.");
  if (["txt", "md", "json"].includes(ext)) {
    try { const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); if (ext === "json") JSON.parse(text); }
    catch { assert(false, "INVALID_FILE", "Text must be UTF-8; JSON must be valid JSON."); }
  }
  const count = (await db.query("SELECT count(*) FROM job_attachments WHERE owner_id=$1 AND job_id IS NULL", [a.id])).rows[0].count;
  assert(Number(count) < 25, "UPLOAD_LIMIT", "Too many unused uploads. Remove unused attachments before uploading more.");
  let cid:string|null=null;
  if(body.publishToIpfs===true){
    assert(process.env.IPFS_API_URL,"STORAGE_NOT_CONFIGURED","Public IPFS storage is not configured.",503);
    const form=new FormData();form.append('file',new Blob([bytes]),body.name);
    const target=new URL('/api/v0/add?pin=true&cid-version=1',process.env.IPFS_API_URL);
    const response=await fetch(target,{method:'POST',body:form,signal:AbortSignal.timeout(30000)});
    assert(response.ok,"STORAGE_UNAVAILABLE","IPFS could not pin this attachment. No upload was marked successful.",503);
    const result=await response.json() as any;
    assert(/^b[a-z2-7]{30,150}$/.test(result.Hash||''),"STORAGE_UNAVAILABLE","IPFS returned an invalid content identifier.",503);cid=result.Hash;
  }
  const file = { id: randomUUID(), name: body.name, mediaType: attachmentTypes[ext][0], bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"),cid };
  await db.query("INSERT INTO job_attachments(id,owner_id,book,name,media_type,bytes,sha256,content_base64,ipfs_cid) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)", [file.id,a.id,a.book,file.name,file.mediaType,file.bytes,file.sha256,bytes.toString("base64"),cid]);
  return file;
}
export async function claimAttachments(db: DB, a: Actor, ids: string[]) {
  if (!ids.length) return [];
  const rows = (await db.query("SELECT id,name,media_type,bytes,sha256,ipfs_cid FROM job_attachments WHERE id=ANY($1::uuid[]) AND owner_id=$2 AND book=$3 AND job_id IS NULL ORDER BY id FOR UPDATE", [ids,a.id,a.book])).rows;
  assert(rows.length === ids.length, "INVALID_FILE", "An attachment is missing, belongs to another account, or is already attached to another job.");
  return rows.map(r=>({id:r.id,name:r.name,mediaType:r.media_type,bytes:r.bytes,sha256:r.sha256,cid:r.ipfs_cid}));
}
