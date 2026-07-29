import { useCallback, useEffect, useState } from 'react';
import { Paper } from '../types';

const unfinished = (paper: Paper) =>
  ['pending', 'processing'].includes(paper.decodeStatus) ||
  ['pending', 'processing'].includes(paper.translationJob?.status || '');

export function usePaperWorkspace() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [activePaper, setActivePaper] = useState<Paper | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch('/api/papers');
    if (!response.ok) throw new Error(`Server returned ${response.status}`);
    const next = await response.json() as Paper[];
    setPapers(next);
    setActivePaper((current) => current ? next.find((paper) => paper.id === current.id) || null : next[0] || null);
  }, []);

  useEffect(() => { void refresh().catch((error) => console.error('Error fetching papers:', error)); }, [refresh]);

  useEffect(() => {
    if (!papers.some(unfinished)) return;
    const interval = window.setInterval(() => { void refresh().catch((error) => console.error('Error refreshing papers:', error)); }, 3000);
    return () => window.clearInterval(interval);
  }, [papers, refresh]);

  const deletePaper = useCallback(async (id: string) => {
    const response = await fetch(`/api/papers/${id}`, { method: 'DELETE' });
    if (response.ok) await refresh();
  }, [refresh]);

  const retryDecode = useCallback(async (id: string) => {
    const response = await fetch(`/api/papers/${id}/decode`, { method: 'POST' });
    if (response.ok) await refresh();
  }, [refresh]);

  const startTranslation = useCallback(async (targetLanguage: string) => {
    if (!activePaper) return;
    const response = await fetch(`/api/papers/${activePaper.id}/translations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetLanguage }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Translation failed');
    setPapers((current) => current.map((paper) => paper.id === activePaper.id ? { ...paper, translationJob: data.translationJob } : paper));
    setActivePaper((current) => current?.id === activePaper.id ? { ...current, translationJob: data.translationJob } : current);
  }, [activePaper]);

  return { papers, activePaper, setActivePaper, refresh, deletePaper, retryDecode, startTranslation };
}
