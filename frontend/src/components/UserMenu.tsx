import { useState, useRef, useEffect, useCallback } from 'react';
import { LogOut, User as UserIcon, Shield, QrCode, Copy, Check, Loader2, RefreshCw } from 'lucide-react';
import { User } from '../types';

interface Props {
  user: User;
  onLogout: () => void;
}

interface TempTokenData {
  tempToken: string;
  expiresIn: number;
  expiresAt: string;
  deepLink: string;
  webLink: string;
  serverUrl: string;
  qrCodeDataUrl: string;
}

export default function UserMenu({ user, onLogout }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [authQrData, setAuthQrData] = useState<TempTokenData | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchTempToken = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/temp-token', { method: 'POST' });
      if (res.ok) {
        const data = (await res.json()) as TempTokenData;
        setAuthQrData(data);
        setTimeLeft(data.expiresIn || 120);
      }
    } catch (e) {
      console.error('Failed to fetch temp token:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      void fetchTempToken();
    } else {
      setAuthQrData(null);
      setTimeLeft(0);
    }
  }, [isOpen, fetchTempToken]);

  // Countdown timer for TempToken validity
  useEffect(() => {
    if (!isOpen || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, timeLeft]);

  const copyUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!authQrData?.serverUrl) return;
    navigator.clipboard.writeText(authQrData.serverUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div ref={containerRef} className="relative inline-block text-left select-none">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1 pl-2 pr-3 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
      >
        {user.picture ? (
          <img src={user.picture} alt={user.name} className="h-6 w-6 rounded-full object-cover" />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400">
            <UserIcon className="h-3.5 w-3.5" />
          </div>
        )}
        <span className="max-w-[100px] truncate">{user.name}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-72 origin-top-right rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900">
          {/* User Info Header */}
          <div className="flex items-center gap-3 border-b border-slate-100 p-3 dark:border-slate-800">
            {user.picture ? (
              <img src={user.picture} alt={user.name} className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400">
                <UserIcon className="h-5 w-5" />
              </div>
            )}
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">{user.name}</p>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{user.email}</p>
              <div className="mt-1 flex items-center gap-1 text-[10px] font-medium text-cyan-600 dark:text-cyan-400">
                <Shield className="h-3 w-3" />
                <span>Google OAuth2 验证账号</span>
              </div>
            </div>
          </div>

          {/* Plan B: App Authorization QR Code (Positioned directly above Logout button) */}
          <div className="border-b border-slate-100 p-3 dark:border-slate-800 flex flex-col items-center gap-2">
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                <QrCode className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>手机 App 扫码登录</span>
              </div>
              {timeLeft > 0 ? (
                <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40 px-1.5 py-0.5 rounded font-semibold">
                  {timeLeft}s 后失效
                </span>
              ) : (
                <span className="text-[10px] font-mono text-rose-500 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded font-semibold">
                  已失效
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-400 dark:text-slate-400 text-left w-full leading-tight">
              App 或相机扫码自动绑定服务器并免密登录
            </p>

            {loading ? (
              <div className="flex h-32 w-32 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : authQrData && timeLeft > 0 ? (
              <div className="flex flex-col items-center bg-white p-2 rounded-lg border border-slate-200 shadow-xs dark:border-slate-700 dark:bg-slate-950 w-full">
                <img
                  src={authQrData.qrCodeDataUrl}
                  alt="App Auth QR Code"
                  className="h-32 w-32 object-contain rounded"
                />
                <div className="mt-1 flex items-center justify-center gap-1 max-w-full text-[10px] font-mono text-slate-500 dark:text-slate-400">
                  <span className="truncate max-w-[180px]" title={authQrData.serverUrl}>{authQrData.serverUrl}</span>
                  <button
                    type="button"
                    onClick={copyUrl}
                    className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 shrink-0 cursor-pointer p-0.5"
                    title="复制服务器地址"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 w-full rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-dashed border-slate-200 dark:border-slate-700 p-2 gap-2 text-center">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">二维码已失效，请刷新</span>
                <button
                  type="button"
                  onClick={() => void fetchTempToken()}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-cyan-600 text-white text-xs font-medium shadow-xs hover:bg-cyan-700 transition cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>刷新二维码</span>
                </button>
              </div>
            )}
          </div>

          {/* Action Menu */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>退出登录</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
