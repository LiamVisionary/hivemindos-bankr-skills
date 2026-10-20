#!/usr/bin/env node
// HivemindOS SuperAgent API from a Bankr agent, without the API key ever reaching the chat.
//
// The SuperAgent API hands a new key to the agent that set it up (platform-api setup-sessions.ts). Inside Bankr the
// agent's chat is not a place for a key, so this script makes those calls itself, keeps the key in a private
// mode-600 file (or reads HIVEMINDOS_API_KEY from Bankr's Env Vars) and prints everything except credentials.
// Payments go through Bankr's own Wallet API (POST /wallet/x402-pay), which pays the 402 from the Bankr wallet and
// refuses any price above the cap it is given; nothing here signs or holds a wallet key.
//
//   superagent.mjs status
//   superagent.mjs setup [--email person@example.com] [--private]           free: a new account, key saved
//   superagent.mjs setup --pay <usd> --confirm [--private]                   Bankr pays for the account over x402
//   superagent.mjs top-up --amount <usd> --confirm                           Bankr adds credits over x402
//   superagent.mjs services
//   superagent.mjs route "<what the person wants>"
//   superagent.mjs invoke <serviceId> <operationId> ['<input json>']
//
// Env: HIVEMINDOS_API_KEY (optional, a key the person saved in Bankr Env Vars; wins over the saved file),
// HIVEMINDOS_BANKR_KEY (only for paying: a dedicated Bankr key with Wallet API on and read-only off),
// HIVEMINDOS_SUPERAGENT_STATE_PATH (where the key is kept, default .hivemindos-superagent.json).
import { randomUUID } from "node:crypto";
import { chmod, readFile, rename, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const API_ORIGIN = "https://api.hivemindos.app";
export const BANKR_API = "https://api.bankr.bot";
/** Bankr's Wallet API refuses x402 payments above $10 a call (walletX402Pay in its OpenAPI document). */
export const BANKR_X402_MAX_USD = 10;
const LABEL = "Bankr agent";
const AGENT_NAME = "Bankr";
const CREDENTIAL_FIELD = /^(secret|api_?key|claim_?token|credit_?token|access_?token|account_?token|refresh_?token)$/i;

/** Every credential-shaped field in an answer, replaced, so nothing printed carries one. */
export function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, CREDENTIAL_FIELD.test(key) && typeof inner === "string" ? "[kept private]" : redact(inner)]));
}

function parseArgs(argv) {
  const positional = [];
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) { positional.push(value); continue; }
    const name = value.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) options[name] = true;
    else { options[name] = next; index += 1; }
  }
  return { positional, options };
}

function usd(value, flag) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) !== amount * 100) throw new Error(`${flag} must be a dollar amount in cents, for example 5 or 7.50.`);
  if (amount > BANKR_X402_MAX_USD) throw new Error(`${flag} is above $${BANKR_X402_MAX_USD}, the most Bankr pays over x402 in one call. Add more in steps, or on https://hivemindos.app/superagent-api/console/#billing.`);
  return amount;
}

