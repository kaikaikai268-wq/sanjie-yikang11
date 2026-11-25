import { z } from 'zod';
import { isSafeLocalImage, parseTaipeiDate } from './lib/content-core.mjs';

export const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, '網址只能使用小寫英數與單一連字號');
const text = z.string().trim().min(1);
const httpUrl = z.url().refine((value) => /^https?:\/\//i.test(value), '來源只接受 http/https 網址');
const date = z.preprocess((value) => parseTaipeiDate(value), z.date());
const localImage = z.string().refine(isSafeLocalImage, '圖片須放在 public/content、images 或 covers，使用站內絕對路徑');
export const articleSchema = z.object({
  title: text,
  description: text,
  slug: slugSchema.optional(),
  publishDate: date.optional(),
  updatedDate: date.optional(),
  category: text.refine((value) => !/[\\/%?#\u0000-\u001f\u007f]/.test(value) && value !== '.' && value !== '..', '分類必須是安全的單一路徑名稱').default('健康生活'),
  contentType: z.enum(['guide', 'ingredient', 'question', 'research']).default('guide'),
  author: slugSchema.default('3j-editorial'),
  status: z.enum(['draft', 'review', 'scheduled', 'published', 'archived']).default('draft'),
  draft: z.boolean().default(false),
  tags: z.array(text.refine((value) => !value.includes('/'), '標籤不能包含斜線')).default([]),
  topics: z.array(slugSchema).default([]),
  relatedArticles: z.array(slugSchema).default([]),
  relatedProducts: z.array(slugSchema).default([]),
  coverImage: localImage.optional(),
  coverAlt: text.optional(),
  coverCredit: text.optional(),
  highlights: z.array(text).default([]),
  references: z.array(z.object({ title: text, url: httpUrl, publisher: text.optional(), note: text.optional() }).strict()).default([]),
  faq: z.array(z.object({ question: text, answer: text }).strict()).default([]),
  disclosure: text.optional(),
  featured: z.boolean().default(false),
  writerJobId: z.string().trim().min(1).max(160).optional(),
}).strict().superRefine((data, ctx) => {
  if (['published', 'scheduled'].includes(data.status) && !data.publishDate)
    ctx.addIssue({ code: 'custom', path: ['publishDate'], message: '發布或排程必須設定台北時間的日期' });
  if (data.coverImage && !data.coverAlt)
    ctx.addIssue({ code: 'custom', path: ['coverAlt'], message: '封面圖片必須有替代文字' });
  if (data.updatedDate && data.publishDate && data.updatedDate < data.publishDate)
    ctx.addIssue({ code: 'custom', path: ['updatedDate'], message: '更新日期不能早於發布日期' });
});

export const authorSchema = z.object({
  name: text,
  bioShort: text,
  bio: text.optional(),
  isOrganization: z.boolean().default(false),
  credentials: z.array(text).default([]),
  specialties: z.array(text).default([]),
  sameAs: z.array(httpUrl).default([]),
  avatar: localImage.optional(),
}).strict();

export const topicSchema = z.object({
  title: text,
  description: text,
  articles: z.array(slugSchema).default([]),
  sections: z.array(z.object({ title: text, summary: z.string().default(''), articles: z.array(slugSchema).min(1) }).strict()).default([]),
  status: z.enum(['active', 'inactive']).default('active'),
  coverImage: localImage.optional(),
  coverAlt: text.optional(),
}).strict();

export const writerEnvelopeSchema = z.object({
  schemaVersion: z.literal(1),
  jobId: z.string().trim().min(1).max(160),
  article: articleSchema,
  body: text,
}).strict();
