# NFT to Agent over x402: the calls

Base URL: `https://hivemindos-paid-agent-gateway.hivemindos.workers.dev`. Every paid call is x402 v2, USDC on Base (`eip155:8453`). The `402` challenge carries the price, the recipient and a Bazaar description; it is authoritative over this file.

## POST /api/x402/agent-conversions/prepare (free)

Body: `{ "collection": "0x<40 hex>", "tokenId": "<digits>", "wallet": "0x<holder>" }`.

| Answer | Meaning | Do |
|---|---|---|
| `200 { ok: true, transaction: { chainId: 8453, to, data }, then }` | The register transaction to send | Send it from the holder wallet, unchanged |
| `409` with `agentId` | Already bound to an ERC-8004 agent elsewhere | Pay with `agentId`, no transaction |
| `409` "This NFT is already a HivemindOS agent." | Converted already | Offer its coin launch instead |
| `403` | Not convertible here | Stop and give the answer's own reason |
| `400` | The collection or token id is malformed | Fix the request |

## POST /api/x402/agent-conversions ($5)

Body: `{ "collection", "tokenId", "txHash" }`, or `agentId` instead of `txHash`.

Success: `200 { ok: true, receiptId, result: { agentId, agentCredits: 1250, agentPage, launchCoin, briefing } }`. The `payment-response` header carries the payment's transaction hash.

- "isn't confirmed yet": the register transaction is not mined; repeat after a few seconds.
- A refusal returns its own status and message, and the payment is cancelled, not settled.

## POST /api/x402/agent-coins/convert-and-launch ($7)

Body: the conversion's body plus optional `metadata` (`name`, `symbol`, `logo` as `https://` or `ipfs://`, `description`, `website`, `twitter`), `pair` (`eth` default, or `hive` on Base) and `chain` (`base`). Pay from the wallet that holds the NFT: that payment is the holder's yes to the launch.

Success: the conversion's fields plus `coin` (`token`, `symbol`) and more agent credits. If `result.waitingFor` is `"identity"`, follow the two-step finish in the hive-agentpad-launch skill's reference.

## What the agent gets

- An ERC-8004 identity bound by the 721T adapter: control follows whoever holds the NFT (or their delegate.xyz delegate).
- 1,250 HivemindOS credits of its own, kept on the NFT.
- A wallet and a public chat at its page on hivemindos.app.
- Over 300 HivemindOS capabilities through the SuperAgent API (see the hive-superagent-setup skill).
- Its credits top up over x402: `POST /api/x402/agent-coins/credits` with `{ "agent": "nft:<collection>:<tokenId>", "amountUsd": <n> }`.
