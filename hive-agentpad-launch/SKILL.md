---
name: hive-agentpad-launch
description: Launch the AgentPad coin of a HivemindOS agent whose NFT the Bankr wallet holds (a HivePunk, a 721T agent, or an NFT made a HivemindOS agent), paid in USDC over x402 from that wallet, with liquidity locked and the coin's trading fees paying for the agent's thinking and its holder.
tags: [hivemindos, agentpad, token-launch, agents, 721t, x402, base]
version: 1
visibility: public
metadata:
  clawdbot:
    emoji: "🐝"
    homepage: "https://github.com/LiamVisionary/hivemindos-bankr-skills/tree/main/hive-agentpad-launch"
---

# Launch an agent's coin on AgentPad

AgentPad is HivemindOS's launchpad for agent coins. The coin launches from the agent's own wallet with its liquidity locked, named after the agent unless you say otherwise. Its trading fees wake the agent and keep it working, and part goes to whoever holds its NFT. Nobody needs ETH: the price covers the launch's network fee and the rest becomes the agent's own credits.

## Install inside Bankr

```text
install the hive-agentpad-launch skill from https://github.com/LiamVisionary/hivemindos-bankr-skills/tree/main/hive-agentpad-launch
```

No API key or Env Var is needed: you use the Bankr wallet's own x402 and transaction tools.

## Before anything

1. **Name the agent:**
   - a HivePunk: `hivepunkz:<number>`;
   - an NFT already a HivemindOS agent, or one with its own agent identity (ERC-8048 or an ERC-8004 binding): `nft:<collection>:<tokenId>` on Base, `nft:4663:<collection>:<tokenId>` on Robinhood Chain.
   - A plain NFT that is not an agent yet: use the hive-nft-to-721t skill first, or its $7 convert-and-launch.
2. **Check the Bankr wallet holds that NFT** (or is its delegate.xyz delegate). The payment from the holder's wallet is the holder's yes; from any other wallet the launch is refused.
3. **Tell the person, and get a clear yes:**
   - **One coin per agent, forever.** It cannot be undone or relaunched.
   - **The price is $2 in USDC on Base** today. The launch settings can change it by chain and collection, and the payment request's price is authoritative: if it asks for more than you quoted, stop.
   - **The fees:** every trade pays a 2% fee. The first $20 of fees all goes to the agent's thinking (that wakes it). After that, 45% goes to the agent (its thinking and treasury), 25% to its creator (whoever holds the agent's NFT when fees are paid out, so 0.5% of all volume, and it moves with the NFT when it is sold), 15% buys $HIVE that is burned, 10% goes to HivemindOS and 5% goes back into the coin's own locked liquidity.
   - Never promise the coin will trade, rise, or earn anything.
4. **Ask what to call it** if the person cares: name, ticker, logo (`https://` or `ipfs://`), description, website, X account. Otherwise the agent's own name and face are used. Pair: `eth` (default) or `hive` on Base; `eth` or `usdg` on Robinhood Chain.

## The steps

All calls go to `https://hivemindos-paid-agent-gateway.hivemindos.workers.dev`.

1. **Pay over x402, from the holder's Bankr wallet**, with a cap of the quoted price:
   `POST /api/x402/agent-coins/launches` with `{"agent":"hivepunkz:441"}` plus any of `metadata` (`name`, `symbol`, `logo`, `description`, `website`, `twitter`), `pair`, `chain`, and `agentId` for an NFT bound to an ERC-8004 agent elsewhere.
2. **Read the answer:**
   - `result.coin` (`token`, `symbol`): launched. Report the token address, the ticker, `result.agentPage` and the payment receipt, and pass on `result.briefing` in your own words.
   - `result.waitingFor: "identity"`: paid, and one transaction is still needed. Send `result.identity.transaction` from the same Bankr wallet, exactly as given, wait for it to confirm, then `POST /api/x402/agent-coins/launches/finish` with `{"launchId":"<result.launchId>"}`. That call is free. A purchase nobody finishes goes back to the buyer's credits after 30 days.
   - A refusal (`403`, `409`, `429`): nothing is paid. Give the answer's own reason. Whitelist refusals point to https://hivemindos.app/launchpad/whitelist/ (AgentPad opens to approved wallets first, one coin an hour while it opens).

Read [references/api.md](references/api.md) for every field and refusal.

## Rules

- Never launch for an agent whose NFT the Bankr wallet does not hold, and never one the person did not name.
- Never pay more than the quoted price, and never pay twice for one agent.
- Never add a recipient, network or price to a request. HivemindOS chooses them.
- A payment, a launched coin, and fees earned are different facts. Say only the ones the answers show.
