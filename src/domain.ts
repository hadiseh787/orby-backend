import { createHash } from "node:crypto";
export const Q = 10n ** 24n;
export const BPS = 10000n;
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public retryable = false,
  ) {
    super(message);
  }
}
export function assert(
  condition: unknown,
  code: string,
  message: string,
  status = 400,
): asserts condition {
  if (!condition) throw new AppError(code, message, status);
}
export const ceil = (x: bigint, y: bigint) => x / y + (x % y === 0n ? 0n : 1n);
export const min = (...v: bigint[]) => v.reduce((a, b) => (a < b ? a : b));
export function atomic(value: unknown): bigint {
  assert(
    typeof value === "string" && /^(0|[1-9]\d{0,38})$/.test(value),
    "INVALID_AMOUNT",
    "Use a nonnegative integer amount string.",
  );
  return BigInt(value);
}
export function funding(
  usdMicro: string,
  priceMicro = "5000000",
  bufferBps = 1000,
  bondBps = 2000,
) {
  const u = atomic(usdMicro),
    p = atomic(priceMicro);
  assert(p > 0n, "PRICE_STALE", "A valid price reference is required.");
  const n0 = ceil(u * Q, p);
  return {
    n0: String(n0),
    escrow: String(ceil(n0 * BigInt(10000 + bufferBps), BPS)),
    bond: String(ceil(n0 * BigInt(bondBps), BPS)),
    childCap: String((n0 * 8000n) / BPS),
  };
}
export function settlement(
  escrow: string,
  usdMicro: string,
  priceMicro: string,
  awardBps = 10000,
  feeBps = 1000,
  debt = "0",
  child = false,
) {
  assert(
    Number.isInteger(awardBps) && awardBps >= 0 && awardBps <= 10000,
    "INVALID_AWARD",
    "Award must be between 0 and 10000 basis points.",
  );
  const e = atomic(escrow),
    p = atomic(priceMicro);
  assert(p > 0n, "PRICE_STALE", "A positive settlement price is required.");
  const owed = child ? e : ceil(atomic(usdMicro) * Q, p),
    gross = min(e, owed);
  const award = (gross * BigInt(awardBps)) / BPS,
    fee = child ? 0n : (award * BigInt(feeBps)) / BPS;
  const debtPaid = min(award - fee, atomic(debt));
  return {
    escrow,
    owed: String(owed),
    grossEligible: String(gross),
    award: String(award),
    fee: String(fee),
    refund: String(e - award),
    debtPaid: String(debtPaid),
    creatorCredit: String(award - fee - debtPaid),
    shortfall: owed > e,
  };
}
// RFC 8785-compatible for the validated JSON domain: finite JSON numbers, UTF-16 key order, no undefined.
export function canonical(value: any): string {
  if (value === null || typeof value !== "object") {
    assert(
      value !== undefined &&
        !(typeof value === "number" && !Number.isFinite(value)),
      "INVALID_JSON",
      "Invalid canonical JSON value.",
    );
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  return (
    "{" +
    Object.keys(value)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + canonical(value[k]))
      .join(",") +
    "}"
  );
}
export const hash = (v: any) =>
  createHash("sha256")
    .update(typeof v === "string" ? v : canonical(v))
    .digest("hex");
export const terminal = (state: string) =>
  ["SETTLED", "REFUNDED", "CANCELLED"].includes(state);
export function evaluate(content: any, criteria: any[], sources: any[]) {
  return criteria.map((c) => {
    if (c.type === "CLIENT_APPROVE")
      return {
        ...c,
        result: "PENDING",
        evidence: "Explicit client approval is required.",
      };
    if (c.type === "AI_REVIEW")
      return {
        ...c,
        result: "UNAVAILABLE",
        evidence:
          "AI is advisory; deterministic checks and client review remain available.",
      };
    const cfg = c.config || {};
    let pass = false;
    let evidence = "";
    if (cfg.check === "json-required-keys") {
      pass =
        !!content &&
        typeof content === "object" &&
        (cfg.keys || []).every((k: string) => Object.hasOwn(content, k));
      evidence = "Checked required JSON fields.";
    }
    if (cfg.check === "item-count") {
      const items = content?.[cfg.field || "comparison"];
      pass =
        Array.isArray(items) &&
        items.length >= (cfg.min || 0) &&
        items.length <= (cfg.max ?? 100);
      evidence = `Observed ${Array.isArray(items) ? items.length : 0} items.`;
    }
    if (cfg.check === "word-count") {
      const count = String(content?.[cfg.field || "recommendation"] || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
      pass = count >= (cfg.min ?? 1) && count <= (cfg.max ?? 300);
      evidence = `Observed ${count} words.`;
    }
    if (cfg.check === "source-ids") {
      const ids = new Set(sources.map((s: any) => s.id));
      const used = content?.sources;
      pass =
        Array.isArray(used) &&
        used.length > 0 &&
        used.every((id: string) => ids.has(id)) &&
        (content?.comparison || []).every(
          (row: any) =>
            Array.isArray(row.sources) &&
            row.sources.length &&
            row.sources.every((id: string) => ids.has(id)),
        );
      evidence = "Compared citations with supplied source identifiers.";
    }
    return { ...c, result: pass ? "PASS" : "FAIL", evidence };
  });
}
