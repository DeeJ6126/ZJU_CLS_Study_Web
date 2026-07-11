# Quiz Course Configuration

Quiz course navigation and capability switches live in:

```txt
src/data/quizCourseConfigs.js
```

## Current Courses

- `BIO2023M`: molecular biology review. Pages: `首页 / 题型选择 / 练习 / 错题本 / 复习 / 生词本 / 结果`.
- `BIO2019F`: botany slice identification. Pages: `首页 / 分类 / 练习 / 图库 / 错题本 / 结果`.
- `BIO2110F`: microbiology final review. Pages: `首页 / 章节 / 真题 / 练习 / 错题本 / 生词本 / 结果`.

## What Belongs Here

- `courseCode`
- `collectionSlug`
- left navigation labels and page ids
- feature flags such as `supportsVocabulary`, `supportsReview`, `supportsPastExams`, and `supportsGallery`
- display labels for question types and practice range units

## What Does Not Belong Here

- Question text
- Answers
- Image paths for individual questions
- Auth or permission logic
- Route parsing for resource pages

## Adding A Course

1. Add static question source files under `public/resource/quiz/<COURSE_CODE>/<collection-slug>/`.
2. Add backend import support if the source format is new.
3. Add the course config here.
4. Build the course-specific non-practice pages.
5. Reuse `QuizCourseShell.vue` and `QuizPracticeLayout.vue` for practice.
6. Add tests for config, range selection, import, and any course-specific local state.

