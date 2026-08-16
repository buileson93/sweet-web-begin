---
name: Verify and Ensure All Seeded Results are Visible
description: Verify the count of seeded results for "Phòng Kỹ thuật" and ensure they are correctly indexed and visible in all admin logs and statistics.
type: feature
---

## Goals
- Ensure all seeded results for "Phòng Kỹ thuật" are correctly reflected in the database.
- Verify visibility across Admin Results, Live Monitor, and Unit Statistics.
- Fix any discrepancies in pre-aggregated stats (`candidate_quiz_stats`).

## Technical Details
- **Target Quiz**: `b05b5a04-9bc2-4833-9f68-7f1c01928764`
- **Target Unit**: "Phòng Kỹ thuật"
- **Verification Steps**:
    1. Compare `public.employees` count in "Phòng Kỹ thuật" with `public.results` count for the target quiz.
    2. Re-run the aggregation sync for `candidate_quiz_stats` to ensure the "Last Updated" and total counts match the newly inserted rows.
    3. Verify that `exam_events` (if applicable) don't flag these as fraud due to the short time (30-45s), as they are administrative seeds.

## Verification
1. Run SQL to check total employee count vs result count.
2. Check `adminStats.functions.ts` output for the specific unit to confirm the visual dashboards will show the correct data.
