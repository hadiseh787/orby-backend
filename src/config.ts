import dotenv from 'dotenv';
import {fileURLToPath} from 'node:url';
export const projectRoot=fileURLToPath(new URL('../',import.meta.url));
export const envFile=fileURLToPath(new URL('../.env',import.meta.url));
dotenv.config({path:envFile,quiet:true});
export const config = {
  host: process.env.HOST || "127.0.0.1",
  port: Number(process.env.PORT || 3000),
  origin: process.env.APP_ORIGIN || "http://127.0.0.1:4200",
  databaseUrl:
    process.env.DATABASE_URL ||
    "postgresql://agent:agent_local_only@127.0.0.1:5433/orby",
  demo:
    process.env.ENABLE_DEMO_LOGIN !== "false" &&
    process.env.NODE_ENV !== "production",
  accelerated: process.env.DEMO_ACCELERATED !== "false",
  contract: process.env.NEAR_CONTRACT_ID || "",
  rpc: process.env.NEAR_RPC_URL || "https://test.rpc.fastnear.com",
  walletRpc: process.env.NEAR_WALLET_RPC_URL || "https://test.rpc.fastnear.com",
  serviceAccount: process.env.NEAR_SERVICE_ACCOUNT || "",
  serviceKey: process.env.NEAR_SERVICE_PRIVATE_KEY || "",
  admin: process.env.NEAR_ADMIN_ACCOUNT || "",
  ollama: process.env.OLLAMA_URL || "http://127.0.0.1:11434",
  model: process.env.OLLAMA_MODEL || "",
  modelProvider: process.env.LLM_PROVIDER || 'OLLAMA',
  modelUrl: process.env.LLM_URL || 'http://127.0.0.1:11435/v1',
  secure: process.env.COOKIE_SECURE === "true",
};
if (process.env.NEAR_NETWORK && process.env.NEAR_NETWORK !== "testnet")
  throw Error("Only NEAR testnet is supported.");
if (config.demo && !["127.0.0.1", "localhost", "::1"].includes(config.host))
  throw Error("Demo login must bind to loopback.");
