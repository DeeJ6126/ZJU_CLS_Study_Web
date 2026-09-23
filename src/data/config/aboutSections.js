/**
 * 「关于」页的栏目定义。
 *
 * 新增栏目时在这里加一项，并在 `public/content/about/` 放对应的正文片段即可，
 * 组件本身不用改动。数组顺序就是边栏顺序，第一项是默认栏目。
 *
 * `contentUrl` 以 `public/` 为根，写相对路径，不要以 `/` 开头，
 * 这样部署到子路径（如 `/zjubio/`）时仍然可用。
 */
export const aboutSections = [
  {
    id: 'about-us',
    label: '关于我们',
    kicker: 'About Us',
    contentUrl: 'content/about/about-us.html',
  },
  {
    id: 'about-site',
    label: '关于网站',
    kicker: 'About the Site',
    contentUrl: 'content/about/about-site.html',
  },
  {
    id: 'thanks',
    label: '致谢',
    kicker: 'Thanks',
    contentUrl: 'content/about/thanks.html',
  },
];

export const defaultAboutSectionId = aboutSections[0].id;
