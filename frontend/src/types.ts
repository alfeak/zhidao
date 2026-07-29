/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  createdAt: string;
}

export interface MarkdownBlock {
  id: string;
  index: number;
  content: string;
  pageIndex?: number;
  bbox?: [number, number, number, number];
  type?: string;
}

export interface PdfBoundingBox {
  id: string;
  blockIndex: number;
  pageIndex: number;
  pageWidth: number;
  pageHeight: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  type: string;
}

export interface Paper {
  id: string;
  title: string;
  url: string;
  isDecoded: boolean;
  decodeStatus: 'idle' | 'pending' | 'processing' | 'done' | 'failed';
  decodeError?: string;
  mdBlocks?: MarkdownBlock[];
  importedAt: string;
  translations?: Array<{ targetLanguage: string; archivePath: string }>;
  translationJob?: {
    targetLanguage: string;
    status: 'pending' | 'processing' | 'done' | 'failed';
    error?: string | null;
    createdAt: string;
    updatedAt: string;
  };
}

export interface TranslationLanguage {
  code: string;
  name: string;
}

export interface PaperSearchResult {
  paperId: string;
  title: string;
  sources: Array<{ source: 'paper' | 'pdf' | 'markdown' | 'translate'; language?: string | null }>;
}

export interface ChatMessage {
  id: string;
  paperId: string;
  role: 'user' | 'model';
  content: string;
  createdAt: string;
}

export interface HighlightRemark {
  id: string;
  paperId: string;
  blockIndex: number; // Canonical source Markdown block index, shared by translations.
  comment: string;
  color: string; // CSS color or Tailwind class
  createdAt: string;
}

export interface CustomModel {
  id: string;
  name: string;
  apiKey: string;
  baseUrl?: string;
  isPrimary: boolean;
}

export interface SystemConfig {
  models: CustomModel[];
}

