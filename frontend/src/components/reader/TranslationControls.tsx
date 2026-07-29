import { Languages } from 'lucide-react';
import { Paper, TranslationLanguage } from '../../types';

interface Props { paper: Paper; language: string | null; languages: TranslationLanguage[]; loading: boolean; onLanguageChange: (code: string) => void; onTranslate: (code: string) => Promise<void>; }

export default function TranslationControls({ paper, language, languages, loading, onLanguageChange, onTranslate }: Props) {
  const running = paper.translationJob?.status === 'pending' || paper.translationJob?.status === 'processing';
  return <div className="flex flex-wrap items-center gap-2 pb-4 border-b border-gray-200 dark:border-slate-800">
    <Languages className="w-4 h-4 text-blue-500" />
    <select value={language || ''} onChange={(event) => onLanguageChange(event.target.value)} className="text-xs bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded px-2 py-1.5">
      {languages.map((item) => <option key={item.code} value={item.code}>{item.name} ({item.code})</option>)}
    </select>
    <button onClick={() => language && onTranslate(language)} disabled={!language || loading || running} className="px-3 py-1.5 text-xs font-semibold rounded bg-black dark:bg-slate-100 text-white dark:text-slate-900 disabled:bg-gray-200 dark:disabled:bg-slate-800 disabled:text-gray-400">
      {paper.translationJob?.status === 'pending' ? 'Queued' : running || loading ? 'Translating…' : 'Translate'}
    </button>
    {paper.translationJob?.status === 'failed' && <span className="text-[11px] text-rose-600">{paper.translationJob.error || 'Translation failed'}</span>}
  </div>;
}
