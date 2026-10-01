export const noticeCategories = [
  { id: 'awards', label: '评奖评优' },
  { id: 'scholarships', label: '奖学金' },
  { id: 'aid', label: '资助助学' },
  { id: 'academic', label: '学业事务' },
  { id: 'general', label: '其他通知' },
];

export const noticeStatusLabels = { draft: '草稿', published: '已发布', archived: '已下架' };
export const noticeCategoryLabel = (id) => noticeCategories.find((item) => item.id === id)?.label ?? '其他通知';
