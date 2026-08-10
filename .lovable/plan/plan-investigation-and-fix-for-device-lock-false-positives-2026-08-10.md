# Plan - Investigation and fix for "Device Lock False Positives"

The user reports that some users are incorrectly blocked by the device reuse protection ("Thiết bị này vừa được ... sử dụng để dự thi"). This mechanism is intended to prevent people from passing their phone/computer to someone else to take the exam for them.

## Analysis
1.  **Mechanism**: The protection uses a `p_device_id` (UUID in `localStorage`) and a `fingerprint` (Canvas/WebGL signature).
2.  **Identified Cause**: Database queries show that several fingerprints are shared by 2-4 different employees. This happens when they use identical hardware (e.g., same model of corporate phone or laptop) with the same browser version.
3.  **Strict Logic**: The `claim_exam_device` function currently treats a fingerprint match as a "same device" even if the `device_id` is different. This is intended to catch incognito mode/cache clearing, but it's causing false positives for users with identical hardware.

## Proposed Steps

### 1. Database Fix
*   Modify `claim_exam_device` SQL function:
    *   Relax the fingerprint-only matching logic. Instead of automatically blocking, we should only block if BOTH `device_id` matches OR if the `fingerprint` match is very recent AND we have high confidence.
    *   Better: Use fingerprint only as a "secondary signal" or completely remove fingerprint-based *blocking* if it's too noisy, keeping it for logging only.
    *   Decision: We will keep fingerprint matching but add a check to see if that fingerprint has been seen by *many* users recently, which indicates a generic device type. If it's a generic fingerprint, we rely solely on `device_id`.

### 2. UI/Text Fix
*   Update `src/lib/deviceLock.ts` with the new descriptive Vietnamese message as requested.

### 3. Verification
*   Verify the SQL function logic.
*   Verify the UI message via unit tests.

