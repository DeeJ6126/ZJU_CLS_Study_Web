# Guest Data Merge Backup

This branch preserves the unfinished fourth feature requested on 2026-09-30.
It is based on the completed main version of features 1-3.

Implemented here:
- A preview of missing local course/content favorites and quiz records.
- Preference merging that retains existing account major/cohort values.
- Explicit merge operations and a browser-local confirmation marker.
- App state and preparation/confirmation handlers.
- A bounded list of anonymous quiz sessions for later claiming.
- Focused service tests.

Still required before use:
- A review/confirmation dialog and a deliberate login trigger.
- Cancellation, partial-failure and repeat-login browser verification.
- Validation of the complete authenticated flow before deployment.

The preparation and confirmation handlers are not invoked by the UI in this backup.
Main contains no new guest-merge controller or service from this feature.
