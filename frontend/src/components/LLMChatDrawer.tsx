import { useEffect, useRef, useState } from 'react';
import { Bot, Send, Trash2, User, Loader2, Sparkles } from 'lucide-react';
import { Paper, ChatMessage, User as UserType } from '../types';
import MarkdownRenderer from './MarkdownRenderer';

interface Props {
  paper: Paper | null;
  user: UserType | null;
  isOpen: boolean;
}

export default function LLMChatDrawer({ paper, user, isOpen }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const fetchChat = async () => {
    if (!paper) return;
    setFetching(true);
    try {
      const response = await fetch(`/api/papers/${paper.id}/chat`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data || []);
      }
    } catch (err) {
      console.error('Error fetching chat history:', err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (paper && isOpen) {
      void fetchChat();
    }
  }, [paper?.id, isOpen]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  if (!paper) return null;

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const tempUserId = `temp_user_${Date.now()}`;
    const tempAssistantId = `temp_asst_${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: tempUserId, paperId: paper.id, role: 'user', content: text, createdAt: new Date().toISOString() },
      { id: tempAssistantId, paperId: paper.id, role: 'assistant', content: '', createdAt: new Date().toISOString() },
    ]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch(`/api/papers/${paper.id}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      if (!response.ok || !response.body) {
        const errJson = await response.json().catch(() => ({}));
        let errMsgText = '请检查后台大模型 API Key / URL 配置。';
        if (typeof errJson.detail === 'string' && errJson.detail) errMsgText = errJson.detail;
        else if (typeof errJson.error === 'string' && errJson.error) errMsgText = errJson.error;
        else if (typeof errJson.message === 'string' && errJson.message) errMsgText = errJson.message;
        setMessages((prev) =>
          prev.map((m) => m.id === tempAssistantId ? { ...m, content: `⚠️ AI 响应失败: ${errMsgText}` } : m)
        );
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          try {
            const parsed = JSON.parse(raw) as { type: string; content?: string; message?: ChatMessage };
            if (parsed.type === 'chunk' && parsed.content) {
              setMessages((prev) =>
                prev.map((m) => m.id === tempAssistantId ? { ...m, content: m.content + parsed.content! } : m)
              );
            } else if (parsed.type === 'done' && parsed.message) {
              setMessages((prev) =>
                prev.map((m) => m.id === tempAssistantId ? parsed.message! : m)
              );
            } else if (parsed.type === 'error') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAssistantId ? { ...m, content: `⚠️ AI 响应失败: ${String(parsed.message ?? '未知错误')}` } : m
                )
              );
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      }
    } catch (err) {
      console.error('Error sending chat:', err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempAssistantId ? { ...m, content: '⚠️ 网络异常，无法连接至后端 AI 服务。' } : m
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (!paper || messages.length === 0) return;
    try {
      const response = await fetch(`/api/papers/${paper.id}/chat/clear`, { method: 'POST' });
      if (response.ok) {
        setMessages([]);
      }
    } catch (err) {
      console.error('Error clearing chat:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="flex h-full w-[380px] min-h-0 flex-col border-l border-slate-200 bg-white font-sans transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900 select-none">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">AI 论文对话助手</h3>
            <p className="text-[10px] text-slate-400">以完整 Markdown 原文为上下文</p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 dark:hover:bg-rose-500/20 transition cursor-pointer"
            title="清空对话历史"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>清空</span>
          </button>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/40">
        {fetching ? (
          <div className="flex h-full items-center justify-center py-12 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center py-12 text-slate-400 space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-500 dark:bg-cyan-500/20">
              <Bot className="h-6 w-6" />
            </div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">围绕本篇论文开启 AI 对话</p>
            <p className="text-[11px] text-slate-400 max-w-[260px] leading-relaxed">
              您可以询问文章的核心创新点、实验结论、公式推导或特定段落的深度解读。
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  msg.role === 'user'
                    ? 'bg-slate-800 text-white dark:bg-slate-700 dark:text-white shadow-xs'
                    : 'bg-cyan-600 text-white shadow-xs'
                }`}
              >
                {msg.role === 'user' ? (
                  user?.picture ? (
                    <img src={user.picture} alt="" className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    <User className="h-3.5 w-3.5" />
                  )
                ) : (
                  <Bot className="h-3.5 w-3.5" />
                )}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs shadow-xs transition-all ${
                  msg.role === 'user'
                    ? 'bg-slate-900 text-white dark:bg-slate-800 dark:text-slate-100 rounded-tr-none'
                    : 'border border-slate-200 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 rounded-tl-none'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                ) : msg.content === '' && loading ? (
                  <span className="flex items-center gap-1 text-slate-400">
                    <Loader2 className="h-3 w-3 animate-spin text-cyan-500" />
                    <span>AI 正在思考...</span>
                  </span>
                ) : (
                  <div className="markdown-body text-xs leading-relaxed">
                    <MarkdownRenderer content={msg.content} paperId={paper.id} />
                    {loading && msg.id.startsWith('temp_asst_') && (
                      <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-cyan-500 align-middle" />
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}


      </div>

      {/* Input Box */}
      <div className="border-t border-slate-200 p-3 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="relative flex items-end rounded-xl border border-slate-300 bg-slate-50 p-2 focus-within:bg-white dark:border-slate-700 dark:bg-slate-950 dark:focus-within:bg-slate-900 focus-within:border-cyan-500 dark:focus-within:border-cyan-400">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入您关于本篇论文的问题 (Enter 发送)..."
            rows={2}
            className="w-full resize-none bg-transparent px-1 py-1 text-xs outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-30 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white transition cursor-pointer"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
