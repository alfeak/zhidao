/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MarkdownBlock {
  id: string;
  index: number;
  content: string;
  pageIndex?: number;
  bbox?: string; // Coordinates or position text representation
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
  blockId: string; // Refers to MarkdownBlock.id
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

