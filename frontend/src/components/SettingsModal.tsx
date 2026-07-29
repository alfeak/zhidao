import { useEffect, useRef, useState } from 'react';
import { X, Eye, EyeOff, Save, CheckCircle, AlertCircle, Loader2, Cpu, HardDrive, FileCode, Plus, Star, Trash2, Edit2, Check } from 'lucide-react';

interface MinerUConfig {
  id: string;
  name: string;
  mineruToken: string;
  mineruBaseUrl: string;
  isPrimary: boolean;
}

interface LlmConfig {
  id: string;
  name: string;
  llmModel: string;
  llmApiKey: string;
  llmBaseUrl: string;
  isPrimary: boolean;
}

interface R2Config {
  id: string;
  name: string;
  r2AccountId: string;
  r2Bucket: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2EndpointUrl: string;
  r2Prefix: string;
  isPrimary: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'mineru' | 'llm' | 'r2'>('llm');
  const fetchRequestIdRef = useRef(0);

  // Lists state
  const [mineruConfigs, setMineruConfigs] = useState<MinerUConfig[]>([]);
  const [llmConfigs, setLlmConfigs] = useState<LlmConfig[]>([]);
  const [r2Configs, setR2Configs] = useState<R2Config[]>([]);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Form states for currently editing/adding item
  const [formName, setFormName] = useState('');
  
  // MinerU form
  const [mineruToken, setMineruToken] = useState('');
  const [mineruBaseUrl, setMineruBaseUrl] = useState('https://mineru.net/api/v4');

  // LLM form
  const [llmModel, setLlmModel] = useState('deepseek-v4-pro');
  const [llmApiKey, setLlmApiKey] = useState('');
  const [llmBaseUrl, setLlmBaseUrl] = useState('https://api.deepseek.com');

  // R2 form
  const [r2AccountId, setR2AccountId] = useState('');
  const [r2Bucket, setR2Bucket] = useState('');
  const [r2AccessKeyId, setR2AccessKeyId] = useState('');
  const [r2SecretAccessKey, setR2SecretAccessKey] = useState('');
  const [r2EndpointUrl, setR2EndpointUrl] = useState('');
  const [r2Prefix, setR2Prefix] = useState('mineru');

