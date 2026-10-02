# src/styles

Plain CSS for layout, components, themes, and resource pages.

## Rules

- No UI framework.
- Reuse existing theme tokens before adding new colors.
- Keep operational pages dense and readable.
- Avoid making layout depend on content length.
- Check mobile and desktop behavior for new UI.
- `admin.css` uses the shared neutral/teal theme tokens, left navigation, dense content table, and editor layout.
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
- `content-typography.css`: shared Markdown/UBB and HTML reader defaults. It is loaded last, and preserves authored colors, sizes and alignment.
- `base.css`: Minimal professional light/dark tokens and bundled font declarations. `theme-switch.css` preserves the original animated toggle.
