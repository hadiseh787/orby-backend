type Quote = { priceMicro: string | null; source: string; observedAt: number; stale: boolean; referenceOnly: true; error?: string };
export function createQuoteService(fetchQuote:typeof fetch=fetch,now:()=>number=Date.now) {
let cached: Quote | undefined;
let fetchedAt = 0;
let pending: Promise<Quote> | undefined;
return async function nearUsdQuote(): Promise<Quote> {
  if (cached && now() - fetchedAt < 60000) return {...cached,stale:cached.stale || now()-cached.observedAt>=300000};
  if (pending) return pending;
  pending = (async () => {
    for (const provider of [
      { url: "https://api.coingecko.com/api/v3/simple/price?ids=near&vs_currencies=usd&include_last_updated_at=true", source: "CoinGecko NEAR/USD", parse: (v: any) => ({value:v.near?.usd,time:Number(v.near?.last_updated_at)*1000}) },
      { url: "https://api.exchange.coinbase.com/products/NEAR-USD/ticker", source: "Coinbase Exchange NEAR/USD", parse: (v: any) => ({value:v.price,time:Date.parse(v.time)}) },
    ]) {
      try {
        const response = await fetchQuote(provider.url, { signal: AbortSignal.timeout(6000) });
        if (!response.ok) continue;
        const parsed=provider.parse(await response.json()),value=Number(parsed.value),age=now()-parsed.time;
        if(!Number.isFinite(parsed.time)||age< -30000||age>=300000)continue;
        if (!Number.isFinite(value) || value <= 0 || value > 1000000) continue;
        fetchedAt=now();
        cached = { priceMicro: String(Math.round(value * 1000000)), source: provider.source, observedAt: parsed.time, stale: false, referenceOnly: true };
        return cached;
      } catch { /* Try the next public market-data provider. */ }
    }
    if (cached) return { ...cached, stale: true, error: "Market data is temporarily unavailable. Last observed quote shown." };
    return { priceMicro: null, source: "Unavailable", observedAt: 0, stale: true, referenceOnly: true, error: "USD estimate unavailable. NEAR amounts are unaffected." };
  })();
  try { return await pending; } finally { pending = undefined; }
};
}
export const nearUsdQuote=createQuoteService();
