import { useEffect, useState } from 'react';
import { ArrowRight, Sparkles, ShieldCheck, Zap } from 'lucide-react';

interface Props {
  googleClientId: string;
  onGoogleLogin: (credential: string) => Promise<void>;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (element: HTMLElement | null, options: object) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export default function LandingPage({ googleClientId, onGoogleLogin }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!googleClientId) return;

    // Dynamically load Google One Tap / Sign In script if client ID exists
    const scriptId = 'google-jssdk';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => initGoogleSignIn();
      document.head.appendChild(script);
    } else {
      initGoogleSignIn();
    }

    function initGoogleSignIn() {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          if (response.credential) {
            setLoading(true);
            setError(null);
            try {
              await onGoogleLogin(response.credential);
            } catch (err: any) {
              setError(err.message || '登录失败，请稍后重试');
              setLoading(false);
            }
          }
        },
      });

      const btnContainer = document.getElementById('googleSignInDiv');
      if (btnContainer) {
        window.google.accounts.id.renderButton(btnContainer, {
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          width: 320,
          text: 'signin_with',
          locale: 'zh_CN',
        });
      }
    }
  }, [googleClientId, onGoogleLogin]);

  const handleDemoLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await onGoogleLogin(`demo_credential_${Date.now()}`);
    } catch (err: any) {
      setError(err.message || 'Demo 登录失败');
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Dynamic Animated Ambient Background Blobs */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-cyan-500/30 via-sky-600/20 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-gradient-to-tl from-purple-600/30 via-indigo-500/20 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '10s' }} />
      <div className="pointer-events-none absolute top-1/3 right-10 h-72 w-72 rounded-full bg-cyan-400/10 blur-2xl animate-ping" style={{ animationDuration: '12s' }} />

      {/* Subtle Mesh Grid Effect */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:32px_32px] opacity-10" />

      {/* Main Glassmorphic Card */}
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-col items-center px-6 py-12 text-center">
        {/* Animated Main Title: 知道 */}
        <div className="group relative mb-8 cursor-default">
          <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-cyan-500 via-sky-400 to-indigo-500 opacity-30 blur-2xl transition duration-1000 group-hover:opacity-60" />
          <h1 className="relative text-7xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-300 drop-shadow-sm transition-transform duration-500 hover:scale-105">
            知<span className="text-cyan-400">道</span>
          </h1>
          <p className="mt-2 text-xs uppercase tracking-[0.3em] text-cyan-300/80 font-medium">
            AI Paper Research Platform
          </p>
        </div>

        {/* Feature Badges */}
        <div className="mb-10 flex items-center justify-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-4 py-1.5 backdrop-blur-md">
          <span className="flex items-center gap-1 text-xs text-slate-300">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" /> 智能解析
          </span>
          <span className="text-slate-600">•</span>
          <span className="flex items-center gap-1 text-xs text-slate-300">
            <Zap className="h-3.5 w-3.5 text-amber-400" /> 多语对照
          </span>
          <span className="text-slate-600">•</span>
          <span className="flex items-center gap-1 text-xs text-slate-300">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> 安全沉淀
          </span>
        </div>

        {/* Login Area */}
        <div className="w-full rounded-2xl border border-slate-800/80 bg-slate-900/70 p-8 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:border-slate-700">
          <h2 className="mb-2 text-lg font-semibold text-slate-100">欢迎登录“知道”</h2>
          <p className="mb-6 text-xs text-slate-400">仅支持 Google OAuth2 账号快捷登录，即刻开启体验</p>

          {error && (
            <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              {error}
            </div>
          )}

          <div className="flex flex-col items-center gap-4">
            {/* Render official Google button container */}
            <div id="googleSignInDiv" className="flex justify-center min-h-[44px]" />

            {/* Custom Google OAuth Login Button */}
            {!googleClientId && (
              <div className="w-full space-y-3">
                <button
                  type="button"
                  onClick={handleDemoLogin}
                  disabled={loading}
                  className="group relative flex w-full items-center justify-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-white/10 transition-all hover:bg-slate-100 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.26 21.37 7.37 24 12 24z" />
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.6H1.25C.45 8.2.0 10.04.0 12s.45 3.8 1.25 5.4l4.03-3.13z" />
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.94 1.19 15.23 0 12 0 7.37 0 3.26 2.63 1.25 6.6l4.03 3.13c.95-2.83 3.6-4.98 6.72-4.98z" />
                  </svg>
                  <span>使用 Google 账号登录</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 text-slate-500" />
                </button>
                <p className="text-[11px] text-slate-500">（支持一键 Google OAuth2 验证与自动建号）</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <footer className="mt-12 text-center text-xs text-slate-600">
          © 2026 知道 (Zhidao) • 智能文献阅读平台
        </footer>
      </main>
    </div>
  );
}
