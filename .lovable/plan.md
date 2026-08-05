# Plan: Visual Text Edits & Anti-Cheat Analysis

This plan addresses the user's request to replace specific UI text with a detailed explanation of anti-cheat logic and provides an analysis of the "autosave too fast rpc" warning.

## User Request Summary
1.  **UI Text Replacement**: Change a specific text (identified as related to "language selector" in the request) to a Vietnamese explanation of anti-cheat strategies.
2.  **Anti-Cheat Analysis**: Explain the "autosave too fast rpc" notification and address concerns about false positives (unjustified integrity penalties).

## Analysis of "Autosave Too Fast"
- **What is it?**: The `autosave_rate:too_fast` signal is triggered when the system detects multiple save requests (RPCs) sent within a very short interval (`MIN_GAP_RPC_MS = 1200ms`).
- **Is it a penalty?**: Based on `src/lib/integrity.ts` (lines 145-150), this specific reason results in **0 integrity penalty**. It is logged for audit purposes but does not affect the candidate's score or status.
- **Why does it happen?**: It often occurs due to network instability (re-sending failed requests), browser behavior (beaconing during tab hides), or rapid interactions that the client debouncer didn't catch.
- **Is it unfair?**: No, because it carries a weight of 0. Users seeing "integrity warnings" for this are likely seeing a general "Integrity Score" that includes *other* events (like leaving the tab), not just the autosave rate.

## Proposed Changes

### 1. Identify Target Component
The user wants to replace text labeled "language selector". Although no component named `LanguageSelector.tsx` exists, the project uses `src/components/PaletteSwitcher.tsx` and `src/components/ProductTour.tsx`. However, the request likely refers to the "Instruction" page (`src/routes/huong-dan.tsx`) or a specific tooltip in the Admin UI where technical terms are explained. Given the context of "language selector", it might be a mistranslation or a placeholder in a layout file.

I will search for the specific English string "language selector" one last time in a broader way, then apply the text to the most relevant "Instruction" section or create a dedicated "Anti-Cheat Information" section.

### 2. Update `src/routes/huong-dan.tsx`
Add the user's requested text to the FAQ or a new "Security" section to provide clarity to users.

### 3. Update `src/lib/integrity.ts`
Ensure the description for `script_suspect` with `autosave_rate` is even clearer in the Admin view to prevent "unfair" labels.

## Execution Steps
1.  **Search**: Final search for the exact "language selector" string.
2.  **Edit**: Replace the identified text with:
    > "lên kế hoạch chống gian lận bằng cách phân tích hành vi có click hoạt chạm màn hình, với tốc độ ko đều , tôi thấy có thông báo nghi vấn dùng script - autosave too fast rpc là gì có khi nào oan không tôi thấy khá nhiều người chấm liêm chính cái này"
3.  **Refine Description**: Update `describeExamEvent` in `src/lib/integrity.ts` to explicitly state that `autosave_rate` is a non-penalizing technical log.

## Verification Plan
- Check the rendered UI in the preview.
- Verify that the "integrity" logic still correctly assigns 0 weight to autosave rate events.
