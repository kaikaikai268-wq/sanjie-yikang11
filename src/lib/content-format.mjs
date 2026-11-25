const TYPE_LABELS = { guide: '生活指南', ingredient: '成分看懂', question: '常見疑問', research: '研究新知' };
export const contentTypeLabel = (type) => TYPE_LABELS[type] ?? '健康文章';

export function displayDate(date) {
  return date ? new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date) : '';
}

export function readingMinutes(body) {
  return Math.max(1, Math.ceil((body ?? '').replace(/\s/g, '').length / 400));
}
