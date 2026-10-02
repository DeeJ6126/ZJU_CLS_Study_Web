# Minimal Professional Site Theme

## Scope

Merge `origin/activity` and `origin/about` into main before changing presentation. Apply the accepted `design-previews/minimal-professional-pages.html` language to every rendered site page, including admin and rich content. Preserve user data, permissions, hash routes, quiz rules/shortcuts, and the existing animated ThemeSwitch component and stylesheet. The homepage student-homepage directory stays removed as requested; its backend/admin workflow remains available.

## Shared System

- Light: ground `#F5F8F9`, white surface, ink `#213139`, muted `#586971`, line `#D7E3E6`, teal `#14768A`, selected `#E8F3F5`.
- Dark: neutral charcoal ground `#171C1E`, surface `#22292C`, ink `#F1F5F6`, muted `#A6BCC3`, line `#394B51`, teal `#84CBDA`.
- Outfit plus Chinese local fallbacks for headings/body; Space Grotesk plus code fallbacks for codes. Bundle licensed fonts locally.
- Small 2-4px corners, no pills except unchanged theme toggle; no decorative gradients, oversized page headings or nested panel cards.
- Semantic positive/negative/warning colors remain distinct. Author-authored UBB formatting and chromatic colors are preserved; neutral text follows the theme.

## Ownership And Verification

- Root: merge/integration, theme tokens/fonts, homepage/overview/course-picker surfaces, project docs, full checks, desktop browser coverage and release.
- Quiz worker: quiz display components, app scoped quiz styles and global shell/quiz stylesheet; no business changes.
- Content worker: course/detail/contribution and shared Markdown/UBB typography; no stored body edits.
- Secondary worker: activities/about/profile/auth/admin/notices/consultation and their styles; no route/auth changes.
- Run Node tests/build/project checks and desktop light/dark checks spanning all pages, course articles in both formats, contribution/upload, quiz practice/review, admin controls, and user workflows. No requested mobile acceptance.

## Baseline

Both merges are complete. The about merge's import conflicts were resolved by keeping AboutPage alongside NoticePage and ConsultationPage. Merged baseline initially had one obsolete assertion expecting an empty seeded activity list; update it to assert the branch's real published article catalog and administrator publishing behavior. All untracked design previews remain local and are not included in release commits.
