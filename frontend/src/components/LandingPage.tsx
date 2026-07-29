import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 3D Ellipsoid Point Cloud Canvas Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Generate points on a large spherical surface (expanding to half screen size)
    const pointCount = 700;
    const points: Array<{ x: number; y: number; z: number; baseAlpha: number }> = [];
    const sphereRadius = Math.max(380, Math.min(window.innerWidth, window.innerHeight) * 0.45);

    for (let i = 0; i < pointCount; i++) {
      const phi = Math.acos(1 - 2 * Math.random()) - Math.PI / 2;
      const theta = Math.random() * Math.PI * 2;
      const noise = 0.9 + Math.random() * 0.2;
      points.push({
        x: sphereRadius * Math.cos(phi) * Math.cos(theta) * noise,
        y: sphereRadius * Math.cos(phi) * Math.sin(theta) * noise,
        z: sphereRadius * Math.sin(phi) * noise,
        baseAlpha: 0.3 + Math.random() * 0.6,
      });
    }

    let angleX = 0;
    let angleY = 0;
    let angleZ = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height * 0.28;

      angleX += 0.0006;
      angleY += 0.0012;
      angleZ += 0.0004;

      const cosX = Math.cos(angleX);
      const sinX = Math.sin(angleX);
      const cosY = Math.cos(angleY);
      const sinY = Math.sin(angleY);
      const cosZ = Math.cos(angleZ);
      const sinZ = Math.sin(angleZ);

      // Sort points by z-depth for correct rendering order
      const projectedPoints = points.map((p) => {
        // Rotate Y
        let x1 = p.x * cosY + p.z * sinY;
        let y1 = p.y;
        let z1 = -p.x * sinY + p.z * cosY;

        // Rotate X
        let x2 = x1;
        let y2 = y1 * cosX - z1 * sinX;
        let z2 = y1 * sinX + z1 * cosX;

        // Rotate Z
        let x3 = x2 * cosZ - y2 * sinZ;
        let y3 = x2 * sinZ + y2 * cosZ;
        let z3 = z2;

        const distance = 700;
        const perspectiveScale = distance / (distance + z3);
        const screenX = centerX + x3 * perspectiveScale;
        const screenY = centerY + y3 * perspectiveScale;

        return {
          screenX,
          screenY,
          scale: perspectiveScale,
          z: z3,
          baseAlpha: p.baseAlpha,
        };
      });

      projectedPoints.sort((a, b) => a.z - b.z);

      for (const p of projectedPoints) {
        const alpha = Math.max(0.1, Math.min(1, ((p.z + sphereRadius) / (sphereRadius * 2)) * p.baseAlpha));
        const radius = Math.max(0.8, 2.2 * p.scale);

        ctx.beginPath();
        ctx.arc(p.screenX, p.screenY, radius, 0, Math.PI * 2);

        if (p.z > 0) {
          ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
        } else {
          ctx.fillStyle = `rgba(168, 85, 247, ${alpha * 0.7})`;
        }

        ctx.shadowBlur = 6;
        ctx.shadowColor = p.z > 0 ? 'rgba(56, 189, 248, 0.6)' : 'rgba(168, 85, 247, 0.4)';
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const onGoogleLoginRef = useRef(onGoogleLogin);
  useEffect(() => {
    onGoogleLoginRef.current = onGoogleLogin;
  }, [onGoogleLogin]);

  useEffect(() => {
    if (!googleClientId) return;

    function initGoogleSignIn() {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          if (response.credential) {
            setLoading(true);
            setError(null);
            try {
              await onGoogleLoginRef.current(response.credential);
            } catch (err: any) {
              setError(err.message || '登录失败，请稍后重试');
              setLoading(false);
            }
          }
        },
      });

      const btnContainer = document.getElementById('googleSignInDiv');
      if (btnContainer && !btnContainer.hasChildNodes()) {
        window.google.accounts.id.renderButton(btnContainer, {
          theme: 'filled_white',
          size: 'large',
          shape: 'pill',
          width: 320,
          text: 'signin_with',
          locale: 'zh_CN',
        });
      }
    }

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
  }, [googleClientId]);

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
      {/* 3D Slowly Evolving Ellipsoid Point Cloud Canvas Background */}
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-65" />

      {/* Dynamic Animated Ambient Background Glow Blobs */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-cyan-500/20 via-sky-600/10 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-gradient-to-tl from-purple-600/20 via-indigo-500/10 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '10s' }} />

      {/* Main Content Area */}
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-col items-center px-6 py-12 text-center">
        {/* Animated Main Title: 知道 */}
        <div className="group relative mb-12 cursor-default">
          <div className="absolute -inset-6 rounded-3xl bg-gradient-to-r from-cyan-500 via-sky-400 to-indigo-500 opacity-30 blur-2xl transition duration-1000 group-hover:opacity-60" />
          <h1 className="relative text-7xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-300 drop-shadow-sm transition-transform duration-500 hover:scale-105">
            知<span className="text-cyan-400">道</span>
          </h1>
        </div>

        {/* Clean & Minimalist Login Area */}
        <div className="w-full rounded-2xl border border-slate-800/80 bg-slate-900/70 p-8 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:border-slate-700">
          <h2 className="mb-6 text-xl font-bold tracking-wide text-slate-100">欢迎登录</h2>

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
              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={loading}
                className="group relative flex w-full items-center justify-center gap-3 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-slate-900 shadow-lg shadow-white/10 transition-all hover:bg-slate-100 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
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
            )}
          </div>
        </div>
      </main>

      {/* Footer Info Pinned to Screen Bottom Center */}
      <footer className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-center text-xs text-slate-600">
        © 2026 知道 (Zhidao) • 文献阅读平台
      </footer>
    </div>
  );
}
