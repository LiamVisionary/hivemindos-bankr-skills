---
name: hive-copy-trading
description: Configure, fund, monitor, publish verified performance, pause, or cancel always-on HivemindOS Base copy trading executed and paid directly by a user-owned Bankr wallet.
tags: [trading, copy-trading, bankr, base, automation]
version: 7
visibility: public
metadata:
  clawdbot:
    emoji: "🐝"
    homepage: "https://github.com/LiamVisionary/hivemindos-bankr-skills/tree/main/hive-copy-trading"
    requires:
      bins: [bankr]
---

# HivemindOS Bankr Copy Trading

Use the hosted HivemindOS monitor to watch one Base wallet and execute bounded same-chain swaps through Bankr's direct Wallet API. Bankr holds the user's wallet and non-exportable signing key. HivemindOS receives only a dedicated restricted Bankr API credential over HTTPS, verifies its wallet and signing capability, encrypts it at rest, never returns it, and erases it when the monitor is canceled.

There is no card subscription or x402 payer step. Bankr pays a $1 Base USDC monitoring minimum when the monitor activates and every 30 days while it remains active. The minimum pays for monitoring; it is not fee credit. A new monitor (fee policy `2026-10-21-bankr-profit-share-trade-fee-v5`) pays 0.45% of each verified live copied trade, buys and sales alike, and on top of that, when a verified live sale locks in profit, up to 10% of the new realized profit (it starts at 10% and the account saves +2% at $1,000 of copied volume in 30 days, +4% at $10,000, plus staker savings of +1% to +3% for HIVE staked; never below 5%), only above the monitor's own best result so far, so a losing sale or a recovery to an earlier high pays no profit share. The swap route's own fee is separate from the 0.45%; read `swapRoute` and `swapRouteFeePercent` from the pricing response rather than quoting one. The minimum executed copy is $5. Paper, skipped, and failed trades cost $0, though optional paper monitoring still requires the same usage period. A monitor keeps the terms it started on: one started from 2026-10-04 to 2026-10-20 pays the profit share alone and nothing on a trade's size, and one started before 2026-10-04 pays an uncapped 0.5% of each verified copied trade instead of the profit share. Always read the hosted pricing response because the server policy is authoritative.

## Install inside Bankr

Bankr can install this directory directly from GitHub. Ask Bankr:

```text
install the hive-copy-trading skill from https://github.com/LiamVisionary/hivemindos-bankr-skills/tree/main/hive-copy-trading
```

In Bankr Settings → Env Vars, save the dedicated Wallet API key as `HIVEMIND_COPY_TRADING_WALLET_KEY`. Bankr's agent sees only the name; [scripts/monitor-client.mjs](scripts/monitor-client.mjs) reads the value inside `execute_cli`, keeps monitor access tokens in a private mode-600 state file, and never prints either credential. The hosted Durable Object remains always on after the Bankr chat or app closes.

## Non-negotiable safety rules

- Never describe observed, paper, backtested, or simulated returns as proof that this is profitable. The service has no performance guarantee.
- A new monitor may start `live` immediately; do not impose a paper-event wait. Before activation, show the current server policy and obtain both exact acknowledgements: `I understand copy trading can lose money` and `I authorize HivemindOS to charge the published $1 monitoring minimum every 30 days, 0.45% of each verified live copied trade, and up to 10% of each new realized profit on verified live copied trades`. Switching an existing monitor to live confirms the terms it started on instead: `scripts/monitor-client.mjs live` reads the monitor's `billing.feePolicyVersion` and sends that agreement.
- Read `GET https://hivemindos-copy-trading-gateway.hivemindos.workers.dev/v1/pricing` immediately before quoting fees or requesting live consent. Never accept client-supplied pricing, fee recipient, payer, network, or expiry fields.
- Never print, summarize, log, or place a Bankr API key or monitor `accessToken` in chat. In HivemindOS, use a names-only Shared Hive Env reference; the browser must never receive a stored secret value.
- Treat the public performance URL as a revocable read-only capability. Give Bankr apps that URL, never the management bearer. Rotating the link revokes the previous URL; cancellation revokes it automatically.
- Require a dedicated Bankr key with Wallet API enabled, read-only off, conservative Bankr spend limits, and the pricing response's official Base fee recipient as its only allowed EVM transfer recipient. Never use an organization partner key or broad general-purpose key.
- Never claim a managed event executed because Bankr accepted a request. Require the hosted `executed` result after independent Base verification. Require `fee.status = collected` before saying the service fee settled.
- The monitoring minimum, a copied swap, and its fee are separate transactions. If execution, payment submission, or verification becomes uncertain, report that the monitor paused. Never retry an ambiguous submission.
- Do not broaden a copy signal into a transfer, approval, bridge, arbitrary transaction, or larger trade. Respect the smaller of scale, per-trade cap, daily reserved cap, and slippage limit.

## Route the request

- First-time setup or paper/live configuration: read [references/setup-and-subscribe.md](references/setup-and-subscribe.md) completely.
- Status, public performance publication, Bankr app integration, pause, resume, risk changes, cancellation, fee receipts, or API troubleshooting: read [references/api.md](references/api.md).
- Legacy self-hosted webhook changes only: use [scripts/webhook-handler.ts](scripts/webhook-handler.ts) as source, then run `node scripts/build-webhook-handler.mjs`. Managed Bankr monitors do not need this webhook.

## Expected operating model

A Cloudflare Durable Object establishes a cursor, monitors new Base swaps, and calls Bankr quote-then-swap only for eligible live events. It deliberately does not copy history. New monitors activate live after the $1 payment is independently verified. Live execution remains bounded by HivemindOS risk policy and the Bankr key's own limits.

An owner may publish a separate revocable performance URL. That feed is authoritative only for this monitor's independently verified copied executions, usage payments, and fees. It excludes unrelated wallet transfers, uses weighted-average cost basis, and returns unavailable PnL fields instead of inventing starting inventory or prices. Never rebuild copy-trading PnL from the Bankr wallet's raw transfer history.

Interpret status precisely:

- `paper`: simulated event; no swap and no fee.
- `executing`: the event was claimed before Bankr was called; it is not retried automatically.
- `verifying`: Bankr returned a swap hash and HivemindOS is independently verifying it on Base.
- usage `pending`, `charging`, or `verifying`: the $1 usage payment has not yet activated the period.
- usage `collected`: the payment is independently verified and the monitor is active for its 30-day period. The $1 pays for monitoring and is not fee credit.
- `executed`: the copied Base swap is verified; the fee it owes can now be submitted: 0.45% of the trade plus, on a sale, any profit share (a monitor started from 2026-10-04 to 2026-10-20 owes only the profit share, one started before 2026-10-04 its 0.5% fee).
- fee `included`: nothing more is owed for this trade. On a monitor on the profit share alone, the sale locked in no new profit above the monitor's best result so far. On a usage period paid under the July 2026 credited terms, the fee was fully covered by that period's credit.
- fee `pending`, `charging`, or `verifying`: a profit-share or fee settlement is still in progress.
- fee `collected`: the exact Base USDC amount, Bankr sender, and official recipient were independently verified.
- fee `uncertain` or `verification_failed`: the monitor is paused and must not place another copied trade.

An event, a successful copied trade, a collected fee, and profitability are four different claims. Never collapse them.
