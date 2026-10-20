---
name: hive-nft-to-721t
description: Turn an NFT on Base that the Bankr wallet holds into a HivemindOS AI agent (an ERC-8004 agent under the 721T standard, with its own credits, wallet and public chat that move with the NFT), paid in USDC over x402 from the Bankr wallet, optionally launching its AgentPad coin in the same payment.
tags: [hivemindos, nft, 721t, erc-8004, agents, x402, base]
version: 1
visibility: public
metadata:
  clawdbot:
    emoji: "🐝"
    homepage: "https://github.com/LiamVisionary/hivemindos-bankr-skills/tree/main/hive-nft-to-721t"
---

# Make an NFT a HivemindOS agent (721T)

An NFT becomes an agent of its own: an ERC-8004 identity bound through the 721T adapter, 1,250 HivemindOS credits, a wallet and a public chat at hivemindos.app, all tied to the NFT, so they move with it when it is sold. Whoever holds the NFT controls the agent. It takes one free transaction from the holder's wallet and one x402 payment.

## Install inside Bankr

```text
install the hive-nft-to-721t skill from https://github.com/LiamVisionary/hivemindos-bankr-skills/tree/main/hive-nft-to-721t
```

No API key or Env Var is needed: you use the Bankr wallet's own transaction and x402 tools.

## Before anything

1. Get the NFT's **contract on Base** and **token id**. Other chains are not sold over x402 here; send the person to https://hivemindos.app/agents for those.
2. Check the Bankr wallet holds it. If it does not, stop: the register transaction must come from the holder's wallet.
3. Tell the person what is permanent and what it costs, and get a clear yes:
   - The NFT becomes an agent. That cannot be undone.
   - **$5 in USDC on Base** for the conversion. Or **$7** for the conversion and its coin launch together (AgentPad: one coin per agent, ever). See the hive-agentpad-launch skill for what a coin is before offering it.
   - The price in the payment request is authoritative. If it asks for more than you quoted, stop and tell the person.

## The steps

All calls go to `https://hivemindos-paid-agent-gateway.hivemindos.workers.dev`.

1. **Get the register transaction (free).**
   `POST /api/x402/agent-conversions/prepare` with `{"collection":"0x<contract>","tokenId":"<id>","wallet":"0x<the Bankr wallet>"}`.
   - `200`: `transaction` is `{ chainId: 8453, to, data }`. Nothing is charged.
   - `409` naming an `agentId`: the NFT is already an ERC-8004 agent. Skip step 2 and pay in step 3 with that `agentId` instead of `txHash`.
   - `409` "already a HivemindOS agent": it is converted already. Offer the coin launch instead (hive-agentpad-launch).
   - `403`, or a HivePunk or Looper: this NFT cannot be converted here. Say why, in the answer's own words.
2. **Send that transaction** from the Bankr wallet exactly as given (same `to`, `data`, chain 8453, no value) and wait for it to confirm. Keep its hash.
3. **Pay over x402** with a cap of the quoted price:
   - Conversion only: `POST /api/x402/agent-conversions` with `{"collection","tokenId","txHash"}` (or `agentId`), **$5**.
   - With the coin: `POST /api/x402/agent-coins/convert-and-launch` with the same body plus optional `metadata` (`name`, `symbol`, `logo`, `description`, `website`, `twitter`), `pair` and `chain`, **$7**.
   - "isn't confirmed yet": wait a few seconds and repeat the same call. A refused or failed call is not settled, so nothing is paid for it.
4. **Report** from the answer: `result.agentId`, `result.agentCredits`, the agent's page (`result.agentPage`), the coin if one launched, the payment receipt and transaction hash, and pass on `result.briefing` to the person in your own words.

Read [references/api.md](references/api.md) for every field and refusal.

## Rules

- Never convert an NFT the Bankr wallet does not hold, and never one the person did not name.
- Never pay more than the quoted price, and never pay twice for the same NFT. If an answer is unclear, read it back to the person instead of retrying with a new payment.
- Never add a recipient, network or price to a request. HivemindOS chooses them.
- A sent transaction, a payment, and a converted NFT are three different facts. Say only the ones the answers show.
