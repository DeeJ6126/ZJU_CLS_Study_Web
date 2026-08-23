# Activities Management Design

## Objective

Build a complete `活动` page and let administrators manage both that page and the homepage `近期活动` feed. The existing `热门资料` area remains unchanged. All initial activity facts and images come from `纳新推文(3).docx`.

## Source Facts

The initial catalog contains six public-facing activity programs described by the academic department recruitment article:

1. `学业领航`系列讲座: frontier topics, faculty talks, international-organization internships, and research/postgraduate-study experience.
2. `实验室开放日`: visits to active laboratories and direct exposure to research directions and working environments.
3. `专业节宣讲`: life-science program introduction and major-choice support.
4. `朋辈辅学计划`: senior-student course guidance and study support.
5. `最美三件套`: `最美笔记`, `最美作息表`, and `最美书桌`, with prizes, second-classroom credit, and selected works published by the college account.
6. `寻芳拾翠，封存心语`: a joint Zhejiang University-Lanzhou University activity combining campus plant discovery, resin specimens, and postcards.

The article also describes the academic department and resource building, but these are supporting context rather than separate activities. No event date, registration deadline, or venue is invented when the source does not provide one.

## Chosen Architecture

Use an independent activity content domain instead of adding activity rows to the course-content schema. Activity records use a dedicated SQLite table and API endpoints, while the frontend has a public activity client with static JSON fallback. This preserves course-code constraints and keeps student course submissions separate from administrator-curated activities.

Each activity record has: `id`, `slug`, `title`, `category`, `summary`, `body`, `imageUrl`, `imageAlt`, `status`, `featured`, `displayOrder`, `createdBy`, `updatedBy`, `createdAt`, and `updatedAt`. Published records appear on the activity page; published featured records appear on the homepage, ordered by `displayOrder` then update time.

## Public Experience

- Replace the placeholder with `ActivityPage.vue`.
- Use a compact editorial directory rather than a landing-page hero: page heading, four source-backed thematic filters, a featured visual, and an accessible list of activity stories.
- Each record has a stable `#activities/<slug>` route. The activity page opens the selected story and exposes all facts without adding speculative schedules.
- `HomePage.vue` loads the same activity API and shows the first three featured published records under `近期活动`.
- If the backend is unavailable, both surfaces fall back to the source-backed JSON catalog. `热门资料` continues using its existing static data.

## Administrator Experience

Add `活动管理` to the existing hidden administrator page. The workspace supports search and status filters, creating and editing records, publishing, archiving, toggling homepage recommendation, setting display order, and choosing an existing activity image URL. Publishing and archive actions continue to write audit logs.

The real administrator uses authenticated backend endpoints. The demo administrator receives the same methods through the existing browser-local adapter so the complete workflow can be tested without server writes.

## Assets And Content Placement

Extract selected original images from the supplied DOCX into `public/assets/activities/`. Store the complete initial catalog in `public/content/activities/catalog.json`; Vue components do not contain article bodies. The JSON is also the idempotent seed source for the backend.

## Error Handling

- Public reads fall back to the static catalog only when the API is unavailable, not when the API returns a valid empty list.
- Administrator mutations validate title, slug, category, summary, body length, local/external image URL, status transitions, feature flag, and integer display order.
- Failed administrator requests keep the editor state and show the backend message.
- Image alt text is required whenever an image URL is present.

## Verification

- Unit tests cover validation, store CRUD, published/featured ordering, public fallback behavior, admin-client requests, and demo-admin isolation.
- Component contract tests cover activity routes, homepage dynamic activity input, admin controls, and the absence of changes to popular resources.
- Browser tests cover opening a source-backed activity and using the demo administrator to update homepage visibility.
- Run `npm.cmd test`, `npm.cmd run build`, `npm.cmd run check`, and `npm.cmd run check:browser`.