  // Global UI State
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testingModel, setTestingModel] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const applyFetchedConfig = (data: {
    mineruConfigs?: MinerUConfig[];
    llmConfigs?: LlmConfig[];
    r2Configs?: R2Config[];
  }) => {
    setMineruConfigs(data.mineruConfigs || []);
    setLlmConfigs(data.llmConfigs || []);
    setR2Configs(data.r2Configs || []);
  };

  const fetchConfig = async () => {
    const requestId = ++fetchRequestIdRef.current;
    setLoading(true);
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      if (requestId !== fetchRequestIdRef.current) return;
      applyFetchedConfig(data);
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      if (requestId === fetchRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setEditingId(null);
    setIsAddingNew(false);
    void fetchConfig();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (
    customMineru = mineruConfigs,
    customLlm = llmConfigs,
    customR2 = r2Configs
  ) => {
    fetchRequestIdRef.current += 1;
    setLoading(true);
    setSaveSuccess(false);
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mineruConfigs: customMineru,
          llmConfigs: customLlm,
          r2Configs: customR2,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        applyFetchedConfig(data.config || data);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setLoading(false);
    }
  };

  // Primary toggle handlers
  const setPrimaryMinerU = (id: string) => {
    if (loading) return;
    const updated = mineruConfigs.map((c) => ({ ...c, isPrimary: c.id === id }));
    setMineruConfigs(updated);
    void handleSave(updated, llmConfigs, r2Configs);
  };

  const setPrimaryLlm = (id: string) => {
    if (loading) return;
    const updated = llmConfigs.map((c) => ({ ...c, isPrimary: c.id === id }));
    setLlmConfigs(updated);
    void handleSave(mineruConfigs, updated, r2Configs);
  };

  const setPrimaryR2 = (id: string) => {
    if (loading) return;
    const updated = r2Configs.map((c) => ({ ...c, isPrimary: c.id === id }));
    setR2Configs(updated);
    void handleSave(mineruConfigs, llmConfigs, updated);
  };

  // Delete handlers
  const deleteMinerU = (id: string) => {
    if (loading) return;
    if (mineruConfigs.length <= 1) return;
    const updated = mineruConfigs.filter((c) => c.id !== id);
    if (!updated.some((c) => c.isPrimary)) updated[0].isPrimary = true;
    setMineruConfigs(updated);
    void handleSave(updated, llmConfigs, r2Configs);
  };

  const deleteLlm = (id: string) => {
    if (loading) return;
    if (llmConfigs.length <= 1) return;
    const updated = llmConfigs.filter((c) => c.id !== id);
    if (!updated.some((c) => c.isPrimary)) updated[0].isPrimary = true;
    setLlmConfigs(updated);
    void handleSave(mineruConfigs, updated, r2Configs);
  };

  const deleteR2 = (id: string) => {
    if (loading) return;
    if (r2Configs.length <= 1) return;
    const updated = r2Configs.filter((c) => c.id !== id);
    if (!updated.some((c) => c.isPrimary)) updated[0].isPrimary = true;
    setR2Configs(updated);
    void handleSave(mineruConfigs, llmConfigs, updated);
  };

  // Start Form
  const startAddNew = () => {
    if (loading) return;
    setIsAddingNew(true);
    setEditingId(null);
    setTestResult(null);

    if (activeTab === 'mineru') {
      setFormName(`MinerU 配置 ${mineruConfigs.length + 1}`);
      setMineruToken('');
      setMineruBaseUrl('https://mineru.net/api/v4');
    } else if (activeTab === 'llm') {
      setFormName(`大模型配置 ${llmConfigs.length + 1}`);
      setLlmModel('deepseek-v4-pro');
      setLlmApiKey('');
      setLlmBaseUrl('https://api.deepseek.com');
    } else {
      setFormName(`R2 存储 ${r2Configs.length + 1}`);
      setR2AccountId('');
      setR2Bucket('');
      setR2AccessKeyId('');
      setR2SecretAccessKey('');
      setR2EndpointUrl('');
      setR2Prefix('mineru');
    }
  };

  const startEdit = (id: string) => {
    if (loading) return;
    setIsAddingNew(false);
    setEditingId(id);
    setTestResult(null);

    if (activeTab === 'mineru') {
      const item = mineruConfigs.find((c) => c.id === id);
      if (!item) return;
      setFormName(item.name);
      setMineruToken(item.mineruToken);
      setMineruBaseUrl(item.mineruBaseUrl);
    } else if (activeTab === 'llm') {
      const item = llmConfigs.find((c) => c.id === id);
      if (!item) return;
      setFormName(item.name);
      setLlmModel(item.llmModel);
      setLlmApiKey(item.llmApiKey);
      setLlmBaseUrl(item.llmBaseUrl);
    } else {
      const item = r2Configs.find((c) => c.id === id);
      if (!item) return;
      setFormName(item.name);
      setR2AccountId(item.r2AccountId);
      setR2Bucket(item.r2Bucket);
      setR2AccessKeyId(item.r2AccessKeyId);
      setR2SecretAccessKey(item.r2SecretAccessKey);
      setR2EndpointUrl(item.r2EndpointUrl);
      setR2Prefix(item.r2Prefix);
    }
  };

  const saveFormItem = () => {
    if (loading) return;
    if (activeTab === 'mineru') {
      let updated: MinerUConfig[];
      if (isAddingNew) {
        const newItem: MinerUConfig = {
          id: `mineru_${Date.now()}`,
          name: formName || '新 MinerU 配置',
          mineruToken,
          mineruBaseUrl,
          isPrimary: mineruConfigs.length === 0,
        };
        updated = [...mineruConfigs, newItem];
      } else {
        updated = mineruConfigs.map((c) =>
          c.id === editingId ? { ...c, name: formName, mineruToken, mineruBaseUrl } : c
        );
      }
      setMineruConfigs(updated);
      void handleSave(updated, llmConfigs, r2Configs);
    } else if (activeTab === 'llm') {
      let updated: LlmConfig[];
      if (isAddingNew) {
        const newItem: LlmConfig = {
          id: `llm_${Date.now()}`,
          name: formName || '新大模型配置',
          llmModel,
          llmApiKey,
          llmBaseUrl,
          isPrimary: llmConfigs.length === 0,
        };
        updated = [...llmConfigs, newItem];
      } else {
        updated = llmConfigs.map((c) =>
          c.id === editingId ? { ...c, name: formName, llmModel, llmApiKey, llmBaseUrl } : c
        );
      }
      setLlmConfigs(updated);
      void handleSave(mineruConfigs, updated, r2Configs);
    } else {
      let updated: R2Config[];
      if (isAddingNew) {
        const newItem: R2Config = {
          id: `r2_${Date.now()}`,
          name: formName || '新 R2 存储',
          r2AccountId,
          r2Bucket,
          r2AccessKeyId,
          r2SecretAccessKey,
          r2EndpointUrl,
          r2Prefix,
          isPrimary: r2Configs.length === 0,
        };
        updated = [...r2Configs, newItem];
      } else {
        updated = r2Configs.map((c) =>
          c.id === editingId
            ? {
                ...c,
                name: formName,
                r2AccountId,
                r2Bucket,
                r2AccessKeyId,
                r2SecretAccessKey,
                r2EndpointUrl,
                r2Prefix,
              }
            : c
        );
      }
      setR2Configs(updated);
      void handleSave(mineruConfigs, llmConfigs, updated);
    }

    setEditingId(null);
    setIsAddingNew(false);
  };

  const handleTestMineru = async () => {
    setTestingModel(true);
    setTestResult(null);
    try {
      const response = await fetch('/api/config/test-mineru', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mineruToken,
          mineruBaseUrl,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setTestResult({ success: true, message: data.message || 'MinerU 服务连接正常！' });
      } else {
        setTestResult({ success: false, message: data.detail || data.error || 'MinerU 连接测试失败，请检查 Token' });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'MinerU 测试网络异常' });
    } finally {
      setTestingModel(false);
    }
  };

  const handleTestLlm = async () => {
    setTestingModel(true);
    setTestResult(null);
    try {
      const response = await fetch('/api/config/test-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: llmModel,
          apiKey: llmApiKey,
          baseUrl: llmBaseUrl,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setTestResult({ success: true, message: data.message || '连接成功！' });
      } else {
        setTestResult({ success: false, message: data.detail || data.error || '连接测试失败，请检查 API Key 和 Base URL' });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || '连接测试异常' });
    } finally {
      setTestingModel(false);
    }
  };

  const handleTestR2 = async () => {
    setTestingModel(true);
    setTestResult(null);
    try {
      const response = await fetch('/api/config/test-r2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          r2AccountId,
          r2Bucket,
          r2AccessKeyId,
          r2SecretAccessKey,
          r2EndpointUrl,
          r2Prefix,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setTestResult({ success: true, message: data.message || 'R2 存储桶连接成功！' });
      } else {
        setTestResult({ success: false, message: data.detail || data.error || 'R2 连接测试失败，请检查凭据与 Bucket' });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'R2 测试网络异常' });
    } finally {
      setTestingModel(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400">
              <Cpu className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-bold">账号个人偏好与服务配置</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="mt-4 flex border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              setActiveTab('mineru');
              setEditingId(null);
              setIsAddingNew(false);
            }}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === 'mineru'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <FileCode className="h-3.5 w-3.5" />
            MinerU 解析配置 ({mineruConfigs.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('llm');
              setEditingId(null);
              setIsAddingNew(false);
            }}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === 'llm'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            大模型 (LLM) 配置 ({llmConfigs.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('r2');
              setEditingId(null);
              setIsAddingNew(false);
            }}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === 'r2'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <HardDrive className="h-3.5 w-3.5" />
            R2 对象存储配置 ({r2Configs.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="py-6 space-y-4 max-h-[55vh] overflow-y-auto pr-1">
          {/* Editor Form Modal/Card */}
          {editingId || isAddingNew ? (
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4 space-y-3 dark:border-cyan-500/20 dark:bg-cyan-500/10">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-cyan-600 dark:text-cyan-400">
                  {isAddingNew ? '添加新配置' : '编辑配置'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setIsAddingNew(false);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  取消
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  配置别名 / 名称
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="例如: DeepSeek 生产环境 / 个人 R2 存储"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              {activeTab === 'mineru' && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      MinerU API Token
                    </label>
                    <div className="relative">
                      <input
                        type={showSecretKey ? 'text' : 'password'}
                        value={mineruToken}
                        onChange={(e) => setMineruToken(e.target.value)}
                        placeholder="输入 MinerU API Token"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecretKey((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showSecretKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Base URL
                    </label>
                    <input
                      type="text"
                      value={mineruBaseUrl}
                      onChange={(e) => setMineruBaseUrl(e.target.value)}
                      placeholder="https://mineru.net/api/v4"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950"
                    />
                  </div>

                  <div className="pt-1 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleTestMineru}
                      disabled={testingModel}
                      className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                    >
                      {testingModel ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileCode className="h-3 w-3 text-cyan-500" />}
                      测试此配置
                    </button>
                    {testResult && (
                      <span className={`text-[11px] font-medium ${testResult.success ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {testResult.message}
                      </span>
                    )}
                  </div>
                </>
              )}

              {activeTab === 'llm' && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      模型 ID / 名称 (Model)
                    </label>
                    <input
                      type="text"
                      value={llmModel}
                      onChange={(e) => setLlmModel(e.target.value)}
                      placeholder="例如: deepseek-v4-pro, gpt-4o-mini"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      API Key
                    </label>
                    <div className="relative">
                      <input
                        type={showSecretKey ? 'text' : 'password'}
                        value={llmApiKey}
                        onChange={(e) => setLlmApiKey(e.target.value)}
                        placeholder="输入 API Key"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecretKey((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showSecretKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Base URL (OpenAI 兼容 Endpoint)
                    </label>
                    <input
                      type="text"
                      value={llmBaseUrl}
                      onChange={(e) => setLlmBaseUrl(e.target.value)}
                      placeholder="https://api.deepseek.com"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950"
                    />
                  </div>

                  <div className="pt-1 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleTestLlm}
                      disabled={testingModel}
                      className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                    >
                      {testingModel ? <Loader2 className="h-3 w-3 animate-spin" /> : <Cpu className="h-3 w-3 text-cyan-500" />}
                      测试此配置
                    </button>
                    {testResult && (
                      <span className={`text-[11px] font-medium ${testResult.success ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {testResult.message}
                      </span>
                    )}
                  </div>
                </>
              )}

              {activeTab === 'r2' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Account ID</label>
                    <input
                      type="text"
                      value={r2AccountId}
                      onChange={(e) => setR2AccountId(e.target.value)}
                      placeholder="Account ID"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Bucket</label>
                    <input
                      type="text"
                      value={r2Bucket}
                      onChange={(e) => setR2Bucket(e.target.value)}
                      placeholder="Bucket 名称"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Access Key ID</label>
                    <input
                      type="text"
                      value={r2AccessKeyId}
                      onChange={(e) => setR2AccessKeyId(e.target.value)}
                      placeholder="Access Key"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Secret Access Key</label>
                    <input
                      type={showSecretKey ? 'text' : 'password'}
                      value={r2SecretAccessKey}
                      onChange={(e) => setR2SecretAccessKey(e.target.value)}
                      placeholder="Secret Key"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Endpoint URL</label>
                    <input
                      type="text"
                      value={r2EndpointUrl}
                      onChange={(e) => setR2EndpointUrl(e.target.value)}
                      placeholder="https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950"
                    />
                  </div>

                  <div className="col-span-2 pt-1 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleTestR2}
                      disabled={testingModel}
                      className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                    >
                      {testingModel ? <Loader2 className="h-3 w-3 animate-spin" /> : <HardDrive className="h-3 w-3 text-cyan-500" />}
                      测试此配置
                    </button>
                    {testResult && (
                      <span className={`text-[11px] font-medium ${testResult.success ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {testResult.message}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={saveFormItem}
                  className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500"
                >
                  <Check className="h-3.5 w-3.5" />
                  保存此条配置
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-slate-400">已保存的配置列表，选中的主配置将生效</span>
              <button
                type="button"
                onClick={startAddNew}
                className="flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-600 hover:bg-cyan-500/20 dark:text-cyan-400"
              >
                <Plus className="h-3.5 w-3.5" />
                新增配置
              </button>
            </div>
          )}

          {/* Configs List View */}
          {activeTab === 'mineru' && (
            <div className="space-y-2">
              {mineruConfigs.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between rounded-xl border p-3.5 transition ${
                    item.isPrimary
                      ? 'border-cyan-500/50 bg-cyan-500/5 dark:border-cyan-500/40 dark:bg-cyan-500/10'
                      : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.name}</span>
                      {item.isPrimary ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-600 dark:text-cyan-400">
                          <Star className="h-3 w-3 fill-cyan-500 text-cyan-500" />
                          主配置 (Primary)
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPrimaryMinerU(item.id)}
                          className="text-[11px] font-medium text-slate-400 hover:text-cyan-500 underline"
                        >
                          设为主配置
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span>Base URL: {item.mineruBaseUrl || 'https://mineru.net/api/v4'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(item.id)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      title="编辑"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    {mineruConfigs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => deleteMinerU(item.id)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-500"
                        title="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'llm' && (
            <div className="space-y-2">
              {llmConfigs.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between rounded-xl border p-3.5 transition ${
                    item.isPrimary
                      ? 'border-cyan-500/50 bg-cyan-500/5 dark:border-cyan-500/40 dark:bg-cyan-500/10'
                      : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.name}</span>
                      {item.isPrimary ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-600 dark:text-cyan-400">
                          <Star className="h-3 w-3 fill-cyan-500 text-cyan-500" />
                          主配置 (Primary)
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPrimaryLlm(item.id)}
                          className="text-[11px] font-medium text-slate-400 hover:text-cyan-500 underline"
                        >
                          设为主配置
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span className="font-mono bg-slate-200/50 px-1.5 py-0.5 rounded dark:bg-slate-800 dark:text-slate-300">
                        {item.llmModel || 'deepseek-v4-pro'}
                      </span>
                      <span>Endpoint: {item.llmBaseUrl || 'https://api.deepseek.com'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(item.id)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      title="编辑"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    {llmConfigs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => deleteLlm(item.id)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-500"
                        title="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'r2' && (
            <div className="space-y-2">
              {r2Configs.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between rounded-xl border p-3.5 transition ${
                    item.isPrimary
                      ? 'border-cyan-500/50 bg-cyan-500/5 dark:border-cyan-500/40 dark:bg-cyan-500/10'
                      : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.name}</span>
                      {item.isPrimary ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-600 dark:text-cyan-400">
                          <Star className="h-3 w-3 fill-cyan-500 text-cyan-500" />
                          主配置 (Primary)
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPrimaryR2(item.id)}
                          className="text-[11px] font-medium text-slate-400 hover:text-cyan-500 underline"
                        >
                          设为主配置
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span>Bucket: {item.r2Bucket || '未配置'}</span>
                      <span>Prefix: {item.r2Prefix || 'mineru'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(item.id)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      title="编辑"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    {r2Configs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => deleteR2(item.id)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-500"
                        title="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
          {saveSuccess ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle className="h-4 w-4" />
              <span>配置更新并与账号同步成功！</span>
            </div>
          ) : (
            <span className="text-[11px] text-slate-400">列表支持配置多套方案，星号标记的“主配置”为当前生效方案</span>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              完成
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
