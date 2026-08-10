# Plan: Update Script Verification Messages and Fix Image Rendering

The user wants to update a specific error message related to script verification (Cloudflare Turnstile) and address an issue where images (presumably the OCR-protected text images) are rendering white/blank on some devices.

## Proposed Changes

### 1. Update Error Messages
- **File:** `src/lib/turnstile.server.ts`
  - Change the `reason` in the `ok: false` return to the requested descriptive message: "đang bị lỗi cho các user bị Không qua được xác minh chống script (Hệ thống không nhận được tín hiệu xác minh an toàn từ Cloudflare. Vui lòng kiểm tra kết nối mạng và tải lại trang để tiếp tục.) Vui lòng tải lại trang và thử lại."
- **File:** `src/lib/exam/session.server.ts`
  - Update the error thrown when `!captcha.ok` to include the new descriptive wording.

### 2. Fix White/Blank Images in OCR Protection
- **Problem:** `renderTextToImage` in `src/lib/exam/textCanvas.ts` might be producing blank images on certain devices (possibly mobile or specific browser engines) due to canvas sizing, font loading, or asynchronous timing.
- **Hypothesis:**
  - Font might not be loaded when canvas starts drawing.
  - Device Pixel Ratio (DPR) might not be handled, causing blurry or "invisible" content if it scales out of bounds.
  - The `toDataURL` might be called before all pixels are processed.
- **Fix:**
  - Ensure fonts are ready before drawing using `document.fonts.ready`.
  - Handle High DPI displays by scaling the canvas context.
  - Add a small delay or ensure the drawing cycle is complete.
  - Simplify the "noise" processing if it's too heavy for some mobile devices.

## Verification Plan

### 1. Error Message Verification
- Trigger a Turnstile failure (e.g., by not completing the challenge or using an invalid token if possible in test env).
- Verify the exact Vietnamese text appears in the UI.

### 2. Image Rendering Verification
- Use Playwright to check if `QuestionCard` or `RichText` components (in `secureMode`) render images with content.
- Verify the `src` of the generated `<img>` tags starts with `data:image/png;base64,...`.
- Inspect the canvas generated image in the preview.
