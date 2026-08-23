# Visual Evaluators

Visual evaluation is reserved for screenshot artifacts and later regression checks.

Initial policy:

- Store screenshots under the project check artifact directory.
- Do not enforce pixel-perfect comparisons yet.
- Use screenshots to catch layout collapse, unreadable text, theme drift, and major spacing errors.

Future upgrade:

- Add baseline screenshots for desktop and mobile resource/course-detail pages.
- Compare only stable regions to avoid brittle failures.
