# SuperAgent API: what the script calls and what comes back

Everything runs through `scripts/superagent.mjs`. Its output is JSON with every credential replaced by `[kept private]`. The full public guide is https://hivemindos.app/superagent-api/llms.txt; treat it as authoritative if anything here is older.

## status

`GET https://api.hivemindos.app/v1/credits/balance` with the saved key.

- `connected: false`: no key yet. Run `setup`.
- `connected: true` with `balance`: say the SuperAgent API is set up and how many credits it has. A balance of 0 means calls that cost credits are refused until the person claims the account (250 free credits) or adds credits.
- `keyFrom` says where the key is read from: the Bankr Env Var `HIVEMINDOS_API_KEY`, or the saved file.

## setup (free)

`POST https://api.hivemindos.app/v1/setup-sessions` with `{ "label": "Bankr agent", "agentName": "Bankr", "instant": true }`. No credential is needed.

- `claimUrl`, `confirmCode`: the link and code for the person. They have 30 days to claim the account. The page shows the same code, so they can see it is the setup their agent opened.
- `dailyLimitCredits`: 2,500 (about $5 a day) until the person changes it.
- `emailSent`: whether the person was emailed a one-tap claim button (only when `--email` was given).
- `next`: the message to give them, in your own words.

## setup --pay (Bankr pays)

1. `POST /v1/setup-sessions` (not instant) starts a session the agent pays for.
2. Bankr pays `POST /v1/setup-sessions/fund` with `{ "amountUsd": <n> }`, the session's claim token as `Authorization` and one `Idempotency-Key`.

Success (`ok: true`): `creditedUsd`, `creditedCredits`, `paymentMade` (`amountUsd`, `network`, `payTo`) and `takeOverUrl`. Give the person `takeOverUrl`: it lets them take over the account in a browser and add their email to keep it.

Refusals:
- `Bankr did not pay: ...`: Bankr's own answer. A price above the cap, an unparseable 402, a paused wallet or a spend limit all refuse **before** anything is paid.
- `ok: false` with `answer.code`:
  - `already_funded` (409): this setup was paid with another payment key. Do not pay again; run `status`.
  - `already_approved` (409): the person approved it in a browser first.
  - `already_collected` (409): the key was handed over more than 30 minutes ago. The person makes a new key at https://hivemindos.app/superagent-api/console/#keys.
  - `expired` (410): the setup is more than an hour old. Run `setup --pay` again.
  - Any other: run the same command once more. It reuses the same session and payment key.

## top-up

Bankr pays `POST https://api.hivemindos.app/v1/credits/x402/top-up` with `{ "amountUsd": <n> }`, the key as `Authorization` and a new `Idempotency-Key`. Success: the amount credited, a receipt id and the new balance in `answer`; `paymentMade` from Bankr.

## services, route, invoke

- `services`: `GET /v1/services`, what the key may call.
- `route "<request>"`: `POST /v1/requests/route` with `{ "request": "..." }`. It answers `selected` (one action to run), `choose` (ranked actions, ask the person which), or `no_match`. It runs nothing.
- `invoke <serviceId> <operationId> '<json>'`: `POST /v1/services/{serviceId}/invoke` with `{ "operationId", "input" }` and a fresh `Idempotency-Key`.
  - `402`: the account needs credits.
  - `403 scope_not_supported`: the key may not call this service.
  - `502 upstream_error`, `503 upstream_unavailable`, `504 upstream_timeout`: safe to try again after a short wait.
  - Long work (research, reports, media) answers with a run or a follow-up to collect: follow the answer's own instructions.

## MCP inside Bankr

`https://api.hivemindos.app/mcp` (or `https://api.hivemindos.app/v1/private/mcp`). In Bankr, add it with the header `Authorization: Bearer {{HIVEMINDOS_API_KEY}}`; Bankr fills the value from Env Vars and never shows it. By default the server exposes eight tools: four for memory and four that search and run any action.
