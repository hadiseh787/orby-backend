// The two upstreams are the unmodified defaults of @hot-labs/near-connect 0.12.0.
// Live metadata relay only: no persistence, executor download, URL rewriting or custom wallets.
export async function walletRegistry(fetcher:typeof fetch=fetch){
 for(const url of ['https://raw.githubusercontent.com/hot-dao/near-selector/refs/heads/main/repository/manifest.json','https://cdn.jsdelivr.net/gh/azbang/hot-connector/repository/manifest.json']){
  try{const r=await fetcher(url,{signal:AbortSignal.timeout(5000),redirect:'error'});if(!r.ok)continue;const raw=await r.text();if(raw.length>250000)continue;const data=JSON.parse(raw);if(typeof data.version!=='string'||!Array.isArray(data.wallets))continue;return data;}catch{}
 }
 throw Error('The official wallet registry is unavailable. Retry when connectivity is restored.');
}
