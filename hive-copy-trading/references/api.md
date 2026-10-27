# Hosted API and operating rules

Base URL: `https://hivemindos-copy-trading-gateway.hivemindos.workers.dev`

## Public setup routes

- `GET /health` — monitoring, live-mode, managed Bankr execution, partner provisioning, fee-recipient configuration, and kill-switch status.
- `GET /v1/pricing` — authoritative rolling usage-minimum policy, the profit-share rate and its scale (`profitSharePercent`, `profitShareMinimumPercent`, `profitShareScale`), cost coverage, and no-profit-guarantee statement. New monitors pay no percentage of trade size (`feePercent: 0`).
- `POST /v1/bankr/verify` — checks a dedicated `bk_usr` key with `/wallet/me`, a non-broadcast `personal_sign`, and `/wallet/portfolio`; it returns EVM identity and Base USDC balance, never the key.
- `POST /v1/monitors` — idempotently starts a monitor. This is ordinary HTTPS, not a paid x402 route.

LLM-only and read-only keys fail during setup because managed execution requires restricted Wallet API signing access.

## Authenticated monitor management

Use the returned `manageUrl` with `Authorization: Bearer <accessToken>`.

- `GET <manageUrl>` — monitor, current usage period (with any credit left from a period paid under the earlier credited policy), conservative UTC-day reservations, and 20 recent event/fee outcomes.
- `PATCH <manageUrl>` — active/paused status, optional paper/live mode, or bounded risk settings.
- `DELETE <manageUrl>` — stop monitoring and erase the hosted Bankr credential. Owners of existing keys should also revoke them in Bankr as defense in depth.

### Publish verified performance

`POST <manageUrl>/performance-share` creates a new read-only public capability URL. Creating another link rotates and immediately revokes the previous one. The response contains `publicUrl`, `schemaVersion`, `createdAt`, and `rotated`; it never returns the monitor bearer.

`DELETE <manageUrl>/performance-share` revokes the active link. Canceling the monitor revokes it automatically. Status exposes only `performanceShare.enabled`, `createdAt`, and `revokedAt`, never the link token.

From the packaged helper:

```bash
node scripts/monitor-client.mjs publish --id ctmon_...
node scripts/monitor-client.mjs unpublish --id ctmon_...
```

The helper reads the private mode-600 monitor state and prints only the newly issued public URL. Do not pass the management bearer to a Bankr app.

### Bankr app contract

A Bankr app should fetch the issued `publicUrl` from its server-side or scheduled script and render the returned feed. Do not scan the Bankr wallet or calculate copy-trading PnL from raw transfers.

- Require `authority: server-verified-copy-execution-ledger` and schema `2026-07-17`.
- Show `summary.verifiedCopiedTrades`, verified notional, fee credit, excess fees, usage minimums, realized/unrealized/gross/net PnL, and `openPositions` from the feed.
- Respect `summary.accounting.complete` and `summary.accounting.reasons`. Render `null` PnL as unavailable; never coerce it to zero.
- Link only the source, execution, and fee transaction hashes supplied by the feed.
- Label the result as copy-execution performance, not whole-wallet PnL. Preserve `performanceGuarantee: false`.
- Treat HTTP 404 as a rotated/revoked link and ask the owner for a new one. Do not ask for the monitor bearer.

Public read shape:

```text
GET /v1/public/monitors/<targetWallet>/<monitorId>/performance/<ctshare_token>
```

The response is `Cache-Control: no-store`. It contains no Bankr key, monitor access token, encrypted credential, or arbitrary wallet-transfer ledger.

### Opt-in copytrading leaderboard

`GET /v1/leaderboard` returns public rankings built only from published monitors and the same server-verified copy-execution ledger. A row exposes the copied target's short label, Basic or Agent strategy, verified net result after fees, verified trade count, copied volume, and an optional Bankr-verified X handle. It never exposes the execution wallet, Bankr key, management bearer, or whole-wallet transfers.

Rank only entries where `accountingComplete` and `ranked` are true. A monitor with zero verified copied trades, incomplete accounting, or unavailable net result remains unranked and should render as collecting data. Preserve `performanceGuarantee: false` and never describe rank as a forecast or promised return.

The authenticated Bankr dashboard joins or leaves one owned active copy with:

```text
POST|DELETE /v1/dashboard/monitors/<targetWallet>/<monitorId>/leaderboard
X-Hivemind-Bankr-Management-Key: <managementKey>
```

