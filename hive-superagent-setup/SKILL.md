---
name: hive-superagent-setup
description: Set up the HivemindOS SuperAgent API from a Bankr agent (one key and one credit balance for memory, web data, research, images, video, voice, models, browser tasks and 300+ more capabilities), pay for it or top it up in USDC on Base over x402 from the Bankr wallet, connect its MCP server, and call it, without the API key ever appearing in chat.
tags: [hivemindos, superagent, x402, mcp, api, agents]
version: 1
visibility: public
metadata:
  clawdbot:
    emoji: "🐝"
    homepage: "https://github.com/LiamVisionary/hivemindos-bankr-skills/tree/main/hive-superagent-setup"
    requires:
      bins: [node]
---

# HivemindOS SuperAgent API for Bankr

The SuperAgent API is HivemindOS's one backend for agents: memory, web data, research, media, models, browser tasks, wallets and more behind one key and one credit balance (500 credits to the dollar). This skill gets a Bankr agent onto it in one step and pays for it from the Bankr wallet over x402.

## Install inside Bankr

```text
install the hive-superagent-setup skill from https://github.com/LiamVisionary/hivemindos-bankr-skills/tree/main/hive-superagent-setup
```

## The one rule

**Never show, repeat, log or ask for an API key.** Every call that touches a key goes through [scripts/superagent.mjs](scripts/superagent.mjs) in `execute_cli`. It keeps the key in a private mode-600 file, or reads `HIVEMINDOS_API_KEY` from Bankr Env Vars, and prints `[kept private]` in place of any credential. Do not call `https://api.hivemindos.app/v1/setup-sessions` or `/v1/x402/accounts` with your own HTTP or x402 tools: their answers carry the key.

## Route the request

- **"Set up / connect HivemindOS" or "get me on the SuperAgent API"**: run `node scripts/superagent.mjs status` first. If it is connected, say so and show the credits. Otherwise:
  - **Free (default):** `node scripts/superagent.mjs setup` (add `--email <address>` only if the person gave it to you). It makes a new account and saves its key. Give the person the answer's `claimUrl` and `confirmCode` in one message: opening the link and confirming their email keeps the account and adds 250 free credits. The key holds a daily cap of 2,500 credits (about $5) until they change it.
  - **Paid by Bankr, over x402:** offer this when the person wants credits now. Ask them to approve one exact amount from $5 to $10 (Bankr pays at most $10 in one x402 call), then `node scripts/superagent.mjs setup --pay <usd> --confirm`. Then give them `takeOverUrl` so they can take over the account Bankr paid for.
  - Privacy: if the person wants nothing kept by the services it uses, add `--private` (the key is pinned to the private tier).
- **"Add credits / top up"**: get approval of the exact amount ($10 at most per call), then `node scripts/superagent.mjs top-up --amount <usd> --confirm`. Report `answer.creditedUsd` (or the credits) and `paymentMade`.
- **Do something with it** ("research this token", "make a video", "remember this"): `node scripts/superagent.mjs route "<their words>"` names the action; run it with `node scripts/superagent.mjs invoke <serviceId> <operationId> '<input json>'`. A `402` means the account needs credits: give the claim link again or offer a top-up.
- **Use it as tools:** once the person has saved a key in **Bankr Console → Tools → Environment Variables** as `HIVEMINDOS_API_KEY` (from the setup page's Show my key, or a new key at https://hivemindos.app/superagent-api/console/#keys), add the MCP server: `add an MCP server named "HivemindOS" at https://api.hivemindos.app/mcp with Authorization header "Bearer {{HIVEMINDOS_API_KEY}}"`. The script also uses that variable when it is set.

Read [references/api.md](references/api.md) for every answer's fields, the errors and their fixes.

## Paying: what has to be true

- The payment comes from the Bankr wallet through Bankr's Wallet API (`POST https://api.bankr.bot/wallet/x402-pay`). That needs `HIVEMINDOS_BANKR_KEY` in Bankr Env Vars: a **dedicated** Bankr key made at https://bankr.bot/api-keys with Wallet API on, read-only off, and low spend limits. The free setup needs no Bankr key.
- The cap given to Bankr is the approved amount, so Bankr refuses to pay more. Bankr's own spend limits still apply (`PER_TX_LIMIT_EXCEEDED`, `DAILY_LIMIT_EXCEEDED`, `PAUSED`).
- HivemindOS chooses the network (Base), the asset (USDC) and the recipient. Never add a recipient, price or network to a request.
- A top-up sends the SuperAgent key to Bankr's Wallet API as the request's `Authorization` header, because Bankr makes the paid request. Say so if the person asks where the key goes.
- A paid setup that stops halfway keeps its session and payment key in the private file. Running the same command again reuses them, so it cannot pay twice.

## Say only what happened

An accepted request, a payment Bankr made, credits on the account, and a call that worked are four different facts. Report the one the answer shows. Never call a payment made unless `paymentMade` says so.
