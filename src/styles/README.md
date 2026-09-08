# src/styles

Plain CSS for layout, components, themes, and resource pages.

## Rules

- No UI framework.
- Reuse existing theme tokens before adding new colors.
- Keep operational pages dense and readable.
- Avoid making layout depend on content length.
- Check mobile and desktop behavior for new UI.
- `admin.css` reuses the existing 188px left navigation, green theme tokens, dense content table, and responsive editor layout.
- `auth.css` styles the shared account popover and responsive student-ID authentication dialog.

## Theme Files

Theme tokens are checked by:

```bash
npm.cmd run check:themes
```

## Checks

```bash
npm.cmd run build
npm.cmd run check:themes
```

- `profile.css`: public profile and signed-in account/post-management layout.
