import {seedRichSamples} from './seed-rich-samples.js';
import { pool, transaction } from "../src/db.js";
import { hash, Q } from "../src/domain.js";
import { randomUUID } from "node:crypto";
import {seedExamples} from './seed-examples.js';
export const agentFixtures = [
  {
    id: "brief-writer",
    owner: "writer.demo",
    name: "Brief Writer",
    category: "writing",
    initials: "BW",
    description:
      "Turns your source material into a concise, structured comparison brief.",
    skills: ["Writing", "Delegation"],
    minPriceUsdMicro: "20000000",
    etaMinutes: 2,
    acceptsSubcontracts: false,
  },
  {
    id: "source-extractor",
    owner: "researcher.demo",
    name: "Source Extractor",
    category: "research",
    initials: "SE",
    description:
      "Finds relevant claims and citations inside the text you provide.",
    skills: ["Research", "Citations"],
    minPriceUsdMicro: "5000000",
    etaMinutes: 1,
    acceptsSubcontracts: true,
  },
  {
    id: "format-reviewer",
    owner: "reviewer.demo",
    name: "Format Reviewer",
    category: "review",
    initials: "FR",
    description:
      "Checks required fields, structure and word counts before delivery.",
    skills: ["Review", "JSON checks"],
    minPriceUsdMicro: "2000000",
    etaMinutes: 1,
    acceptsSubcontracts: true,
  },
];
export const defaultCriteria = [
  {
    id: "structure",
    type: "AUTO_CHECK",
    required: true,
    description: "A comparison with all required fields",
    config: {
      check: "json-required-keys",
      keys: ["comparison", "recommendation", "sources"],
    },
  },
  {
    id: "items",
    type: "AUTO_CHECK",
    required: true,
    description: "One comparison row for each of three proposals",
    config: { check: "item-count", min: 3, max: 3 },
  },
  {
    id: "sources",
    type: "AUTO_CHECK",
    required: true,
    description: "At least one supplied source reference per proposal",
    config: { check: "source-ids" },
  },
  {
    id: "length",
    type: "AUTO_CHECK",
    required: true,
    description: "A recommendation under 300 words",
    config: { check: "word-count", min: 10, max: 300 },
  },
  {
    id: "approval",
    type: "CLIENT_APPROVE",
    required: true,
    description: "The recommendation addresses the brief",
  },
];
export const sampleSources = [
  {
    id: "proposal-a",
    text: "Proposal A: Build a simple research tool. Budget $5,000. Delivery in six weeks. Strong technical detail, but no user testing plan.",
  },
  {
    id: "proposal-b",
    text: "Proposal B: Build a focused writing assistant. Budget $4,000. Delivery in four weeks. Includes user testing, clear milestones and a maintenance plan.",
  },
  {
    id: "proposal-c",
    text: "Proposal C: Build a broad automation platform. Budget $9,000. Delivery in twelve weeks. Broad capabilities but complex scope and uncertain milestones.",
  },
];
await transaction(async (db) => {
  await db.query("SELECT pg_advisory_xact_lock(10102)");
  for (const id of [
    "alex.demo",
    "samples.demo",
    "writer.demo",
    "researcher.demo",
    "reviewer.demo",
    "operator.demo",
    "platform",
    "seed-reserve",
  ]) {
    await db.query(
      "INSERT INTO accounts(id,roles) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [
        id,
        JSON.stringify(
          id === "operator.demo"
            ? ["client", "creator", "lender", "admin"]
            : ["client", "creator", "lender"],
        ),
      ],
    );
    if (
      !(
        await db.query(
          "SELECT 1 FROM balances WHERE book='SIMULATION' AND account_id=$1",
          [id],
        )
      ).rowCount
    ) {
      const amount = 100n * Q;
      await db.query(
        "INSERT INTO balances(book,account_id,bucket,amount) VALUES('SIMULATION',$1,'free',$2),('SIMULATION',$1,'bond',$3),('SIMULATION',$1,'credit',$3)",
        [id, String(amount), String(10n * Q)],
      );
    }
  }
  for (const a of agentFixtures) {
    const data = {
      ...a,
      health: "DETERMINISTIC",
      completed: 0,
      seeded: true,
      manifestVersion: 1,
      maxInputBytes: 262144,
      endpointMode: "LOCAL_DEMO_ALLOWLIST_ONLY",
    };
    await db.query(
      "INSERT INTO agents(id,book,owner_id,name,category,data) VALUES($1,'SIMULATION',$2,$3,$4,$5) ON CONFLICT DO NOTHING",
      [a.id, a.owner, a.name, a.category, data],
    );
    await db.query(
      "INSERT INTO agent_versions VALUES($1,'SIMULATION',1,$2,$3,now()) ON CONFLICT DO NOTHING",
      [a.id, data, hash(data)],
    );
    await db.query(
      "INSERT INTO execution_policies(agent_id,book,owner_id,data) VALUES($1,'SIMULATION',$2,$3) ON CONFLICT DO NOTHING",
      [
        a.id,
        a.owner,
        {
          maxSpendYocto: String((32n * Q) / 10n),
          maxBondYocto: String(10n * Q),
          allowedAgentIds: ["source-extractor", "format-reviewer"],
          expiresAt: Date.now() + 365 * 86400000,
          paused: false,
        },
      ],
    );
  }
  await db.query(
    "INSERT INTO price_snapshots VALUES('fixed-demo-v1','FIXTURE','5000000',now(),'{\"referenceOnly\":true}') ON CONFLICT DO NOTHING",
  );
  await seedExamples(db,sampleSources,defaultCriteria);
  if(process.argv.includes('--samples'))console.log('Demo / Sample snapshots ready:',await seedRichSamples(db));
  if (
    !(await db.query("SELECT 1 FROM pool_epochs WHERE state='FUNDRAISING'"))
      .rowCount
  ) {
    const id = randomUUID();
    await db.query(
      "INSERT INTO pool_epochs(id,state,data) VALUES($1,'FUNDRAISING',$2)",
      [
        id,
        {
          totalShares: "0",
          finalAssets: "0",
          redeemed: "0",
          openedAt: Date.now(),
          lendingUntil: null,
          seeded: false,
        },
      ],
    );
  }
});
console.log(
  "Simulation accounts and three local agents ready. No testnet balance was seeded.",
);
await pool.end();
