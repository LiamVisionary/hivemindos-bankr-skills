# AgentPad launch over x402: the calls

Base URL: `https://hivemindos-paid-agent-gateway.hivemindos.workers.dev`. Paid calls are x402 v2, USDC on Base (`eip155:8453`). The `402` challenge's price and recipient are authoritative over this file.

## POST /api/x402/agent-coins/launches (paid, $2 shipped)

Body:

| Field | Required | Value |
|---|---|---|
| `agent` | yes | `hivepunkz:<n>`, `nft:<collection>:<tokenId>`, or `nft:4663:<collection>:<tokenId>` on Robinhood Chain |
| `agentId` | no | For an NFT bound to an ERC-8004 agent elsewhere: that agent id |
| `metadata` | no | `name`, `symbol`, `logo` (`https://` or `ipfs://`), `description`, `website`, `twitter` |
| `pair` | no | `eth` (default) or `hive` on Base; `eth` or `usdg` on Robinhood Chain |
| `chain` | no | `base` or `robinhood`; an agent on Robinhood Chain launches there |

The payer must hold the NFT or be its delegate.xyz delegate; the agents service checks that on chain again before it launches.

### Launched

`200 { ok: true, receiptId, result: { coin: { token, symbol, chainName }, name, agentCredits, agentPage, briefing } }`. `agentCredits` is what was left of the price after the launch's network fee, given to the agent and kept on its NFT.

### Paid, waiting for the identity transaction

`200 { ok: true, result: { coin: null, launchId, waitingFor: "identity", identity: { transaction, url }, steps, signThis } }`.

1. Send `identity.transaction` from the holder wallet. It points the agent's own identity at its HivemindOS chat.
2. If that wallet has no ETH for gas: `POST /api/nft-agents/launch/identity-fee` with `{ "launchId", "signature" }`, where `signature` is the wallet's `personal_sign` of `signThis`. HivemindOS sends the network fee once.
3. `POST /api/x402/agent-coins/launches/finish` with `{ "launchId" }`. Free. Answers like a launch.

A paid purchase nobody finishes gives its hold back to the buyer's own credits after thirty days.

### Refusals (nothing is paid)

| Status, code | Meaning |
|---|---|
| `400` | The agent is not named, or the payment did not name its wallet |
| `403 whitelist_required` | AgentPad is open to whitelisted wallets first: apply at https://hivemindos.app/launchpad/whitelist/ |
| `403 whitelist_pending` | The application is still being reviewed |
| `403 whitelist_used` | This wallet launched its whitelist coin already |
| `429 whitelist_spacing` | One coin launches an hour while AgentPad opens; `nextLaunchAt` says when |
| `409` | The launch is free for this agent (launch it from its page), or it already has a coin |
| `404` on finish | No paid launch with that `launchId` is waiting |

## Fees, as every AgentPad page states them

Every trade pays a 2% fee. The first $20 of fees all pays for the agent's thinking. After that: 45% to the agent, 25% to its creator (the NFT's holder at payout, 0.5% of all volume), 15% buys $HIVE that is burned, 10% to HivemindOS, 5% back into the coin's locked liquidity. The split is applied when fees are collected, every few hours.

## After the launch

- The coin's page: `result.agentPage` (hivemindos.app/launchpad).
- Fund the agent more: `POST /api/x402/agent-coins/credits` with `{ "agent", "amountUsd" }`, all of it as the agent's credits (500 to the dollar).
