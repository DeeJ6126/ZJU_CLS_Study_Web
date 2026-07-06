# server

Lightweight Node backend for the current auth prototype.

## Current Responsibilities

- CC98-code registration.
- Password hashing.
- Cookie session login/logout.
- SQLite storage in `server/data/auth.sqlite`.

## Entry Point

```bash
npm.cmd run server
```

The server listens on `127.0.0.1:5175` by default.

## Verification Codes

Seed data comes from:

```txt
src/data/config/cc98VerificationCodes.js
```

The server seeds SQLite on startup. Existing code rows are not overwritten by normal seed insertion.

## Deployment Note

The expected server project path is now:

```txt
/var/www/html/zjubio/
```

The frontend should be built with `npm run build`, and Apache should serve `dist/` while proxying API requests to the Node backend.

## Checks

```bash
npm.cmd test
npm.cmd run build
```
