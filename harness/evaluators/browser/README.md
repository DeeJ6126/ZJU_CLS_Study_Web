# Browser Evaluators

Browser evaluators use Playwright to verify real UI flows:

- Home app loads.
- Resources page opens.
- A course detail route works.
- The contribution modal opens and exposes required fields.
- Theme switching remains usable.

Run with:

```bash
npm.cmd run harness:browser
```

If browsers are missing, run:

```bash
npx playwright install chromium
```
