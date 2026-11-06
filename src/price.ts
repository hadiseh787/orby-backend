type Quote = { priceMicro: string | null; source: string; observedAt: number; stale: boolean; referenceOnly: true; error?: string };
let cached: Quote | undefined;
let pending: Promise<Quote> | undefined;
export async function nearUsdQuote(): Promise<Quote> {
  if (cached && Date.now() - cached.observedAt < 60000) return cached;
  if (pending) return pending;
  pending = (async () => {
    for (const provider of [
      { url: "https://api.coingecko.com/api/v3/simple/price?ids=near&vs_currencies=usd&include_last_updated_at=true", source: "CoinGecko NEAR/USD", parse: (v: any) => Date.now() - Number(v.near?.last_updated_at) * 1000 < 300000 ? v.near?.usd : null },
      { url: "https://api.coinbase.com/v2/prices/NEAR-USD/spot", source: "Coinbase NEAR/USD spot", parse: (v: any) => v.data?.currency === "USD" ? v.data.amount : null },
    ]) {
      try {
        const response = await fetch(provider.url, { signal: AbortSignal.timeout(6000) });
        if (!response.ok) continue;
        const value = Number(provider.parse(await response.json()));
        if (!Number.isFinite(value) || value <= 0 || value > 1000000) continue;
        cached = { priceMicro: String(Math.round(value * 1000000)), source: provider.source, observedAt: Date.now(), stale: false, referenceOnly: true };
        return cached;
      } catch { /* Try the next public market-data provider. */ }
    }
    if (cached) return { ...cached, stale: true, error: "Market data is temporarily unavailable. Last observed quote shown." };
    return { priceMicro: null, source: "Unavailable", observedAt: 0, stale: true, referenceOnly: true, error: "USD estimate unavailable. NEAR amounts are unaffected." };
  })();
  try { return await pending; } finally { pending = undefined; }
}
