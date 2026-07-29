import { useState, useRef, useEffect } from 'react';
import { LogOut, User as UserIcon, Shield } from 'lucide-react';
import { User } from '../types';

interface Props {
  user: User;
  onLogout: () => void;
}

export default function UserMenu({ user, onLogout }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1 pl-2 pr-3 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
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
        <div className="absolute right-0 z-50 mt-2 w-64 origin-top-right rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900">
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

          {/* Action Menu */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
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
