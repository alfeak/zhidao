import { useEffect, useState } from 'react';
import { X, Eye, EyeOff, Save, CheckCircle, AlertCircle, Loader2, Cpu, HardDrive, FileCode } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'mineru' | 'llm' | 'r2'>('mineru');

  // Form State
  const [mineruToken, setMineruToken] = useState('');
  const [mineruBaseUrl, setMineruBaseUrl] = useState('https://mineru.net/api/v4');

  const [llmModel, setLlmModel] = useState('deepseek-v4-pro');
  const [llmApiKey, setLlmApiKey] = useState('');
  const [llmBaseUrl, setLlmBaseUrl] = useState('https://api.deepseek.com');

  const [r2AccountId, setR2AccountId] = useState('');
  const [r2Bucket, setR2Bucket] = useState('');
  const [r2AccessKeyId, setR2AccessKeyId] = useState('');
  const [r2SecretAccessKey, setR2SecretAccessKey] = useState('');
  const [r2EndpointUrl, setR2EndpointUrl] = useState('');
  const [r2Prefix, setR2Prefix] = useState('mineru');

  // UI state
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testingModel, setTestingModel] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => {
        setMineruToken(data.mineruToken || '');
        setMineruBaseUrl(data.mineruBaseUrl || 'https://mineru.net/api/v4');
        setLlmModel(data.llmModel || 'deepseek-v4-pro');
        setLlmApiKey(data.llmApiKey || '');
        setLlmBaseUrl(data.llmBaseUrl || 'https://api.deepseek.com');
        setR2AccountId(data.r2AccountId || '');
        setR2Bucket(data.r2Bucket || '');
        setR2AccessKeyId(data.r2AccessKeyId || '');
        setR2SecretAccessKey(data.r2SecretAccessKey || '');
        setR2EndpointUrl(data.r2EndpointUrl || '');
        setR2Prefix(data.r2Prefix || 'mineru');
      })
      .catch((err) => console.error('Error fetching settings:', err))
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setLoading(true);
    setSaveSuccess(false);
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mineruToken,
          mineruBaseUrl,
          llmModel,
          llmApiKey,
          llmBaseUrl,
          r2AccountId,
          r2Bucket,
          r2AccessKeyId,
          r2SecretAccessKey,
          r2EndpointUrl,
          r2Prefix,
        }),
      });
      if (response.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setLoading(false);
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
        setTestResult({ success: false, message: data.detail || '连接测试失败，请检查 API Key 和 Base URL' });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || '连接测试异常' });
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
            onClick={() => setActiveTab('mineru')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === 'mineru'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <FileCode className="h-3.5 w-3.5" />
            MinerU 解析配置
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('llm')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === 'llm'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            大模型 (LLM) 配置
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('r2')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === 'r2'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <HardDrive className="h-3.5 w-3.5" />
            R2 对象存储配置
          </button>
        </div>

        {/* Form Body */}
        <div className="py-6 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {activeTab === 'mineru' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  MinerU API Token
                </label>
                <div className="relative">
                  <input
                    type={showSecretKey ? 'text' : 'password'}
                    value={mineruToken}
                    onChange={(e) => setMineruToken(e.target.value)}
                    placeholder="输入 MinerU API Token"
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-cyan-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecretKey((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showSecretKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">若未设置，默认使用系统公共 Token（申请地址：mineru.net）</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  MinerU API Base URL
                </label>
                <input
                  type="text"
                  value={mineruBaseUrl}
                  onChange={(e) => setMineruBaseUrl(e.target.value)}
                  placeholder="https://mineru.net/api/v4"
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-cyan-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:focus:border-cyan-400"
                />
              </div>
            </div>
          )}

          {activeTab === 'llm' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  模型 ID / 名称 (Model)
                </label>
                <input
                  type="text"
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  placeholder="如: deepseek-v4-pro, gpt-4o-mini"
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-cyan-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  API Key
                </label>
                <div className="relative">
                  <input
                    type={showSecretKey ? 'text' : 'password'}
                    value={llmApiKey}
                    onChange={(e) => setLlmApiKey(e.target.value)}
                    placeholder="输入大模型 API Key"
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-cyan-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:focus:border-cyan-400"
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
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Base URL (OpenAI 兼容 Endpoint)
                </label>
                <input
                  type="text"
                  value={llmBaseUrl}
                  onChange={(e) => setLlmBaseUrl(e.target.value)}
                  placeholder="https://api.deepseek.com"
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-cyan-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:focus:border-cyan-400"
                />
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleTestLlm}
                  disabled={testingModel}
                  className="flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  {testingModel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cpu className="h-3.5 w-3.5 text-cyan-500" />}
                  测试模型连接
                </button>
                {testResult && (
                  <div
                    className={`mt-2 flex items-center gap-2 rounded-md p-2 text-xs ${
                      testResult.success
                        ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {testResult.success ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                    <span>{testResult.message}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'r2' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  R2 Account ID
                </label>
                <input
                  type="text"
                  value={r2AccountId}
                  onChange={(e) => setR2AccountId(e.target.value)}
                  placeholder="Cloudflare Account ID"
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-cyan-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  R2 Bucket
                </label>
                <input
                  type="text"
                  value={r2Bucket}
                  onChange={(e) => setR2Bucket(e.target.value)}
                  placeholder="存储桶名称"
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-cyan-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  R2 Access Key ID
                </label>
                <input
                  type="text"
                  value={r2AccessKeyId}
                  onChange={(e) => setR2AccessKeyId(e.target.value)}
                  placeholder="Access Key ID"
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-cyan-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  R2 Secret Access Key
                </label>
                <input
                  type={showSecretKey ? 'text' : 'password'}
                  value={r2SecretAccessKey}
                  onChange={(e) => setR2SecretAccessKey(e.target.value)}
                  placeholder="Secret Access Key"
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-cyan-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:focus:border-cyan-400"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Endpoint URL
                </label>
                <input
                  type="text"
                  value={r2EndpointUrl}
                  onChange={(e) => setR2EndpointUrl(e.target.value)}
                  placeholder="https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-cyan-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:focus:border-cyan-400"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
          {saveSuccess ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle className="h-4 w-4" />
              <span>账号个人设置保存成功！</span>
            </div>
          ) : (
            <span className="text-[11px] text-slate-400">配置保存后自动与您的 Google 账号绑定</span>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg bg-black px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              保存个人设置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
