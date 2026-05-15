function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderSubItems(children = []) {
  if (!children.length) {
    return '';
  }

  const items = children
    .map(
      (item) => `
        <li class="nav-sublist__item">
          <a class="nav-sublist__link" href="${escapeHtml(item.href)}">
            <span class="nav-sublist__mark" aria-hidden="true"></span>
            <span>${escapeHtml(item.label)}</span>
          </a>
        </li>
      `,
    )
    .join('');

  return `<ul class="nav-sublist" aria-label="最美活动子导航">${items}</ul>`;
}

function renderNavItem(item, index) {
  const isActive = index === 0;
  const hasChildren = Boolean(item.children?.length);

  return `
    <li class="nav-list__item ${hasChildren ? 'nav-list__item--group' : ''}">
      <a
        class="nav-item ${isActive ? 'is-active' : ''}"
        href="${escapeHtml(item.href)}"
        ${hasChildren ? 'aria-expanded="true"' : ''}
      >
        <span class="nav-item__symbol" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
        <span class="nav-item__copy">
          <span class="nav-item__label">${escapeHtml(item.label)}</span>
          <span class="nav-item__meta">${escapeHtml(item.kicker)}</span>
        </span>
      </a>
      ${renderSubItems(item.children)}
    </li>
  `;
}

export function renderSidebar(items) {
  const navItems = items.map(renderNavItem).join('');

  return `
    <aside class="app-sidebar" aria-label="学习平台主导航">
      <div class="brand-panel">
        <a class="brand" href="#top" aria-label="返回学习平台首页">
          <span class="brand__seal" aria-hidden="true">
            <span class="brand__helix"></span>
          </span>
          <span class="brand__copy">
            <span class="brand__eyebrow">生命科学学院</span>
            <span class="brand__name">生科智学</span>
          </span>
        </a>
        <p class="brand__note">面向生命科学学子的学习与成长平台</p>
      </div>

      <nav class="sidebar-nav">
        <ul class="nav-list">${navItems}</ul>
      </nav>

      <div class="sidebar-footer" aria-label="平台维护信息">
        <span class="sidebar-footer__title">Academic Department</span>
        <span class="sidebar-footer__text">学习资源持续整理中</span>
      </div>
    </aside>
  `;
}
