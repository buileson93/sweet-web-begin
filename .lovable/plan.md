# Plan - Fix Unit Statistics Sync & UI Text

The user reported that unit statistics are still incorrect (some participants are missing from the admin unit stats) and requested a specific text change to a UI element.

## Proposed Changes

### 1. Fix Database Synchronization
The `candidate_quiz_stats` table relies on triggers to aggregate data. Some historical data or edge cases (e.g., missing `employee_id` in some records) might cause discrepancies.
-   Create a comprehensive migration to re-sync `candidate_quiz_stats` from both `exam_sessions` (for attempts) and `results` (for submissions/units).
-   Ensure the trigger handles both `employee_id` and fallback identification (name + unit) if `employee_id` is missing.
-   Update `getUnitStats` server function to handle `employee_id` presence more robustly.

### 2. UI Text Update
-   Locate the "language selector" text and replace it with "thống kê theo đơn vị vẫn không đúng nhiều người đã thi nhưng trong admin thống kê trong đơn vị vẫn ko tính".
    -   *Note*: A codebase search for "language selector" returned no direct matches. I will search for labels like "Ngôn ngữ" or standard selector components to find the relevant text.

### 3. Server-side Logic Refinement
-   Refactor `getUnitStats` in `src/lib/unitStats.functions.ts` to ensure it doesn't just count records with `employee_id` but aggregates correctly by `unit` regardless of the identification method.

## Technical Details

-   **Database Migration**:
    ```sql
    -- Re-sync stats for all candidates
    INSERT INTO public.candidate_quiz_stats (quiz_id, employee_id, candidate_name, unit, attempt_count, submitted_count, last_updated_at)
    SELECT 
        quiz_id, 
        employee_id, 
        MAX(candidate_name), 
        MAX(unit), 
        COUNT(*), 
        COUNT(*) FILTER (WHERE status IN ('submitted', 'disqualified')), 
        now()
    FROM public.exam_sessions
    WHERE employee_id IS NOT NULL
    GROUP BY quiz_id, employee_id
    ON CONFLICT (quiz_id, employee_id) DO UPDATE SET
        attempt_count = EXCLUDED.attempt_count,
        submitted_count = EXCLUDED.submitted_count,
        last_updated_at = now();
    ```
-   **Frontend Update**:
    -   Search `src/components/SiteHeader.tsx` or `src/components/AppShell.tsx` for the selector to be renamed.

## Verification Plan
1.  Run the migration to sync stats.
2.  Check `candidate_quiz_stats` count vs `results` and `exam_sessions` unique participants.
3.  Verify the "Thống kê đơn vị" page in Admin reflects the updated counts.
4.  Confirm the UI text change is visible.
