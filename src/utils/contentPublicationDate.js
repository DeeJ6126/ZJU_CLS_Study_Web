export function formatContentPublicationDate(item) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(item?.sourcePublishedDate ?? '')) return item.sourcePublishedDate;
  const date = new Date(item?.createdAt ?? '');
  if (!Number.isFinite(date.getTime())) return '未注明';
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
