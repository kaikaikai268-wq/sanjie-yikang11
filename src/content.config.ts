import { defineCollection } from 'astro:content';
import { taipeiMarkdownGlob } from './lib/content-loader.mjs';
import { articleSchema, authorSchema, topicSchema } from './content.schemas.mjs';

export const collections = {
  articles: defineCollection({ loader: taipeiMarkdownGlob({ pattern: '**/*.md', base: './src/content/articles' }), schema: articleSchema }),
  authors: defineCollection({ loader: taipeiMarkdownGlob({ pattern: '**/*.md', base: './src/content/authors' }), schema: authorSchema }),
  topics: defineCollection({ loader: taipeiMarkdownGlob({ pattern: '**/*.md', base: './src/content/topics' }), schema: topicSchema }),
};
