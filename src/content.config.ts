import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { articleSchema, authorSchema, topicSchema } from './content.schemas.mjs';

export const collections = {
  articles: defineCollection({ loader: glob({ pattern: '**/*.md', base: './src/content/articles' }), schema: articleSchema }),
  authors: defineCollection({ loader: glob({ pattern: '**/*.md', base: './src/content/authors' }), schema: authorSchema }),
  topics: defineCollection({ loader: glob({ pattern: '**/*.md', base: './src/content/topics' }), schema: topicSchema }),
};
