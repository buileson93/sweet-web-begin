# Plan - Investigation and fix for "Device Lock False Positives"

The user reports that some users are incorrectly blocked by the device reuse protection ("Thiết bị này vừa được ... sử dụng để dự thi"). This mechanism is intended to prevent people from passing their phone/computer to someone else to take the exam for them.

## Analysis
1.  **Mechanism**: The protection uses a `p_device_id` (derived from `getDeviceId()` which stores a UUID in `localStorage`) and a `fingerprint` (Canvas/WebGL signature).
2.  **Potential Causes for False Positives**:
    *   **Shared IPs**: If the code used IP addresses, it would be a major cause, but it uses `device_id` and `fingerprint`.
    *   **Fingerprint Collisions**: Generic hardware (e.g., identical corporate laptops or phones with same browser version) might produce identical fingerprints.
    *   **Device ID persistence**: If `localStorage` is shared (unlikely for different users on different physical devices, but possible if using a shared workstation without logging out of the OS/Browser profile).
    *   **Race Conditions**: `claim_exam_device` uses advisory locks, which is good.
    *   **Strict Fingerprint matching**: The logic `v_row.device_id IS NULL AND v_fingerprint IS NOT NULL` might be too aggressive if many users have the same fingerprint.

## Proposed Steps

### 1. Investigation
*   Examine `device_locks` table to see if multiple `employee_id`s share the same `fingerprint` or `device_id`.
*   Check if the `DEVICE_COOLDOWN_MINUTES` (currently 120 minutes / 2 hours) is too long for the specific use case where people might share a tablet in a common room (even if discouraged). The user mentions "12 minutes 19 seconds" in their example, which suggests they might have seen a shorter wait or it's a specific instance. Actually, 120 minutes is 2 hours.

### 2. Fixes & Improvements
*   **Relax Fingerprint matching**: If fingerprints are colliding too often, prioritize `device_id` and only use fingerprint as a fallback with lower confidence.
*   **Improve User Guidance**: Make the message clearer about *why* it's blocked (e.g., mention shared browser profiles).
*   **Adjust Cooldown**: Consider if 120 minutes is too strict for high-volume internal exams.

## Task: Update Text
Update the text in `src/lib/deviceLock.ts` as requested.

### Files to modify:
*   `src/lib/deviceLock.ts`: Update the message.
*   `src/lib/exam/session.server.ts`: (Optional) Adjust `DEVICE_COOLDOWN_MINUTES` if found to be the cause.

### Verification:
*   Run tests for `deviceLock.ts`.
*   Check database logs for collisions.
