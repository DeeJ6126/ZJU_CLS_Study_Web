import { navigationItems } from './data/navigation.js';
import { renderSidebar } from './components/sidebar.js';
import './styles/base.css';
import './styles/layout.css';
import './styles/sidebar.css';
import './styles/home.css';

function renderSection(item) {
  const childSummary = item.children?.length
    ? `<p class="section-card__meta">${item.children.map((child) => child.label).join(' / ')}</p>`
    : '';

  return `
    <section class="section-card" id="${item.id}">
      <span class="section-card__kicker">${item.kicker}</span>
      <h2>${item.label}</h2>
      <p>${item.description}</p>
      ${childSummary}
    </section>
  `;
}

function renderApp() {
  const sections = navigationItems.map(renderSection).join('');

  document.querySelector('#app').innerHTML = `
    <div class="site-shell" id="top">
      ${renderSidebar(navigationItems)}
      <main class="main-content">
        <header class="topbar">
          <button class="sidebar-toggle" type="button" aria-label="打开或收起侧边栏">
            <span></span>
            <span></span>
            <span></span>
          </button>
          <div class="topbar__identity">
            <span>生命科学学子学习平台</span>
            <strong>初版导航结构</strong>
          </div>
        </header>

        <div class="intro-panel">
          <p class="intro-panel__eyebrow">Life Science Learning Platform</p>
          <h1>把课程资源、朋辈支持和实验室机会放在同一个清晰入口。</h1>
          <p>
            当前版本先完成侧边栏与信息架构。右侧区域保留为后续资源卡片、活动投稿、
            实验室开放日和榜单展示的内容容器。
          </p>
        </div>

        <div class="section-grid" aria-label="栏目预览">
          ${sections}
        </div>
      </main>
    </div>
  `;
}

function bindSidebarInteractions() {
  const shell = document.querySelector('.site-shell');
  const toggle = document.querySelector('.sidebar-toggle');
  const links = document.querySelectorAll('.nav-item, .nav-sublist__link');

  toggle?.addEventListener('click', () => {
    shell.classList.toggle('is-sidebar-open');
  });

  links.forEach((link) => {
    link.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('is-active'));
      link.closest('.nav-list__item')?.querySelector('.nav-item')?.classList.add('is-active');
      shell.classList.remove('is-sidebar-open');
    });
  });
}

renderApp();
bindSidebarInteractions();
