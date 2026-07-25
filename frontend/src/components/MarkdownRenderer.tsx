import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import 'katex/dist/katex.min.css';

interface MarkdownRendererProps {
  content: string;
  paperId?: string;
}

function resolveImageSource(source: string | undefined, paperId?: string) {
  if (!source || !paperId || /^(?:https?:|data:|blob:|#)/i.test(source)) return source;
  const assetPath = source.replace(/^\.\//, '').split('/').map(encodeURIComponent).join('/');
  return `/api/papers/${encodeURIComponent(paperId)}/assets/${assetPath}`;
}

export default function MarkdownRenderer({ content, paperId }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeKatex]}
      components={{
        table: ({ children }) => <div className="my-4 w-full overflow-x-auto"><table>{children}</table></div>,
        img: ({ src, alt, ...props }) => (
          <img {...props} src={resolveImageSource(src, paperId)} alt={alt || ''} loading="lazy" className="my-4 h-auto max-w-full rounded border border-slate-200 dark:border-slate-700" />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}