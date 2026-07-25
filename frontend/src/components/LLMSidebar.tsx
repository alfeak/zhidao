/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  ClipboardList,
  Sparkles,
  Settings,
  Send,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  Plus,
  Compass,
  AlertCircle,
  Loader2,
  Check,
  Star,
  Globe,
  RefreshCw,
  Activity,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Paper, ChatMessage, HighlightRemark, SystemConfig, MarkdownBlock } from '../types';

interface LLMSidebarProps {
  paper: Paper | null;
  selectedBlock: MarkdownBlock | null;
  chatMessages: ChatMessage[];
  remarks: HighlightRemark[];
  config: SystemConfig;
  onUpdateConfig: (newConfig: Partial<SystemConfig>) => void;
  onSendMessage: (msg: string) => void;
  onClearChat: () => void;
  onDeleteRemark: (id: string) => void;
  actionResult: string | null;
  clearingAction: () => void;
  activeTab: 'chat' | 'result' | 'remarks' | 'config';
  setActiveTab: (tab: 'chat' | 'result' | 'remarks' | 'config') => void;
}

export default function LLMSidebar({
  paper,
  selectedBlock,
  chatMessages,
  remarks,
  config,
  onUpdateConfig,
  onSendMessage,
  onClearChat,
  onDeleteRemark,
  actionResult,
  clearingAction,
  activeTab,
  setActiveTab,
}: LLMSidebarProps) {
  const [inputText, setInputText] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // Form states for adding custom model
  const [newModelName, setNewModelName] = useState('');
  const [newModelApiKey, setNewModelApiKey] = useState('');
  const [newModelBaseUrl, setNewModelBaseUrl] = useState('');
  const [newModelIsPrimary, setNewModelIsPrimary] = useState(false);

  // Testing states
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});

  const [showKeys, setShowKeys] = useState(false);
  const [configSuccess, setConfigSuccess] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Jump to analysis results tab automatically when action result changes
  useEffect(() => {
    if (actionResult) {
      setActiveTab('result');
    }
  }, [actionResult]);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sendingChat || !paper) return;

    setSendingChat(true);
    setChatError(null);
    const msg = inputText.trim();
    setInputText('');

    try {
      await onSendMessage(msg);
    } catch (err: any) {
      setChatError(err.message || '发送失败，请确认 API Key 是否正确。');
    } finally {
      setSendingChat(false);
    }
  };

  const handleTestModel = async (modelId: string) => {
    setTestingId(modelId);
    setTestResults(prev => ({ ...prev, [modelId]: { success: false, message: '正在进行连接测试...' } }));
    try {
      const res = await fetch('/api/config/test-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestResults(prev => ({ ...prev, [modelId]: { success: true, message: data.message || '测试连接成功！' } }));
      } else {
        setTestResults(prev => ({ ...prev, [modelId]: { success: false, message: data.error || '测试失败' } }));
      }
    } catch (err: any) {
      setTestResults(prev => ({ ...prev, [modelId]: { success: false, message: err.message || '无法连接模型接口' } }));
    } finally {
      setTestingId(null);
    }
  };

  const handleTestNewModel = async () => {
    if (!newModelName.trim()) {
      alert('请先输入要测试的模型名称（如 gpt-4o-mini）。');
      return;
    }
    setTestingId('new_model_temp');
    setTestResults(prev => ({ ...prev, 'new_model_temp': { success: false, message: '正在进行临时连接测试...' } }));
    try {
      const res = await fetch('/api/config/test-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newModelName.trim(),
          apiKey: newModelApiKey.trim(),
          baseUrl: newModelBaseUrl.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestResults(prev => ({ ...prev, 'new_model_temp': { success: true, message: data.message || '测试连接成功！' } }));
      } else {
        setTestResults(prev => ({ ...prev, 'new_model_temp': { success: false, message: data.error || '测试失败' } }));
      }
    } catch (err: any) {
      setTestResults(prev => ({ ...prev, 'new_model_temp': { success: false, message: err.message || '网络连接失败' } }));
    } finally {
      setTestingId(null);
    }
  };

  const handleAddNewModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelName.trim()) return;

    const newId = 'model_' + Math.random().toString(36).substr(2, 9);
    const newModel = {
      id: newId,
      name: newModelName.trim(),
      apiKey: newModelApiKey.trim(),
      baseUrl: newModelBaseUrl.trim(),
      isPrimary: newModelIsPrimary || !(config.models && config.models.length > 0),
    };

    let updatedModels = Array.isArray(config.models) ? [...config.models] : [];
    if (newModel.isPrimary) {
      updatedModels = updatedModels.map(m => ({ ...m, isPrimary: false }));
    }
    updatedModels.push(newModel);

    onUpdateConfig({ models: updatedModels });
    
    // Trigger Success Toast
    setConfigSuccess(true);
    setTimeout(() => setConfigSuccess(false), 2000);

    // Reset Form
    setNewModelName('');
    setNewModelApiKey('');
    setNewModelBaseUrl('');
    setNewModelIsPrimary(false);
  };

  const handleSetPrimary = (modelId: string) => {
    const updatedModels = (config.models || []).map(m => ({
      ...m,
      isPrimary: m.id === modelId,
    }));
    onUpdateConfig({ models: updatedModels });
  };

  const handleDeleteModel = (modelId: string) => {
    const updatedModels = (config.models || []).filter(m => m.id !== modelId);
    if (config.models.find(m => m.id === modelId)?.isPrimary && updatedModels.length > 0) {
      updatedModels[0].isPrimary = true;
    }
    onUpdateConfig({ models: updatedModels });
  };

  const handleUpdateModelField = (modelId: string, field: string, value: any) => {
    const updatedModels = (config.models || []).map(m => {
      if (m.id === modelId) {
        return { ...m, [field]: value };
      }
      return m;
    });
    onUpdateConfig({ models: updatedModels });
  };

  return (
    <div className="flex-1 w-full bg-white dark:bg-slate-900 flex flex-col min-h-0 font-sans transition-colors duration-300">
      {/* Tab Body Container */}
      <div className="flex-1 min-h-0 flex flex-col bg-gray-50/30 dark:bg-slate-950/20 transition-colors duration-300">
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Paper context warning if empty */}
            {!paper ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-gray-400 text-center">
                <MessageSquare className="w-10 h-10 stroke-1 text-gray-300 mb-2" />
                <p className="text-xs">选择或导入论文后即可开启多轮学术问答</p>
              </div>
            ) : (
              <>
                {/* Chat Title header */}
                <div className="p-3 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between transition-colors duration-300">
                  <span className="text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-widest font-mono">
                    对话上下文：{paper.title.slice(0, 20)}...
                  </span>
                  <button
                    onClick={onClearChat}
                    disabled={chatMessages.length === 0}
                    className="text-[10px] text-gray-400 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 font-bold flex items-center gap-1 px-1.5 py-1 hover:bg-gray-50 dark:hover:bg-slate-800 rounded transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>清空历史</span>
                  </button>
                </div>

                {/* Messages Scroller */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {chatMessages.length === 0 && (
                    <div className="bg-white dark:bg-slate-800 p-4 rounded border border-gray-200 dark:border-slate-700 text-xs text-gray-500 dark:text-slate-400 leading-relaxed space-y-2">
                      <p className="font-bold text-gray-700 dark:text-slate-200">您可以这样向大模型提问：</p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>“这篇论文的核心论点是什么？”</li>
                        <li>“第 2 节的方法中使用的主要公式有何数学意义？”</li>
                        <li>“实验部分对比了哪些模型，结果如何？”</li>
                      </ul>
                    </div>
                  )}

                  {chatMessages.map((msg) => {
                    const isUser = msg.role === 'user';
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                      >
                        <span className="text-[9px] text-gray-400 mb-1 font-mono">
                          {isUser ? '协同用户' : `知道 AI (${config.models?.find(m => m.isPrimary)?.name || 'OpenAI-compatible model'})`}
                        </span>
                        <div
                          className={`p-3 rounded-2xl max-w-[90%] text-xs leading-relaxed ${
                            isUser
                              ? 'bg-black dark:bg-slate-100 text-white dark:text-slate-900 rounded-tr-none font-medium shadow-xs'
                              : 'bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-250 rounded-tl-none markdown-body border border-gray-200/50 dark:border-slate-700'
                          }`}
                        >
                          {isUser ? (
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          ) : (
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat Error Bar */}
                {chatError && (
                  <div className="mx-4 mb-2 p-2.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded text-[10px] text-rose-600 dark:text-rose-400 flex items-start gap-1.5 transition-colors">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <p>{chatError}</p>
                  </div>
                )}

                {/* Chat Form Footer */}
                <form onSubmit={handleSendChat} className="p-3 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 flex gap-2 shrink-0 transition-colors duration-300">
                  <input
                    type="text"
                    required
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    disabled={sendingChat}
                    placeholder="向大模型提问论文相关问题..."
                    className="flex-1 text-xs px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded focus:ring-1 focus:ring-black dark:focus:ring-white outline-none transition-all text-gray-800 dark:text-slate-100"
                  />
                  <button
                    type="submit"
                    disabled={sendingChat || !inputText.trim()}
                    className="p-2.5 bg-black dark:bg-slate-100 dark:text-slate-900 hover:bg-gray-800 dark:hover:bg-slate-200 disabled:bg-gray-100 dark:disabled:bg-slate-800 text-white disabled:text-gray-400 dark:disabled:text-slate-600 rounded transition-all flex items-center justify-center cursor-pointer shadow-sm"
                  >
                    {sendingChat ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        {activeTab === 'result' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Header with clear action */}
            <div className="p-3 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between shrink-0 transition-colors duration-300">
              <span className="text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-widest font-mono">
                高级解析结果输出栏
              </span>
              {actionResult && (
                <button
                  onClick={clearingAction}
                  className="text-[10px] text-gray-400 dark:text-slate-400 hover:text-black dark:hover:text-white font-bold px-2 py-1 hover:bg-gray-50 dark:hover:bg-slate-800 rounded transition-all cursor-pointer"
                >
                  清除面板
                </button>
              )}
            </div>

            {/* Result text area */}
            <div className="flex-1 overflow-y-auto p-5">
              {!actionResult ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-slate-500 text-center py-20 px-4">
                  <ClipboardList className="w-10 h-10 stroke-1 text-gray-300 dark:text-slate-700 mb-2" />
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-300">目前暂无正在生成的解析结果</p>
                  <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-2 max-w-xs leading-relaxed">
                    请点击主阅读区顶部的【全文翻译】、【全文解析】或【MD块解析】来生成高度结构化的解读报告。
                  </p>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 p-5 rounded border border-gray-250 dark:border-slate-800 shadow-xs markdown-body text-xs text-slate-800 dark:text-slate-100 transition-colors duration-300">
                  <ReactMarkdown>{actionResult}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'remarks' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Header */}
            <div className="p-3 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 shrink-0 transition-colors duration-300">
              <span className="text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-widest font-mono">
                全平台共享高亮备注流 ({remarks.length} 条)
              </span>
            </div>

            {/* Remarks Scroll */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {remarks.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-slate-500 text-center py-20">
                  <Compass className="w-10 h-10 stroke-1 text-gray-300 dark:text-slate-700 mb-2" />
                  <p className="text-xs">暂无标注信息</p>
                  <p className="text-[10px] text-gray-400 dark:text-slate-450 mt-1 max-w-[240px] leading-relaxed">
                    在「句读译读 (MD)」模式下，悬停或选中任意Markdown段落块，点击“快捷备注”按钮，即可留下您的见解！
                  </p>
                </div>
              ) : (
                remarks.map((rem) => (
                  <div
                    key={rem.id}
                    className="bg-white dark:bg-slate-900 p-3.5 rounded border border-gray-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-all flex flex-col gap-2 relative group"
                    style={{ borderLeftWidth: '4px', borderLeftColor: rem.color }}
                  >
                    <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-slate-500 font-mono">
                      <span>对应块段落: #{rem.blockId.split('_').pop()}</span>
                      <span>{new Date(rem.createdAt).toLocaleTimeString()}</span>
                    </div>

                    <p className="text-xs text-gray-700 dark:text-slate-300 font-sans leading-relaxed bg-gray-50/50 dark:bg-slate-950/50 p-2 rounded">
                      {rem.comment}
                    </p>

                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[9px] font-bold text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        协同讨论 • 全员可编辑
                      </span>
                      <button
                        onClick={() => onDeleteRemark(rem.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 rounded transition-opacity cursor-pointer"
                        title="删除备注"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-slate-50/50 dark:bg-slate-950/10">
            {/* Header metadata */}
            <div className="border-b border-gray-200 dark:border-slate-800 pb-3">
              <h3 className="text-xs font-bold text-gray-800 dark:text-slate-100 flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5 text-black dark:text-white" />
                <span>系统参数与多模型协作管理</span>
              </h3>
              <p className="text-[10px] text-gray-400 dark:text-slate-450 leading-relaxed mt-1">
                知道 (Zhidao) 为无账号开放协作平台。此页面配置将即时全平台广播同步、持久化并永久共享。
              </p>
            </div>

            {/* Toggle show api keys */}
            <div className="flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowKeys(!showKeys)}
                className="text-[10px] text-gray-500 dark:text-slate-400 hover:text-black dark:hover:text-white flex items-center gap-1 cursor-pointer font-medium"
              >
                {showKeys ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                <span>{showKeys ? '隐藏明文密钥' : '显示明文密钥'}</span>
              </button>
            </div>

            {/* OpenAI-compatible models */}
            <div className="space-y-3.5">
              <div className="flex items-center gap-1.5 border-b border-gray-200 dark:border-slate-800 pb-2">
                <Activity className="w-3.5 h-3.5 text-black dark:text-white" />
                <span className="text-xs font-bold text-gray-800 dark:text-slate-200">OpenAI 兼容模型列表</span>
              </div>

              {/* Models scroll */}
              <div className="space-y-3">
                {(!config.models || config.models.length === 0) ? (
                  <div className="p-4 bg-white dark:bg-slate-900 rounded border border-dashed border-gray-300 dark:border-slate-800 text-center text-[10px] text-gray-400">
                    暂未配置任何大模型。请在下方表单中添加大语言模型。
                  </div>
                ) : (
                  config.models.map((mod) => (
                    <div
                      key={mod.id}
                      className={`p-3.5 bg-white dark:bg-slate-900 rounded-lg border transition-all ${
                        mod.isPrimary 
                          ? 'border-black dark:border-slate-100 ring-1 ring-black/10 dark:ring-white/10 shadow-xs' 
                          : 'border-gray-200 dark:border-slate-800 hover:border-gray-350 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs font-bold text-gray-800 dark:text-slate-100 truncate">{mod.name}</span>
                          {mod.isPrimary && (
                            <span className="text-[9px] bg-black dark:bg-slate-100 text-white dark:text-slate-950 px-1.5 py-0.5 rounded font-bold font-mono">
                              首选 Primary
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {!mod.isPrimary && (
                            <button
                              type="button"
                              onClick={() => handleSetPrimary(mod.id)}
                              className="text-[10px] px-2 py-0.5 border border-gray-350 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-350 cursor-pointer transition-all"
                            >
                              设为首选
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={config.models.length <= 1}
                            onClick={() => handleDeleteModel(mod.id)}
                            className="p-1 text-gray-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 disabled:opacity-30 disabled:hover:text-gray-400 cursor-pointer rounded transition-all"
                            title="删除此模型"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Model details */}
                      <div className="mt-2.5 space-y-2 text-[10px]">
                        <div>
                          <span className="text-gray-450 dark:text-slate-450">接口地址 (Base URL): </span>
                          <span className="font-mono text-gray-600 dark:text-slate-300 break-all">{mod.baseUrl || 'https://api.openai.com/v1'}</span>
                        </div>

                        {/* Inline Key Modification */}
                        <div className="space-y-1">
                          <span className="text-gray-450 dark:text-slate-450 block">API 密钥 (已保存加密，可直接输入更改):</span>
                          <div className="relative">
                            <input
                              type={showKeys ? 'text' : 'password'}
                              placeholder="•••••••••••••••• (已保存 - 无法查看)"
                              onChange={(e) => handleUpdateModelField(mod.id, 'apiKey', e.target.value)}
                              className="w-full text-[10px] px-2.5 py-1 bg-slate-50/50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded focus:bg-white dark:focus:bg-slate-900 focus:border-black dark:focus:border-white outline-none font-mono text-gray-800 dark:text-slate-100"
                            />
                            <Lock className="w-3 h-3 text-gray-300 dark:text-slate-500 absolute right-2 top-1.5" />
                          </div>
                        </div>

                        {/* Testing button & Inline status feedback */}
                        <div className="pt-1.5">
                          <button
                            type="button"
                            disabled={testingId !== null}
                            onClick={() => handleTestModel(mod.id)}
                            className="w-full py-1 border border-gray-200 dark:border-slate-700 hover:border-black dark:hover:border-slate-300 rounded-[4px] text-[9px] font-bold text-gray-600 dark:text-slate-300 hover:text-black dark:hover:text-white transition-all cursor-pointer flex items-center justify-center gap-1"
                          >
                            {testingId === mod.id ? (
                              <>
                                <Loader2 className="w-2.5 h-2.5 animate-spin text-black dark:text-white" />
                                <span>连接校验中...</span>
                              </>
                            ) : (
                              <>
                                <RefreshCw className="w-2.5 h-2.5" />
                                <span>测试此模型连接</span>
                              </>
                            )}
                          </button>

                          {testResults[mod.id] && (
                            <div className={`mt-2 p-2 rounded text-[9px] leading-relaxed flex items-start gap-1 ${
                              testResults[mod.id].success 
                                ? 'bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-400 border border-green-150 dark:border-green-900/30' 
                                : 'bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-400 border border-red-150 dark:border-red-900/30'
                            }`}>
                              {testResults[mod.id].success ? (
                                <Check className="w-3 h-3 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                              ) : (
                                <AlertCircle className="w-3 h-3 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
                              )}
                              <span>{testResults[mod.id].message}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add Custom Model Form */}
              <form onSubmit={handleAddNewModel} className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-gray-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors duration-300">
                <div className="border-b border-gray-100 dark:border-slate-800 pb-1.5 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5 text-black dark:text-white" />
                  <span className="text-xs font-bold text-gray-800 dark:text-slate-200">添加自定义大语言模型</span>
                </div>

                <div className="space-y-3">
                  {/* Model Name */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-medium text-gray-500 dark:text-slate-400 block">模型名称 (Model Name) <span className="text-red-500">*</span></span>
                    <input
                      type="text"
                      placeholder="例如: gpt-4o-mini 或 gpt-4o-mini..."
                      required
                      value={newModelName}
                      onChange={(e) => setNewModelName(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 bg-slate-50/50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded focus:bg-white dark:focus:bg-slate-900 focus:border-black dark:focus:border-white outline-none font-mono text-gray-800 dark:text-slate-100"
                    />
                  </div>

                  {/* API Key */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-medium text-gray-500 dark:text-slate-400 block">API 密钥 (API Key) <span className="text-red-500">*</span></span>
                    <div className="relative">
                      <input
                        type={showKeys ? 'text' : 'password'}
                        placeholder="输入对应模型的 API Key..."
                        required
                        value={newModelApiKey}
                        onChange={(e) => setNewModelApiKey(e.target.value)}
                        className="w-full text-xs px-2.5 py-1.5 bg-slate-50/50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded focus:bg-white dark:focus:bg-slate-900 focus:border-black dark:focus:border-white outline-none font-mono text-gray-800 dark:text-slate-100"
                      />
                      <Lock className="w-3 h-3 text-gray-300 dark:text-slate-500 absolute right-3 top-2.5" />
                    </div>
                  </div>

                  {/* Base URL */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-medium text-gray-500 dark:text-slate-400 block">API 代理端点 (Base URL) - <span className="text-gray-450">可选</span></span>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="例如: https://api.openai.com/v1 或留空默认"
                        value={newModelBaseUrl}
                        onChange={(e) => setNewModelBaseUrl(e.target.value)}
                        className="w-full text-xs px-2.5 py-1.5 bg-slate-50/50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded focus:bg-white dark:focus:bg-slate-900 focus:border-black dark:focus:border-white outline-none font-mono text-gray-800 dark:text-slate-100"
                      />
                      <Globe className="w-3 h-3 text-gray-300 dark:text-slate-500 absolute right-3 top-2.5" />
                    </div>
                  </div>

                  {/* Is Primary Checkbox */}
                  <label className="flex items-center gap-2 cursor-pointer pt-1 select-none text-gray-650 dark:text-slate-350">
                    <input
                      type="checkbox"
                      checked={newModelIsPrimary}
                      onChange={(e) => setNewModelIsPrimary(e.target.checked)}
                      className="w-3.5 h-3.5 border-gray-300 dark:border-slate-700 rounded text-black dark:text-white focus:ring-black dark:focus:ring-white cursor-pointer"
                    />
                    <span className="text-[10px] font-medium">设为系统首选 LLM (Primary LLM)</span>
                  </label>

                  {/* Temporary testing result */}
                  {testResults['new_model_temp'] && (
                    <div className={`p-2.5 rounded text-[9px] leading-relaxed flex items-start gap-1 ${
                      testResults['new_model_temp'].success 
                        ? 'bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-400 border border-green-200 dark:border-green-900/30' 
                        : 'bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-900/30'
                    }`}>
                      {testResults['new_model_temp'].success ? (
                        <Check className="w-3 h-3 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-3 h-3 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
                      )}
                      <span>{testResults['new_model_temp'].message}</span>
                    </div>
                  )}

                  {/* Form actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      disabled={testingId !== null}
                      onClick={handleTestNewModel}
                      className="flex-1 py-2 border border-gray-200 dark:border-slate-700 hover:border-black dark:hover:border-slate-300 rounded text-[10px] text-gray-700 dark:text-slate-200 hover:text-black dark:hover:text-white font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      {testingId === 'new_model_temp' ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>校验中...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3 h-3" />
                          <span>测试连接</span>
                        </>
                      )}
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-black dark:bg-slate-100 dark:text-slate-900 hover:bg-gray-800 dark:hover:bg-slate-200 text-white rounded text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      <span>测试并保存</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Sync success indicator */}
            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 p-3.5 rounded-lg flex items-start gap-2 text-[10px] text-emerald-800 dark:text-emerald-400 shadow-2xs transition-colors duration-300">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5 animate-bounce" />
              <div>
                <span className="font-bold block">知道平台协同同步已激活</span>
                <p className="mt-0.5 leading-relaxed text-emerald-700/90 dark:text-emerald-400/90">
                  您对 LLM 模型列表所做的任何修改都将立即自动向全平台公开并加密同步。所有人免登录、零壁垒直接协作调用！
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
