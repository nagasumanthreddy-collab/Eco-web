import {
  BarChart3,
  Bell,
  ClipboardPlus,
  HeartHandshake,
  LayoutDashboard,
  LogOut,
  Moon,
  Settings,
  Sun,
  TrendingUp,
} from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppLogo } from './AppLogo.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { useToast } from '../context/ToastContext.tsx';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/entries', label: 'Daily Entry', icon: ClipboardPlus },
  { to: '/predictions', label: 'AI Prediction', icon: TrendingUp },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/surplus', label: 'Surplus Rescue', icon: HeartHandshake },
  { to: '/alerts', label: 'Waste Alerts', icon: Bell },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const MOBILE_NAV_ITEMS = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/entries', label: 'Log', icon: ClipboardPlus },
  { to: '/predictions', label: 'Predict', icon: TrendingUp },
  { to: '/surplus', label: 'Surplus', icon: HeartHandshake },
  { to: '/settings', label: 'More', icon: Settings },
];

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Overview Dashboard',
  '/entries': 'Daily Kitchen Entry',
  '/predictions': 'Demand & Prep Forecast',
  '/analytics': 'Waste Analytics',
  '/surplus': 'Surplus Redistribution',
  '/alerts': 'Waste Threshold Alerts',
  '/settings': 'Account & Preferences',
};

export function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const currentTitle = ROUTE_TITLES[location.pathname] || 'Dashboard';

  const handleLogout = async () => {
    try {
      await logout();
      showToast('Signed out of EcoPredict.', 'info');
      navigate('/login');
    } catch {
      showToast('Unable to sign out right now.', 'error');
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 dark:bg-[#0B1115] dark:text-slate-100">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F]">
        <div className="h-16 px-5 flex items-center gap-2.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <AppLogo size="md" />
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0">
            EcoPredict
          </span>
        </div>

        <nav aria-label="Primary navigation" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {user?.name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {user?.organizationName} <span aria-hidden="true">·</span>{' '}
              {user?.role === 'ADMIN' ? 'Admin' : 'Vendor'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-14 lg:h-16 sticky top-0 z-30 bg-white/95 dark:bg-[#11191F]/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-4 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <AppLogo size="sm" className="lg:hidden" />
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0">
                EcoPredict
              </span>
              <span className="hidden sm:inline text-slate-300 dark:text-slate-700" aria-hidden="true">
                /
              </span>
              <h1 className="font-display font-semibold text-slate-900 dark:text-white truncate">
                {currentTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <NavLink
              to="/entries"
              className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              Log Entry
            </NavLink>
          </div>
        </header>

        {/* Viewport Content */}
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-7 pb-24 lg:pb-10 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 h-14 bg-white dark:bg-[#11191F] border-t border-slate-200 dark:border-slate-800 grid grid-cols-5"
      >
        {MOBILE_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600 ${
                  isActive
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
