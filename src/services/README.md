# src/services

Shared business logic and API clients.

## Main Files

- `authService.js`: account state labels, verification badges, and submit/comment/favorite permission rules.
- `authApiClient.js`: browser API calls for CC98/email registration, password login, email binding, recovery, current-user lookup, and logout.
- `cc98VerificationService.js`: legacy/front-end prototype CC98 code matching boundary.
- `accountStateService.js`: local auth override helpers from the earlier prototype.
- `courseOverviewService.js`: course overview field shaping.
- `favoriteService.js`: favorite keys and toggling.
- `avatarService.js`: avatar color helper.
- `quizApiClient.js`: browser API calls for backend quiz endpoints.
- `quizInteractionService.js`: keyboard and pending-answer rules for the lightweight quiz panel.
- `quizRangeService.js`: course-specific quiz range and practice tile helpers.
- `molecularQuizService.js`: local molecular-biology quiz helpers for language, vocabulary, mistakes, and results.
- `botanyQuizService.js`: local botany slice helpers for category selection, mistakes, gallery grouping, and results.
- `microbiologyQuizService.js`: local microbiology helpers for chapters, vocabulary, mistakes, and results.
- `quizAnswerViewService.js`: shared option state, answer display, focus, and vocabulary feedback helpers.
- `markdownAnswerService.js`: safe structured rendering helpers for markdown-like quiz answers.
- `demoNavigationService.js`: hash route helpers for the lightweight demo shell top navigation.
- `demoAccountService.js`: versioned browser-local demo profiles, account data, mutations, uploads, and moderation.
- `courseScheduleService.js`: browser-neutral timetable row normalization shared by demo XLSX import and the backend parser.
- `homeSearchService.js`: normalized homepage search indexing and per-content-type filtering.
- `searchApiClient.js`: backend cross-source search client for courses, published content, activities, and student homepages. Its former `SearchBar.vue` consumer is currently unmounted.
- `activityApiClient.js`: published activity reads with static-catalog fallback only when the API is unavailable.
- `overviewCatalogService.js`: overview filtering, category grouping, semester grouping, and unique course counts.
- `courseContentApiClient.js`: published course content with static Markdown fallback only when the API is unavailable.
- `adminApiClient.js`: administrator content CRUD, status changes, and raw PDF upload requests.
- `submissionApiClient.js`: authenticated submission creation, submission PDF upload, and anonymous like toggling.
- `accountDataApiClient.js`: private course lists, XLSX import preview, favorites, and notification read state.
- `commentApiClient.js`: identified comment/reply create, edit, delete, and public listing calls.
- `profileApiClient.js`: public profiles plus owner post, submission, avatar, and identity management.

For the quiz handoff map, read `quiz-services.md`.

## Auth Boundary

Permission decisions stay in `authService.js`. Components should not reimplement these rules.

## API Path Note

`authApiClient.js` uses relative paths such as:

```js
api/auth/me
```

This is intentional for deployment under `/zjubio/`. Do not change back to `/api/...` unless the server proxy is changed at the same time.

## Security Note

The Node backend is the authentication boundary. Components receive derived permission props and must not inspect verification fields to make security decisions. Deployment still requires HTTPS, secret management, backup, and monitoring hardening.

## Checks

```bash
npm.cmd test
npm.cmd run check:architecture
```

## Profiles

`profileApiClient.js` owns public profile search/read calls and authenticated profile,
avatar, CC98-binding, post-revision, submission edit/withdraw/resubmission/delete, and archive requests. Components
must not reproduce these endpoint or permission rules.

## Demo Accounts

The non-guest identities in `src/data/config/demoUsers.js` are complete local
sandboxes, not backend users. `demoAccountService.js` stores each identity's
courses, favorites, posts, submissions, comments, notifications, and uploaded
avatar independently under one versioned localStorage key. It also exposes an
administrator adapter for reviewing demo submissions. Real-account operations
continue through the existing API clients.

Demo activity management is shared across all demo identities through the same
browser-local sandbox. The demo administrator adapter and public activity client
read the same records, so homepage recommendations, publishing, and archiving can
be tested without backend writes.
