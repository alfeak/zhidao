/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Link2, Sparkles, Loader2 } from 'lucide-react';

interface ImportModuleProps {
  onImportSuccess: () => void;
}

export default function ImportModule({ onImportSuccess }: ImportModuleProps) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/papers/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url.trim(),
          title: title.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || '导入失败');
      }

      setUrl('');
      setTitle('');
      onImportSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || '网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-4 border-b border-gray-200 dark:border-slate-800 font-sans transition-colors duration-300">
      <form onSubmit={handleImport} className="space-y-2">
        <input
          type="text"
          placeholder="论文标题 (可选，留空则自动提取)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={loading}
          className="w-full text-xs px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded focus:ring-1 focus:ring-black dark:focus:ring-white outline-none transition-all text-gray-800 dark:text-slate-100"
        />
        <div className="flex gap-1.5">
          <input
            type="url"
            required
            placeholder="输入 PDF 在线链接 (http://...)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            className="flex-1 text-xs px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded focus:ring-1 focus:ring-black dark:focus:ring-white outline-none transition-all text-gray-800 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="px-3 py-1.5 bg-black dark:bg-slate-100 dark:text-slate-900 hover:bg-gray-800 dark:hover:bg-slate-200 disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:text-gray-400 dark:disabled:text-slate-600 text-white font-medium text-xs rounded transition-all flex items-center gap-1 shrink-0 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>导入</span>
              </>
            )}
          </button>
        </div>
      </form>

      {error && (
        <p className="mt-2 text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 p-2 rounded border border-rose-100 dark:border-rose-900/30">
          {error}
        </p>
      )}
    </div>
  );
}
