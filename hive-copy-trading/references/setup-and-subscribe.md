# Set up and activate a monitor

Complete this workflow in order. A new monitor may activate live immediately; never force the user to wait for a paper signal.

## 1. Read hosted availability and commercial policy

```bash
curl -fsS https://hivemindos-copy-trading-gateway.hivemindos.workers.dev/health
curl -fsS https://hivemindos-copy-trading-gateway.hivemindos.workers.dev/v1/pricing
```

Stop if health is not configured or pricing does not report `pricingAuthority: server` and `clientOverridesAccepted: false`. Record the exact policy version, usage minimum, period, percentage, cap status, minimum copied trade, Base network, USDC asset, and official recipient. Do not reconstruct them from this file.

The current model is a $1 monitoring minimum per rolling 30-day active period plus up to 10% of each new realized profit. The minimum is not fee credit: it pays for monitoring the period. Nothing is charged on a trade's size. When a verified live sale locks in profit above the monitor's best result so far, a share of that new profit is owed: it starts at 10%, and the account saves +2% once it has copied $1,000 in 30 days and +4% from $10,000, plus staker savings of +1% at Honeybee, +2% at Bumblebee and +3% from Mason Bee; the lowest rate is 5%. Describe these to users as savings, not reductions. At 10%, a monitor that has realized $50 of profit owes $5 in all, and owes nothing more until it passes $50. Read the current scale from `GET /v1/pricing`. Losing, failed and skipped trades cost $0. A monitor started before 2026-10-04 keeps its earlier terms, an uncapped 0.5% of each verified copied trade. There is no card subscription, x402 payment, or separate payer wallet; the Bankr execution wallet pays directly.

## 2. Connect and fund the Bankr wallet safely

Use an existing Bankr wallet or create one at `https://bankr.bot/api`. Bankr embedded wallet keys are non-exportable; never request or promise a recovery phrase.

Create a dedicated `bk_usr` key with:

- Wallet API enabled
- read-only off
- agent, LLM, and token-launch APIs off when Bankr exposes those toggles
- conservative per-transaction and daily Bankr spend limits
- the pricing response's official fee recipient as the only allowed EVM transfer recipient

The recipient allowlist does not redirect swaps: Bankr returns swap output to the execution wallet. It permits only the separate Base USDC usage and excess-fee transfers.

In HivemindOS, choose an existing Shared Hive Env variable. Continue resolves and verifies it server-side without rewriting it. The pencil opens manual entry; Save is only for a new value and writes through `hive-env-add` after verification. For direct integrations, send the key only over HTTPS to `POST /v1/bankr/verify`. Verification checks EVM identity, a non-broadcast `personal_sign` capability proof, and the exact Base USDC balance. Never paste the key into chat, logs, screenshots, or a checked-in file.

Inside Bankr, add the key in Settings → Env Vars as `HIVEMIND_COPY_TRADING_WALLET_KEY`; do not paste it into chat. The packaged helper reads the value only inside `execute_cli`.

Fund the Bankr wallet with at least $1 Base USDC for activation plus the intended copy-trading budget. Bankr sponsors Base gas, so this flow does not require a separate ETH gas step. If `GET /health` reports `partnerProvisioningConfigured: true`, `{ "kind": "provisioned" }` can create a restricted wallet automatically; otherwise Bankr's self-serve wallet creation must remain usable.

## 3. Show terms and activate live

Generate one stable idempotency key and reuse it if the request times out. Obtain both exact acknowledgements before sending this body:

```json
{
  "activationIdempotencyKey": "ctstart_11111111-1111-4111-8111-111111111111",
  "targetWallet": "0xTARGET_ON_BASE",
  "bankrConnection": {
    "kind": "existing",
    "apiKey": "<dedicated-bk_usr-key>"
  },
  "mode": "live",
  "riskAcknowledgement": "I understand copy trading can lose money",
  "feeAcknowledgement": "I authorize HivemindOS to charge the published $1 monitoring minimum every 30 days and up to 10% of each new realized profit on verified live copied trades",
  "maxTradeUsd": 5,
  "maxDailyUsd": 25,
  "scalePercent": 20,
  "maxSlippageBps": 100
}
```

POST it as ordinary HTTPS JSON to:

```text
https://hivemindos-copy-trading-gateway.hivemindos.workers.dev/v1/monitors
```

Inside Bankr, prefer the credential-safe helper:

```bash
node scripts/monitor-client.mjs start --target 0xTARGET_ON_BASE --max-trade 5 --max-daily 25 --scale 20 --slippage 100 --confirm-risk --confirm-fee
```

The helper fetches current pricing, verifies sufficient Base USDC, persists the idempotency key before the network call, stores the returned access token in a mode-600 private state file, and prints only non-secret monitor details.

Do not add `price`, `priceUsd`, `payTo`, `payer`, `network`, `expiresAt`, `billingModel`, usage fields, fee fields, or a client-selected recipient. The server rejects those authority overrides. New-monitor bounds are $5–$10,000 per trade, $5–$50,000 per UTC day, 1–100% scale, and 10–500 bps slippage; the per-trade cap cannot exceed the daily cap.

## 4. Verify activation and operation

Capture the response privately. Store `accessToken` in encrypted owner-private storage with file mode `600`; never put it in chat or source. Retain `monitorId`, `manageUrl`, target, Bankr wallet, and published billing object. The Bankr API key is encrypted by the hosted Worker and is not returned.

GET `manageUrl` with `Authorization: Bearer <accessToken>`. The new subscription initially reports `billingModel: bankr-usage-minimum` and may be `paused` while usage status is `pending`, `charging`, or `verifying`. HivemindOS first claims the charge, Bankr submits exactly $1 Base USDC, and Blockscout must independently match the token, amount, sender, recipient, and successful transaction. Only `usagePeriod.status: collected` activates the monitor for its 30-day period.

The first target scan establishes a cursor and never copies older trades. A live event under $5 after scale and caps is skipped. A verified sale pays the profit share it owes, if any, and `amountUsd` is what Bankr sends (a monitor started before the profit share pays 0.5% of actual copied notional instead). `usageCreditAppliedUsd` is non-zero only in a period paid under the earlier credited policy, where remaining credit was used first and `amountUsd` shows only the excess.

Optional paper mode remains available for testing classification, but it uses the same paid usage period and is not a prerequisite for live execution. Copy-trading results are not proof of future profitability.

Pausing prevents new periods from renewing while paused. Resuming during an already funded period is immediate. If a known pre-submission failure says the wallet needs funds, fund it and resume to retry safely. Never retry an `uncertain` payment or execution outcome.
