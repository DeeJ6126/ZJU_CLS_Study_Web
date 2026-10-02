# Browser Evaluators

Browser evaluators use Playwright to verify real UI flows:

- Home app loads.
- Resources page opens.
- A course detail route works.
- The contribution modal opens and exposes required fields.
- Theme switching remains usable.
- Full-site desktop light/dark acceptance in `site-theme-flow`, `quiz-theme-flow` and `secondary-theme-flow`, including contrast, horizontal overflow, image/font readiness and screenshots.
- Course selection, editable My Courses, teacher suggestions, guest persistence and administrator notice publishing retain dedicated regression flows.

New visual fixtures intercept API requests. Notice integration tests use isolated HTTP handlers, in-memory SQLite and temporary files. Never point test writes at production. Screenshots and traces are generated below `project-checks/artifacts/`, not committed. The animated theme switch is tested rather than replaced.

Production account checks require a production build: development deliberately retains its local demo sandbox. Before running the full suite, build and serve the preview in another terminal on the test port (do not leave the dev server on that port):

```bash
npm.cmd run build
npx.cmd vite preview --host 127.0.0.1 --port 5174 --strictPort
```

Then run:

```bash
npm.cmd run check:browser
```

If browsers are missing, run:

```bash
npx playwright install chromium
```
