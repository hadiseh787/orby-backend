import {z} from "zod";
import {Q} from "./domain.js";
export const criterionSchema = z.object({
  id: z.string().min(1).max(80),
  type: z.enum(["AUTO_CHECK", "CLIENT_APPROVE", "AI_REVIEW"]),
  required: z.boolean(),
  description: z.string().min(1).max(500),
  config: z
    .object({
      check: z.enum([
        "json-required-keys",
        "item-count",
        "word-count",
        "source-ids",
      ]),
      keys: z.array(z.string().max(80)).max(30).optional(),
      field: z.string().max(80).optional(),
      min: z.number().int().nonnegative().max(10000).optional(),
      max: z.number().int().nonnegative().max(10000).optional(),
    })
    .optional(),
});
export const jobSchema = z
  .object({
    title: z.string().min(5).max(120),
    description: z.string().min(10).max(8000),
    category: z.enum(["writing", "research", "review"]),
    nearYocto: z.string().regex(/^[1-9]\d{0,26}$/, "Enter a positive budget in NEAR.").refine(v=>BigInt(v)<=100n*Q,"Budget cannot exceed 100 NEAR.").optional(),
    attachmentIds: z.array(z.uuid()).max(5).default([]),
    knowledgeIds:z.array(z.uuid()).max(5).default([]),
    knowledgeChildGrants:z.record(z.string().regex(/^[a-z0-9-]{3,48}$/),z.array(z.uuid()).max(5)).default({}),
    preferredAgentId:z.string().regex(/^[a-z0-9-]{3,48}$/).optional(),
    usdMicro: z
      .string()
      .regex(/^[1-9]\d{6,8}$/)
      .refine((v) => BigInt(v) >= 1000000n && BigInt(v) <= 100000000n).optional(),
    deadlineMinutes: z.number().int().min(1).max(10080),
    approvalPolicy: z.enum(["MANUAL_APPROVAL", "AUTO_AFTER_CHECKS"]),
    input: z.object({
      sheetRows:z.array(z.array(z.string().max(5000)).max(30)).max(100).optional(),
      sheetHeaders:z.array(z.string().max(300)).max(30).optional(),
      sources: z
        .array(
          z.object({
            id: z.string().min(1).max(80),
            text: z.string().min(1).max(80000),
          }),
        )
        .min(1)
        .max(30),
    }),
    criteria: z.array(criterionSchema).min(1).max(20),
  })
  .superRefine((j, c) => {
    for(const ids of Object.values(j.knowledgeChildGrants))if(ids.some(id=>!j.knowledgeIds.includes(id)))c.addIssue({code:'custom',path:['knowledgeChildGrants'],message:'Child grants must refer to selected knowledge snapshots.'});
    for(const criterion of j.criteria){if(criterion.config?.min!==undefined&&criterion.config?.max!==undefined&&criterion.config.min>criterion.config.max)c.addIssue({code:'custom',path:['criteria'],message:'A criterion minimum cannot exceed its maximum.'});}
    if (!!j.nearYocto === !!j.usdMicro) c.addIssue({code:"custom",path:["nearYocto"],message:"Supply a NEAR budget, or a legacy USD budget, not both."});
    if (new Set(j.attachmentIds).size !== j.attachmentIds.length) c.addIssue({code:"custom",path:["attachmentIds"],message:"Duplicate attachments are not allowed."});
    if (Buffer.byteLength(JSON.stringify(j.input)) > 262144)
      c.addIssue({ code: "custom", message: "Input exceeds 256 KiB." });
    if (
      new Set(j.input.sources.map((s) => s.id)).size !== j.input.sources.length
    )
      c.addIssue({ code: "custom", message: "Source IDs must be unique." });
    if (
      j.approvalPolicy === "AUTO_AFTER_CHECKS" &&
      j.criteria.some((x) => x.required && x.type !== "AUTO_CHECK")
    )
      c.addIssue({
        code: "custom",
        message:
          "Automatic approval requires only deterministic required checks.",
      });
  });
