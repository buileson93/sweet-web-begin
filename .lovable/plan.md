# Plan - Synchronize and Fix Participation Counts

The user reports that participation counts (number of participants and those who passed/failed) are inconsistent across different UI views (Home, Leaderboard, Admin). They want the numbers to accurately reflect real-world submissions and unique participants who have submitted their work.

## Analysis
- **Home Page (`src/routes/index.tsx`)**: Uses `getQuizStatsSummary` and `getPublicParticipationRates`.
- **Leaderboard (`src/routes/bang-xep-hang.tsx`)**: Uses `getRankableResults` and filters client-side (>= 50% for ranking).
- **Admin Unit Stats (`src/components/admin/UnitStats.tsx`)**: Queries `results` table with a limit of 5000, which is likely causing truncation errors.
- **Aggregation Source**: `candidate_quiz_stats` is intended to be the source of truth, but `UnitStats` and other components might be querying raw tables or limited results.

## Proposed Changes

### 1. Unified Backend Statistics Helper
- Update `getQuizStatsSummary` in `src/lib/adminStats.functions.ts` to be more robust. Ensure it calculates unique participants based on `submitted_count > 0` in `candidate_quiz_stats`.
- Ensure it handles the "all" quiz case by properly deduplicating `employee_id`.

### 2. Synchronize UI Components
- **Home Page**: Update labels to clearly distinguish between "Total Attempts" and "Unique Participants who submitted".
- **Leaderboard**: Ensure the summary text in the header uses the exact same numbers as the Admin stats by calling the same server functions.
- **Admin Unit Stats**: Refactor to use a server-side aggregation function instead of client-side `results` query with a 5000 limit. Create `getUnitStats` server function.

### 3. Fix Logic Discrepancies
- The "submitted" count should strictly mean sessions that reached a final state (submitted/grading/disqualified), not just started.
- Ensure `candidate_quiz_stats` triggers are capturing all edge cases (like late submissions or auto-submits).

## Verification Plan
- Compare counts for a specific quiz across Home, Leaderboard (summary), and Admin Stats.
- Check the "Luật Hàng không" quiz specifically as it was mentioned in previous turns as a point of contention.
- Verify that participants with multiple attempts are counted as 1 unique person in the "Unique Participants" metric.