export function createClient({ env = process.env, fetch: fetchImpl = globalThis.fetch, statePath } = {}) {
  const path = statePath || env.HIVEMINDOS_SUPERAGENT_STATE_PATH || ".hivemindos-superagent.json";

  async function readState() {
    try { return JSON.parse(await readFile(path, "utf8")); }
    catch (error) { if (error.code === "ENOENT") return {}; throw new Error(`The saved SuperAgent state at ${path} could not be read.`); }
  }
  async function writeState(state) {
    const temporary = `${path}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    await chmod(temporary, 0o600);
    await rename(temporary, path);
  }
  async function apiKey() {
    if (typeof env.HIVEMINDOS_API_KEY === "string" && env.HIVEMINDOS_API_KEY.trim()) return { key: env.HIVEMINDOS_API_KEY.trim(), from: "Bankr Env Var HIVEMINDOS_API_KEY" };
    const state = await readState();
    if (typeof state.apiKey === "string" && state.apiKey) return { key: state.apiKey, from: `saved file ${path}`, state };
    return null;
  }
  async function requireKey() {
    const found = await apiKey();
    if (!found) throw new Error("No SuperAgent API key yet. Run `superagent.mjs setup` first.");
    return found;
  }

  async function request(url, init = {}) {
    const response = await fetchImpl(url, {
      method: init.method || "GET",
      headers: { accept: "application/json", ...(init.body === undefined ? {} : { "content-type": "application/json" }), ...init.headers },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const text = await response.text();
    let payload;
    try { payload = text ? JSON.parse(text) : {}; } catch { payload = { error: text.slice(0, 300) }; }
    return { status: response.status, ok: response.ok, payload };
  }
  const hive = (path, init = {}, key) => request(`${API_ORIGIN}${path}`, { ...init, headers: { ...(key ? { authorization: `Bearer ${key}` } : {}), ...init.headers } });

  /** One x402 payment from the Bankr wallet. Bankr fetches the URL, pays the 402 up to `maxUsd` and returns the answer. */
  async function bankrPay({ url, body, headers, maxUsd }) {
    const bankrKey = typeof env.HIVEMINDOS_BANKR_KEY === "string" ? env.HIVEMINDOS_BANKR_KEY.trim() : "";
    if (!bankrKey) throw new Error("Paying needs HIVEMINDOS_BANKR_KEY in Bankr Env Vars: a dedicated Bankr API key with Wallet API on and read-only off, made at https://bankr.bot/api-keys. Or use the free `setup`.");
    const paid = await request(`${BANKR_API}/wallet/x402-pay`, {
      method: "POST",
      headers: { "x-api-key": bankrKey },
      body: { url, method: "POST", body: JSON.stringify(body), headers, maxPaymentUsd: maxUsd },
    });
    const result = paid.payload || {};
    if (!paid.ok || result.success !== true) {
      throw new Error(`Bankr did not pay: ${result.error || result.message || result.reason || `HTTP ${paid.status}`}. Nothing was paid unless Bankr's answer says so.`);
    }
    const upstream = result.response && typeof result.response === "object" ? result.response : {};
    return { status: Number(result.status) || 0, upstream, paymentMade: result.paymentMade ?? null };
  }

  async function status() {
    const found = await apiKey();
    if (!found) return { connected: false, next: "Run `superagent.mjs setup` (free) or `superagent.mjs setup --pay <usd> --confirm`." };
    const balance = await hive("/v1/credits/balance", {}, found.key);
    return { connected: balance.ok, keyFrom: found.from, httpStatus: balance.status, balance: redact(balance.payload), mcpUrl: `${API_ORIGIN}/mcp` };
  }

  async function setup(options) {
    const existing = await apiKey();
    if (existing && options.replace !== true) {
      return { ok: true, alreadySetUp: true, keyFrom: existing.from, next: "A SuperAgent key is already here. Run `superagent.mjs status` to see its credits; pass --replace only to make another account." };
    }
    const sessions = options.private === true ? "/v1/private/setup-sessions" : "/v1/setup-sessions";
    if (options.pay === undefined) {
      const email = typeof options.email === "string" ? options.email : undefined;
      const created = await hive(sessions, { method: "POST", body: { label: LABEL, agentName: AGENT_NAME, instant: true, ...(email ? { email } : {}) } });
      const secret = created.payload?.secret;
      if (!created.ok || typeof secret !== "string" || !secret) throw new Error(`HivemindOS did not set up an account: ${created.payload?.error || `HTTP ${created.status}`}`);
      await writeState({ apiKey: secret, baseUrl: created.payload.baseUrl, mcpUrl: created.payload.mcpUrl, savedAt: new Date().toISOString(), how: "instant" });
      return {
        ok: true,
        keySaved: path,
        claimUrl: created.payload.claimUrl,
        confirmCode: created.payload.confirmCode,
        dailyLimitCredits: created.payload.dailyLimitCredits,
        emailSent: created.payload.emailSent ?? false,
        mcpUrl: created.payload.mcpUrl,
        next: created.payload.next,
      };
    }
    if (options.confirm !== true) throw new Error("Paying for the account needs --confirm, after the person approved that exact amount.");
    const amount = usd(options.pay, "--pay");
    const state = await readState();
    // A paid setup that did not finish keeps its session and payment key, so running it again cannot pay twice:
    // the server answers the same idempotency key with the same key for 30 minutes (setup-sessions.ts fundSession).
    let pending = state.pendingFunding;
    if (!pending || pending.amountUsd !== amount || pending.sessions !== sessions) {
      const created = await hive(sessions, { method: "POST", body: { label: LABEL, agentName: AGENT_NAME } });
      if (!created.ok || typeof created.payload?.claimToken !== "string") throw new Error(`HivemindOS did not start a setup: ${created.payload?.error || `HTTP ${created.status}`}`);
      pending = { sessions, amountUsd: amount, claimToken: created.payload.claimToken, idempotencyKey: `bankr-setup-${randomUUID()}`, setupUrl: created.payload.setupUrl, confirmCode: created.payload.setupSession?.confirmCode ?? null, startedAt: new Date().toISOString() };
      await writeState({ ...state, pendingFunding: pending });
    }
    const paid = await bankrPay({
      url: `${API_ORIGIN}${sessions}/fund`,
      body: { amountUsd: amount },
      headers: { authorization: `Bearer ${pending.claimToken}`, "idempotency-key": pending.idempotencyKey },
      maxUsd: amount,
    });
    const secret = paid.upstream.secret;
    if (paid.status < 200 || paid.status >= 300 || typeof secret !== "string" || !secret) {
      return { ok: false, httpStatus: paid.status, answer: redact(paid.upstream), paymentMade: paid.paymentMade, next: "Run the same command again: it reuses this setup and payment key, so it cannot pay twice." };
    }
    await writeState({ apiKey: secret, baseUrl: paid.upstream.baseUrl, mcpUrl: paid.upstream.mcpUrl, savedAt: new Date().toISOString(), how: "paid" });
    return {
      ok: true,
      keySaved: path,
      creditedUsd: paid.upstream.creditedUsd,
      creditedCredits: paid.upstream.creditedCredits,
      paymentMade: paid.paymentMade,
      takeOverUrl: pending.setupUrl,
      confirmCode: pending.confirmCode,
      mcpUrl: paid.upstream.mcpUrl,
      next: "Give the person takeOverUrl so they can take over the account Bankr paid for and add their email to keep it.",
    };
  }

  async function topUp(options) {
    if (options.confirm !== true) throw new Error("Adding credits needs --confirm, after the person approved that exact amount.");
    const amount = usd(options.amount, "--amount");
    const { key } = await requireKey();
    const paid = await bankrPay({
      url: `${API_ORIGIN}/v1/credits/x402/top-up`,
      body: { amountUsd: amount },
      headers: { authorization: `Bearer ${key}`, "idempotency-key": `bankr-top-up-${randomUUID()}` },
      maxUsd: amount,
    });
    return { ok: paid.status >= 200 && paid.status < 300, httpStatus: paid.status, answer: redact(paid.upstream), paymentMade: paid.paymentMade };
  }

  async function authorized(path, init) {
    const { key } = await requireKey();
    const answer = await hive(path, init, key);
    return { ok: answer.ok, httpStatus: answer.status, answer: redact(answer.payload) };
  }

  return {
    status,
    setup,
    topUp,
    services: () => authorized("/v1/services"),
    route: (text) => {
      if (!text) throw new Error("Say what the person wants: superagent.mjs route \"make a 10 second video of a bee\"");
      return authorized("/v1/requests/route", { method: "POST", headers: { "idempotency-key": randomUUID() }, body: { request: text } });
    },
    invoke: (serviceId, operationId, inputJson) => {
      if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(serviceId || "") || !operationId) throw new Error("Name the service and operation: superagent.mjs invoke <serviceId> <operationId> '<input json>'");
      let input = {};
      if (inputJson) {
        try { input = JSON.parse(inputJson); } catch { throw new Error("The input must be JSON."); }
      }
      return authorized(`/v1/services/${serviceId}/invoke`, { method: "POST", headers: { "idempotency-key": randomUUID() }, body: { operationId, input } });
    },
  };
}

export async function run(argv, deps) {
  const [command = "help", ...rest] = argv;
  const { positional, options } = parseArgs(rest);
  const client = createClient(deps);
  if (command === "status") return client.status();
  if (command === "setup") return client.setup(options);
  if (command === "top-up") return client.topUp(options);
  if (command === "services") return client.services();
  if (command === "route") return client.route(positional.join(" "));
  if (command === "invoke") return client.invoke(positional[0], positional[1], positional[2]);
  return {
    usage: [
      "superagent.mjs status",
      "superagent.mjs setup [--email person@example.com] [--private]",
      "superagent.mjs setup --pay <usd> --confirm [--private]",
      "superagent.mjs top-up --amount <usd> --confirm",
      "superagent.mjs services",
      "superagent.mjs route \"<what the person wants>\"",
      "superagent.mjs invoke <serviceId> <operationId> ['<input json>']",
    ],
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  try {
    process.stdout.write(`${JSON.stringify(redact(await run(process.argv.slice(2))), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "The SuperAgent call failed."}\n`);
    process.exitCode = 1;
  }
}
