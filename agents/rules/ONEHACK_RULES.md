# ONEHACK PROJECT RULES (ONECHAIN HACKATHON)

## 1. Project Context
- **Name:** OneTrivia
- **Type:** GameFi + AI (Kahoot-style on-chain trivia).
- **Blockchain:** OneChain (Move-based).
- **Deadline:** 8 Days (MVP Focus).

## 2. Technical Stack (STRICT)
- **Smart Contract:** Move (2024 Edition).
- **Frontend:** Next.js latest (App Router), TypeScript, Tailwind CSS.
- **SDK:** @mysten/dapp-kit, @mysten/sui.js (OneChain SDK).
- **Backend:** Next.js API Routes (for Sponsored Transactions).

## 3. Architectural Constraints
- **Consensus:** Use `Shared Objects` for the Game Session (multiple users write to it).
- **Gas Strategy:** ALL user interactions (answering questions) MUST be **Sponsored Transactions**. Users must not pay gas.
- **Data Model:**
  - Questions text lives OFF-CHAIN (Frontend/API).
  - Only Answers (indices) and Scores live ON-CHAIN.
- **Indexing:** No external indexers (Subgraphs). Use `suix_queryEvents` or SDK Event Subscriptions.

## 4. Design System (Cyberpunk)
- **Colors:** Dark Navy (#020617), Cyan (#06b6d4), Yellow (#eab308).
- **UI:** Big buttons for mobile, High contrast for Host view.

## 5. Documentation References
- Refer to `docs/docs-onelabs-cc.md` for OneChain syntax and Sponsored Transaction implementation.
- Refer to `docs/dorahacks-io.md` for hackathon requirements.

## 6. Anti-Hallucination Directives
- DO NOT use Solidity or Ethereum patterns.
- DO NOT suggest complex file parsing for AI (use simple text prompts).
- DO NOT suggest "Owned Objects" for the main game state (it must be Shared).