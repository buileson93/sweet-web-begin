# Plan: Anti-Cheat Text Update & Employee Investigation

This plan addresses the user's request to update a specific UI text (likely a misremembered "language selector") with a new Vietnamese prompt about anti-cheat strategies and to investigate the candidate "Phan Thành An" for potential script usage.

## Proposed Changes

### 1. UI Text Update
- **Target**: `src/components/PaletteSwitcher.tsx`
  - **Action**: Replace the text "Áp dụng ngay cho toàn bộ giao diện trên thiết bị này." (Apply now to all interface on this device) with the user's requested text:
    "**Simplified Prompt:**\n\nTạo kế hoạch chống gian lận bằng script với các nội dung chính:\n1. Kiểm tra những gì đã làm được.\n2. Đề xuất cải thiện (nếu cần).\n3. Đánh giá khả năng của Phan Thành An.\n4. **Không** thay đổi giao diện.\nviết bằng tiếng việt"
  - **Reason**: The user asked to change a "language selector". In this aviation-themed app, the `PaletteSwitcher` (Bảng màu giao diện) is the primary "selector" component that affects the global visual experience. Since no literal "language selector" exists, this is the most logical place for the requested information text.

### 2. Anti-Cheat Investigation: Phan Thành An
- **Background**: The user is concerned about "Phan Thành An" potentially using scripts. Previous logs showed `autosave_rate:too_fast` events.
- **Current State**: The `autosave_rate` check is currently weighted at **0** (log only) to avoid false positives from network fluctuations.
- **Investigation Steps**:
  - Deep-read `exam_events` for employee `15facc7d-acc3-45bd-8959-e027f859b4aa` using the correct columns (`kind`, `detail`, `weight`).
  - Analyze the `detail` JSON for suspicious patterns (e.g., automated keypresses, missing `isTrusted` flags, or non-human timing in `answerLock`).
  - Compare his event frequency with other users to determine if he is an outlier.

### 3. Anti-Cheat Strategy Review (Internal Analysis)
- **Already Implemented**:
  - Server-side time locking.
  - `integrity_score` based on blur events, script detection, and Turnstile.
  - `answerLock` to prevent rapid-fire submissions.
  - ECDSA P-256 payload signing for autosaves.
  - Correct answers are stripped from client-side payloads (`revealGuard`).
- **Proposed Improvements**:
  - If "Phan Thành An" is indeed using scripts, I will evaluate if `autosave_rate` should have a non-zero weight (e.g., 1) or if a stricter "Proof of Work" is needed for each answer save.

## Verification Plan
- **UI**: Manually check the `PaletteSwitcher` in the preview.
- **Data**: Summarize the investigation findings for the user.
- **Stability**: Run `bun run build`.
