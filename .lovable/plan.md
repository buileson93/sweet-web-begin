# Plan: Update Anti-Cheat Text & Definitions

The user wants to clarify the meaning of `autosave_rate:too_fast` in the admin UI and code documentation, emphasizing that while it's often due to network issues, it could potentially be exploited. We will update the internal documentation/comments and specifically the descriptive label used for this event in the admin view.

## Proposed Changes

### 1. Update Integrity Library (`src/lib/integrity.ts`)
- Update the comment for `autosave_rate:` inside `scoreEvent` and `describeExamEvent` (if applicable) to match the user's requested phrasing.
- Update the descriptive logic in `describeExamEvent` to provide more context when this specific reason is encountered.

### 2. Update Admin Statistics UI (`src/components/admin/DeviceStats.tsx`)
- Although the user mentioned "language selector" in their prompt (which appears to be a placeholder or a misremembered term from a previous conversation context), I will check if there's any text "language selector" in the UI that needs replacing, or if they meant to update a specific label in the `DeviceStats` or `LiveMonitor` components where "Ngôn ngữ" (Language) is shown.
- Since "language selector" wasn't found in the code, I will interpret the request as updating the *definition* or *help text* for `autosave_rate` signals wherever they appear.

## Verification Plan

### Automated Tests
- Run `bun test src/lib/integrity.test.ts` to ensure logic remains sound.

### Manual Verification
- Check the `LiveMonitor` and `DeviceStats` components to ensure no "language selector" text exists (as it was already searched and not found, I will assume it's a prompt-specific instruction to replace *something* that might have been interpreted as a "language selector" in a previous UI mock or similar).
- If the user literally meant they want a piece of UI that says "language selector" changed to the long Vietnamese string, and it's NOT in the codebase, I will ask for clarification. However, since they gave a specific technical reason (`autosave_rate:too_fast`), I will ensure this technical reason is properly described in Vietnamese in the `describeExamEvent` function.
