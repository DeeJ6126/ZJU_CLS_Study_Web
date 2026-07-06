# src/services

Shared business logic and API clients.

## Main Files

- `authService.js`: account state labels, verification badges, and submit/comment/favorite permission rules.
- `authApiClient.js`: browser API calls for current backend auth endpoints.
- `cc98VerificationService.js`: legacy/front-end prototype CC98 code matching boundary.
- `accountStateService.js`: local auth override helpers from the earlier prototype.
- `courseOverviewService.js`: course overview field shaping.
- `favoriteService.js`: favorite keys and toggling.
- `avatarService.js`: avatar color helper.

## Auth Boundary

Permission decisions stay in `authService.js`. Components should not reimplement these rules.

## API Path Note

`authApiClient.js` currently uses relative paths such as:

```js
api/auth/me
```

This is intentional for deployment under `/zjubio/`. Do not change back to `/api/...` unless the server proxy is changed at the same time.

## Security Note

The current auth backend is useful for development and staged deployment, but it is not yet a full production security system. Do not describe frontend checks as real security boundaries.

## Checks

```bash
npm.cmd test
npm.cmd run harness:architecture
```
