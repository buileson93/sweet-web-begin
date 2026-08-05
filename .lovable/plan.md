# Plan: Deepening Security Audit for `autosave_rate:too_fast`

The user points out that individuals with the `autosave_rate:too_fast` error often have very high scores and fast completion times, raising concerns that this specific signal might be a byproduct of a cheating tool or a way to probe/manipulate the API.

## Current Analysis
- `autosave_rate:too_fast` occurs when requests hit the server faster than 1.2 seconds apart.
- Currently, it has a penalty of **0** to avoid penalizing users with poor network connectivity (where browsers might retry/burst requests).
- The user is suspicious that this is being used as a "smoke screen" or that cheating tools naturally trigger this while trying to inject answers.

## Proposed Actions

### 1. Update Internal Documentation with User's Observation
- Update the comment in `src/lib/integrity.ts` to reflect this new observation: that while it *could* be network-related, it is frequently correlated with suspicious high-speed/high-score performance.

### 2. Strengthen Speed Auditing Connection
- In `src/lib/exam/speedAudit.ts`, we currently include `autosave_rate` as a `ScriptSignal`.
- I will ensure that when `auditSpeed` sees `autosave_rate`, it triggers a more aggressive "reason" classification (e.g., `fast_with_script_signal`).

### 3. Adjust Penalty Strategy (Optional/Incremental)
- Since the user is "very suspicious", we could consider giving `autosave_rate:too_fast` a **small, non-zero weight (e.g., 1)** instead of 0, but only if it happens repeatedly (e.g., > 3 times in a session). This would contribute to the integrity score without disqualifying someone for a single network glitch.
- *Decision*: I will keep it at 0 for now to avoid breaking the "no false positives" rule, but I will improve the **logging** and **correlation** in the speed audit so that the admin sees it as a stronger red flag when combined with speed.

## Implementation Steps

### 1. Documentation Update
- Modify `src/lib/integrity.ts` to incorporate the user's specific suspicion about high-speed correlation.

### 2. Enhancing Speed Audit Logic
- Verify `src/lib/exam/speedAudit.ts` properly weights the presence of `autosave_rate` when evaluating overall exam speed.

## Verification
- Run existing integrity and speed audit tests.
