export const resourceRouteRoot = 'resources';

export const courseDetailTabs = [
  { id: 'overview', label: '课程总览', routePart: 'overview' },
  { id: 'experiences', label: '学习心得', routePart: 'experiences' },
  { id: 'materials', label: '复习资料', routePart: 'materials' },
  { id: 'papers', label: '历年试卷', routePart: 'papers' },
];

export const defaultCourseDetailTab = courseDetailTabs[0].id;

export const courseMaterialPaths = {
  BIO2110F: {
    root: '/resource/courses/basic/BIO2110F_microbiology-a',
    overview: '/resource/courses/basic/BIO2110F_microbiology-a/overview',
    overviewFile: '/resource/courses/basic/BIO2110F_microbiology-a/overview/index.md',
    experiences: '/resource/courses/basic/BIO2110F_microbiology-a/experiences',
    materials: '/resource/courses/basic/BIO2110F_microbiology-a/materials',
    papers: '/resource/courses/basic/BIO2110F_microbiology-a/papers',
    paperFiles: {
      midtermLu: {
        fileName: '25-26-midterm-lv.pdf',
        filePath: '/resource/courses/basic/BIO2110F_microbiology-a/papers/25-26-midterm-lv.pdf',
        url: '/resource/courses/basic/BIO2110F_microbiology-a/papers/25-26-midterm-lv.pdf',
      },
    },
  },
};

function getTabRoutePart(tabId) {
  return courseDetailTabs.find((tab) => tab.id === tabId)?.routePart ?? courseDetailTabs[0].routePart;
}

function getTabIdByRoutePart(routePart) {
  return courseDetailTabs.find((tab) => tab.routePart === routePart)?.id ?? defaultCourseDetailTab;
}

export function buildResourceRoute() {
  return `#${resourceRouteRoot}`;
}

export function buildCourseRoute(courseCode, tabId = defaultCourseDetailTab, itemId = '') {
  const tabPart = getTabRoutePart(tabId);
  const base = `#${resourceRouteRoot}/#${courseCode}`;

  if (tabId === defaultCourseDetailTab && !itemId) {
    return base;
  }

  return `${base}/#${tabPart}${itemId ? `/#${itemId}` : ''}`;
}

export function parseResourceHash(hashValue) {
  const cleanHash = decodeURIComponent(hashValue.replace(/^#/, ''));
  const parts = cleanHash.split('/#').filter(Boolean);

  if (parts[0] !== resourceRouteRoot) {
    return {
      section: parts[0] || '',
      courseCode: '',
      tabId: defaultCourseDetailTab,
      itemId: '',
    };
  }

  return {
    section: resourceRouteRoot,
    courseCode: parts[1] ?? '',
    tabId: getTabIdByRoutePart(parts[2] ?? ''),
    itemId: parts[3] ?? '',
  };
}
