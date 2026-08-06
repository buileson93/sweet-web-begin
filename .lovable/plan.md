# Plan: Optimize Unit and Participant Statistics using SQL Aggregation

The user wants a smarter way to display statistics without just increasing the query limits (currently set to 50k-100k rows in server functions), which could lead to performance issues as data grows. The best approach is to move the aggregation logic to the database using SQL queries (`GROUP BY`) or Remote Procedure Calls (RPCs).

## Proposed Changes

### 1. Database Layer (Supabase/PostgreSQL)
- Create a PostgreSQL function `get_unit_statistics(quiz_uuid uuid)` to aggregate data server-side.
- This function will:
  - Join `candidate_quiz_stats` and `results` (if needed, or just aggregate one source if possible).
  - Use `GROUP BY unit` to calculate `attempts`, `unique_candidates`, `avg_score`, and `pass_rate`.
  - Return a set of rows matching the `UnitStatRow` structure.

### 2. Server Functions (TanStack Start)
- Refactor `src/lib/unitStats.functions.ts`:
  - Replace manual loops and high-limit queries with a single call to the new `get_unit_statistics` RPC.
- Refactor `src/lib/adminStats.functions.ts`:
  - Optimize `getDetailedParticipation` to handle pagination properly if the list is extremely long, rather than just bumping the limit.
  - Or, if summary stats are needed, use a dedicated aggregation RPC for the "Reminder Manager" overview.

### 3. Benefits
- **Performance**: Significant reduction in data transferred from DB to Server (only aggregated rows, e.g., ~50-100 units instead of 100,000 results).
- **Scalability**: Works efficiently even with millions of records.
- **Accuracy**: Database-level aggregation is the most reliable "source of truth".

## Implementation Steps

1. **SQL Migration**: Write the `get_unit_statistics` function.
2. **Refactor `unitStats.functions.ts`**: Update `getUnitStats` to use `.rpc('get_unit_statistics', { quiz_uuid: ... })`.
3. **Refactor `adminStats.functions.ts`**: Implement similar logic for participant summary if applicable, or keep pagination for the detailed list.
4. **Verification**: Confirm the UI in Admin Panel shows correct, fast-loading data.
