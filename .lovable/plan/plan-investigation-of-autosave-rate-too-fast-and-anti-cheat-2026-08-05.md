# Plan: Investigation of `autosave_rate:too_fast` and Anti-Cheat Security

The user wants to investigate whether the `autosave_rate:too_fast` mechanism (which currently carries 0 penalty due to network instability) could be exploited to interfere with exam speed or cheat.

## Investigation Findings

1. **Server-Side Enforcement**:
   - The rate limit is enforced in `src/lib/exam/saveRate.ts` and `src/lib/exam/helpersWrite.server.ts` via the `exam_claim_save` RPC.
   - Requests arriving faster than 1.2s are **rejected** by the server. No data from "too fast" requests is written to the database.

2. **Zero Penalty Logic**:
   - In `src/lib/integrity.ts`, `autosave_rate:*` events return a score of **0**.
   - This prevents false positives caused by flaky connections or browser retries (which often "drip" requests in bursts).

3. **Abuse Analysis**:
   - **Interference with Speed**: A user cannot "speed up" their exam by flooding requests because the server only accepts one save every 1.2s.
   - **Hiding Other Signals**: Even if a user floods requests, other signals (like `untrusted_input` or `liveness_failed`) are checked independently per request.
   - **Resource Exhaustion**: The server has a hard cap of `MAX_SAVES_PER_SESSION` (400) and `MAX_BEACONS_PER_SESSION` (40). Once reached, the server stops accepting saves entirely for that session, which would actually *hinder* a cheater.

## Proposed Actions

### 1. Document the Concern
- Add a detailed comment in `src/lib/integrity.ts` near the 0-penalty logic to capture the user's specific concern ("could this be exploited?") for future maintainers.

### 2. Investigation Report
- Provide a summary of how the system is resilient to this specific type of interference.

## Verification
- No functional code changes are required beyond documentation/comments, but I will verify that `MAX_SAVES_PER_SESSION` is correctly enforced.
