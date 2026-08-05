# Plan: Optimize Stats Aggregation and UI Enhancements

The user is asking to update the leaderboard description text (again) to reflect a more complex statement about the optimized "Aggregation" mechanism. They also want to verify if the aggregation is working correctly for all candidates and ensure the display is correct. Additionally, they want a new "featured quiz" (cuộc thi nổi bật) feature for admins, where a specific quiz can be set as the default on the home page and leaderboard.

## User Request Refinement
1. **Visual Text Edit**: Update the `src/routes/bang-xep-hang.tsx` header text to:
   "tôi quan tâm tới sau khi cải tiến Tôi đã triển khai giải pháp tối ưu hóa đếm lượt thi thông minh theo yêu cầu của bạn. Thay vì phải truy vấn hàng chục ngàn bản ghi mỗi lần load trang, hệ thống hiện tại hoạt động theo cơ chế ghi log tổng hợp (Aggregation): đã áp dụng đúng cho tất cả thí sinh chưa và hiển thị ở bảng xếp hạng đúng chưa , admin có thêm tính năng cuộc thi nào nổi bật để mặc định mở bảng cuộc thi đó đúng nhất tại trang chủ và trang menu bảng xếp hạng"
2. **Verification**: Confirm if `candidate_quiz_stats` is correctly aggregating for all candidates.
3. **Feature**: Add a "Featured Quiz" (Cuộc thi nổi bật) toggle in the admin quiz management.
4. **Implementation**: Default to this featured quiz on the Home page and Leaderboard.

## Proposed Changes

### 1. Database Updates
- Add `is_featured` boolean column to `quizzes` table.
- Update RLS and grants.
- Seed/Set one quiz as featured if possible.

### 2. Admin UI
- Modify `src/components/admin/quizzes/QuizFormDialog.tsx` to include an "Is Featured" (Cuộc thi nổi bật) switch.
- Ensure only one quiz is "featured" at a time (server logic or DB constraint/trigger).

### 3. Frontend logic
- **Leaderboard (`src/routes/bang-xep-hang.tsx`)**:
    - Update header text.
    - Fetch the featured quiz ID and use it as the default `quizId` state instead of "all" (or keep "all" as an option but prioritize featured).
- **Home Page (`src/routes/index.tsx`)**:
    - Default the `boardQuiz` state to the featured quiz ID.

### 4. Verification of Aggregation
- Review the `sync_candidate_quiz_stats` trigger (already done, looks solid for NEW data).
- Ensure historical data was correctly synced (migration `20260805083101` attempted this for `submitted_count`, but we should check `attempt_count` too).

## Implementation Plan

1. **Database Migration**:
    - Add `is_featured` to `quizzes`.
    - Create a trigger to ensure only one quiz is featured (optional but safer).
2. **Update Admin Component**:
    - Edit `src/components/admin/quizzes/QuizFormDialog.tsx`.
3. **Update Frontend Pages**:
    - Edit `src/routes/bang-xep-hang.tsx` (text + logic).
    - Edit `src/routes/index.tsx` (logic).
4. **Final Verification**.

---
**Questions for the user**:
- Should there be only ONE featured quiz for the whole system, or one per category (if categories existed)? (Assuming one for now).
- When a quiz is "featured", should it automatically be the first one in the list too?
