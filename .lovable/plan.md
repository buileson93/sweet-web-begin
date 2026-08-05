# Plan: Sychronize and Verify Participation Counts in Quiz List

The user is asking if the participation counts in the "Danh sách cuộc thi" (Quiz List) have been synchronized, as they previously noticed discrepancies. I will verify the synchronization logic in the home page and the leaderboard, and ensure that the "Danh sách cuộc thi" section specifically displays accurate, deduplicated participant counts based on the server-side source of truth (`candidate_quiz_stats` and `exam_sessions`).

## User Requirements
- Ensure "Danh sách cuộc thi" (Quiz List) on the Home page displays accurate, synchronized participation data.
- Participation data must include unique submitted participants (deduplicated).
- Align with previous fixes that unified statistics across the app.

## Proposed Changes

### 1. Home Page (`src/routes/index.tsx`)
- Review the "Danh sách cuộc thi" section (around line 390+).
- Ensure each quiz card displays the correct participant count using the optimized `getPublicParticipationRates` or a similar server-side function.
- Currently, `quizStatsQuery` (lines 142-169) fetches counts directly from `exam_sessions` and `results` on the client side with `.select(..., { count: "exact" })`. While this works for counts, it might be better to unify it with the server-side stats logic used elsewhere to ensure perfect parity.
- Update `quizStatsQuery` to use a server-side function if discrepancies persist, or ensure its criteria strictly match the "submitted/grading" definition of a participant.

### 2. Synchronization Verification
- Check if `getPublicParticipationRates` in `src/lib/participationRate.functions.ts` is actually being used in the quiz cards.
- If not, integrate it to provide the `done` (unique submitted) count.

## Verification Plan
- Inspect the "Danh sách cuộc thi" section in the preview.
- Compare counts with the Leaderboard and Admin stats for a specific quiz (e.g., "Luật Hàng không dân dụng Việt Nam").
- Use Playwright to verify the numbers rendered on the screen match the server-side expected values.
