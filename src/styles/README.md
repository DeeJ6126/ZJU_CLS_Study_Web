# src/styles

Plain CSS for layout, components, themes, and resource pages.

## Rules

- No UI framework.
- Reuse existing theme tokens before adding new colors.
- Keep operational pages dense and readable.
- Avoid making layout depend on content length.
- Check mobile and desktop behavior for new UI.

## Theme Files

Theme tokens are checked by:

```bash
npm.cmd run harness:themes
```

## Checks

```bash
npm.cmd run build
npm.cmd run harness:themes
```