Publishing is opt-in per copy. `POST|DELETE /v1/dashboard/leaderboard/x` links or hides the owner's Bankr-verified X identity. An approved public Bankr Agent Profile may link automatically; other connected X identities require the explicit `POST`. A `DELETE` stores an unlink preference that suppresses future automatic linking. The public leaderboard uses `Cache-Control: no-store` so publication and identity removal are not delayed by an intermediary cache.

### Agent learning dashboard contract

Authenticated owner-dashboard responses for Agent strategies include `learning`. The Bankr app should show the sanitized `private` and `global` counts, 50-outcome batch progress, and the supplied privacy statement. Basic strategies return no learning block.

The policy observes a priced Agent decision at a fixed 24-hour horizon and compares it with the unchosen copy-or-skip alternative. Only completed prior batches may influence a new decision. Private influence requires at least five matching observations; global influence requires at least fifteen. Learned evidence may turn a soft copy into a skip, but it cannot override a deterministic safety skip.

Private outcomes remain owner-scoped. Global outcomes contain no owner, execution wallet, target wallet, transaction, token address, symbol, or other raw trade identity, and only consistent paper outcomes are eligible. Historical HivemindOS findings are imported through a separate operator-only route; do not expose that route or its secret in an end-user app.

Pause with `{"status":"paused"}` and resume with `{"status":"active"}`. Change risk settings with a supported subset of `maxTradeUsd`, `maxDailyUsd`, `scalePercent`, and `maxSlippageBps`.

New monitors use `bankr-usage-minimum`. Already-consented `bankr-per-trade` monitors retain their original fee floor, cap, and paper gate; do not silently replace their commercial terms. Existing legacy prepaid monitors remain prepaid through their original expiry.

## Usage, execution, and fee state machines

1. The Worker claims the $1 period as `charging` before calling Bankr `/wallet/transfer`.
2. It checks the exact Base USDC balance before submission. A known insufficient-balance failure is safe to retry only after funding and an explicit resume.
3. A returned hash becomes usage `verifying`. Blockscout must independently match success, Base USDC, exact amount, Bankr sender, and official recipient before usage becomes `collected` and the monitor activates for its period.
4. For a copied trade, the Worker writes `executing` before calling Bankr. It never automatically retries an ambiguous swap submission.
5. It quotes with `/wallet/swap-quote`, enforces USD and slippage ceilings, then calls `/wallet/swap`.
6. A returned swap hash becomes `verifying`. Blockscout must prove the matching swap from the Bankr wallet within the server limit before `executed`.
7. For a monitor on the current terms, the server charges 0.45% of verified actual notional on every live trade, and on a sale also works out the share of new realized profit above the monitor's best result so far, at the monitor's current rate (10% at most, never below 5%). A monitor started from 2026-10-04 to 2026-10-20 pays only that profit share. If nothing is owed, fee `included` is final and nothing is transferred. Legacy terms only: a monitor started before 2026-10-04 instead pays an uncapped 0.5% of verified actual notional, and a usage period paid under the July 2026 credited terms still holds usage credit; the server reserves that credit atomically, and if it covers the fee, fee `included` is final and no second transfer is made.
8. Only an amount still owed enters fee `charging`, then Bankr `/wallet/transfer`. The returned hash becomes fee `verifying`; exact on-chain verification is required before `collected` and revenue recognition.
9. Unknown fee-payment outcomes become fee `uncertain`; on-chain mismatches become `verification_failed`. Either pauses the monitor and is never automatically retried. At most one live execution or unsettled fee may exist per monitor.

Failed, skipped, and unverified trades have no percentage fee. The $1 usage minimum remains the cost of keeping that monitor active for the period. A payment is not collected merely because Bankr accepted the transfer request.

## Failure handling

- 400: invalid input, missing exact consent, or client-owned commercial fields.
- 401: wrong or missing bearer/key; never retry with guessed credentials.
- 402: the existing Bankr wallet does not yet have the $1 Base USDC activation minimum.
- 409: replay, invalid state transition, or stale consent.
- 410: expired signal; never execute it manually.
- 424: hosted encryption, fee recipient, or optional partner provisioning is incomplete.
- 503 with `comingSoon`: product or live mode is disabled.

The legacy `POST /v1/subscriptions/recover` route exists only for already-settled historical x402 activations. If such a recovery is present, use the encrypted stored token and never pay again. New monitors never create an x402 recovery payment token.
