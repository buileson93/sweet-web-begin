# Plan - Fix Leaderboard Attempt Counting Logic

The user reported that the attempt count for "Nguyễn Thị Ngọc Mai" (Đài KSKL Chu Lai) and others is incorrect (showing 25 while database shows 621 total sessions and 296 submitted). This indicates a discrepancy between the source of truth in the database and the calculation logic in the server function or client-side ranking.

## Objectives
- Ensure "attempts" on the leaderboard reflects the true number of sessions (submitted + in-progress) from `exam_sessions`.
- Remove limits that might be truncating session counts for high-activity candidates.
- Verify why the server-side `attemptMap` might be undercounting.

## Proposed Changes

### 1. Server-Side Function (`src/lib/leaderboard.functions.ts`)
- Increase the limit for `sessionsQuery` or use a more efficient aggregation query.
- Currently it fetches all rows (`limit(50000)`) and builds a Map. This is memory-intensive and might still hit limits if the total session count grows.
- **Optimization**: Use a SQL aggregation to get counts per employee directly if possible, or ensure the fetching logic handles all relevant data.
- **Verification**: Check if `employee_id` is consistently used. The current code falls back to `name|unit` which might be causing mismatches if candidates use different names/units or if `employee_id` is missing in some records.

### 2. Leaderboard Logic (`src/lib/leaderboard.ts`)
- Ensure `rankUniqueResults` correctly prioritizes the `attempts` count provided by the server over any client-side recalculation.

### 3. Database Integrity Check
- Run a query to see if there are sessions without `employee_id` that should belong to these users.

## Execution Plan
1. **Refactor `getRankableResults`** to perform an aggregation query for attempts instead of fetching 50k rows. This is much more reliable.
2. **Update `rankUniqueResults`** to ensure it doesn't accidentally overwrite the server-provided count.
3. **Verify** by checking the output for the specific candidates mentioned.

## Verification Plan
- Use `supabase--read_query` to verify the new server-side logic returns the expected counts for the mentioned candidates.
- Check the preview UI to ensure the "25 lượt thi" has updated to a higher, correct number.
