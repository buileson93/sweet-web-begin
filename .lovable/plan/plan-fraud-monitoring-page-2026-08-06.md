# Plan - Fraud Monitoring Page

The objective is to implement a new admin monitoring page to identify and investigate potential fraud in exams. This involves tracking devices, fingerprints, and flagging suspicious attempts based on risk levels.

## User Requirements
- Create an admin page that shows flagged exam attempts.
- Group attempts by device and risk level.
- Features:
  1. Detailed logs (timestamped) for each fingerprint.
  2. Export reports for organizers.
  3. Anti-cheating scripts (already partially implemented, but need to be surfaced and integrated into this view).

## Proposed Implementation

### 1. Database & Backend (Lovable Cloud / Supabase)
- Create a new table/view or RPC to aggregate fraud signals.
- Fraud signals already exist in:
    - `exam_sessions.integrity_score`: Lower than 100 indicates issues.
    - `exam_events`: Records specific violations (tab switch, devtools, etc.).
    - `device_visits`: IP, device info.
    - `fingerprint` column in `device_locks` (recently added).
- I will create a dedicated RPC `get_fraud_report` to efficiently fetch and group these sessions.

### 2. Server Functions (`src/lib/fraud.functions.ts` & `src/lib/fraud.server.ts`)
- `getFraudReport`: Server function to fetch the aggregated fraud data.
- `getFingerprintLogs`: Server function to fetch detailed history for a specific device/fingerprint.

### 3. Admin UI Component (`src/components/admin/FraudMonitor.tsx`)
- A new section in the Admin Dashboard.
- **Summary Cards**: Total flagged attempts, High-risk devices, Most active fingerprints.
- **Risk Groups**: Tabbed or accordion view grouping by Risk Level (High, Medium, Low).
- **Device View**: Grouping by Fingerprint to see if multiple employees share the same device.
- **Detailed Logs**: Modal or drill-down view showing `exam_events` for a specific attempt.
- **Export**: PDF/Excel export of flagged attempts for organizers.

### 4. Integration into Admin Dashboard
- Update `src/routes/_authenticated/quan-tri.tsx` to include the "Gian lận & Bảo mật" (Fraud & Security) section.
- Use a `ShieldAlert` or `Fingerprint` icon for navigation.

## Design Decisions
- **Risk Calculation**: 
    - **High**: Integrity < 30 OR multiple employee IDs on one fingerprint.
    - **Medium**: Integrity < 70 OR multiple IP addresses for one session.
    - **Low**: Integrity < 90 OR single minor violation event.
- **Fingerprint Focus**: Since browsers can have different Fingerprints but the same IP (NAT), or vice versa (VPN/Proxy), the Fingerprint v1 (Canvas+WebGL+Hardware) will be the primary grouping key.

## Verification Plan
- **Mock Data**: Create a migration to seed some "suspicious" sessions if none exist.
- **Manual Check**: Navigate to `/quan-tri?muc=fraud` and verify the data displays correctly.
- **Functionality Check**: Verify the "Chi tiết" (Detail) view shows the correct timeline of events.
- **Export Check**: Ensure the Excel export contains the relevant fraud metrics.
