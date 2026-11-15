import {
  AlertCircle,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Moon,
  Sun,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLogo } from '../components/AppLogo.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { apiFetch } from '../lib/api.ts';
import type { OrganizationType } from '../types.ts';

type AuthMode = 'login' | 'signup' | 'forgot';

const ORG_TYPES: OrganizationType[] = ['Restaurant', 'Hostel', 'Canteen', 'Event'];

function getPasswordStrength(pw: string) {
  const checks = [
    { label: '8+ characters', met: pw.length >= 8 },
    { label: 'Uppercase letter', met: /[A-Z]/.test(pw) },
    { label: 'Lowercase letter', met: /[a-z]/.test(pw) },
    { label: 'Number', met: /[0-9]/.test(pw) },
  ];
  const score = checks.filter((c) => c.met).length;
  const labels = ['Weak', 'Weak', 'Fair', 'Good', 'Strong'];
  return { checks, score, label: labels[score] };
}

export function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [imageError, setImageError] = useState(false);

  // Login & shared fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Signup fields
  const [name, setName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [organizationType, setOrganizationType] = useState<OrganizationType>('Canteen');

  // Forgot password state
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');
  const [demoCodeHint, setDemoCodeHint] = useState<string | null>(null);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const { login, signup } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const strength = getPasswordStrength(mode === 'forgot' ? newPassword : password);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setErrorMsg('');
    setResetStep('request');
    setDemoCodeHint(null);
  };

  const handleQuickDemoLogin = async (type: 'vendor' | 'admin') => {
    const demoEmail = type === 'vendor' ? 'vendor@ecopredict.io' : 'admin@ecopredict.io';
    const demoPass = type === 'vendor' ? 'Vendor@1234' : 'Admin@1234';
    setMode('login');
    setErrorMsg('');
    setEmail(demoEmail);
    setPassword(demoPass);
    setSubmitting(true);
    try {
      const user = await login(demoEmail, demoPass);
      showToast(`Signed in as ${user.name} (${user.role === 'ADMIN' ? 'Admin' : 'Vendor'}).`, 'success');
      navigate('/');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Demo sign in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!email.trim() || !password) {
      setErrorMsg('Please enter both your email and password.');
      return;
    }

    setSubmitting(true);
    try {
      const user = await login(email.trim(), password);
      showToast(`Welcome back, ${user.name}.`, 'success');
      navigate('/');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (name.trim().length < 2) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (strength.score < 4) {
      setErrorMsg('Please satisfy all password strength requirements.');
      return;
    }
    if (organizationName.trim().length < 2) {
      setErrorMsg('Please enter your kitchen or organization name.');
      return;
    }

    setSubmitting(true);
    try {
      const user = await signup({
        name: name.trim(),
        email: email.trim(),
        password,
        organizationName: organizationName.trim(),
        organizationType,
      });
      showToast(`Workspace created for ${user.organizationName}.`, 'success');
      navigate('/');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotRequest = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string; demoResetCode: string | null }>(
        '/api/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify({ email: email.trim() }),
        }
      );
      setDemoCodeHint(res.demoResetCode);
      if (res.demoResetCode) {
        setResetCode(res.demoResetCode);
      }
      setResetStep('confirm');
      showToast(res.message, 'info');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to generate reset code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotConfirm = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!resetCode.trim()) {
      setErrorMsg('Please enter the 6-digit verification code.');
      return;
    }
    if (strength.score < 4) {
      setErrorMsg('New password must meet all strength requirements.');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          code: resetCode.trim(),
          newPassword,
        }),
      });
      showToast('Password reset complete. Sign in with your new password.', 'success');
      setPassword('');
      setNewPassword('');
      switchMode('login');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Password reset failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50 dark:bg-[#0B1115] text-slate-900 dark:text-slate-100">
      {/* Left Split: Eco-Tech Illustration & Brand Panel */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-emerald-950 text-white p-10">
        {!imageError ? (
          <img
            src="/src/assets/images/auth_ecotech_illustration_1794722546250.jpg"
            alt="Sustainable commercial kitchen with vertical herb farm and digital prep tablet"
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-950" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-slate-950/30" />

        <div className="relative z-10 flex items-center gap-3">
          <AppLogo size="lg" className="ring-1 ring-white/20" />
          <span className="font-display text-xl font-bold tracking-tight">
            EcoPredict
          </span>
        </div>

        <div className="relative z-10 max-w-lg space-y-5">
          <h2 className="font-display text-3xl xl:text-4xl font-bold leading-tight [text-wrap:balance]">
            Precision kitchen demand forecasting to eliminate preventable food waste.
          </h2>
          <p className="text-sm text-slate-200 leading-relaxed">
            Built for commercial restaurants, university hostels, institutional canteens, and large-scale event organizers.
          </p>
          <div className="pt-4 border-t border-white/20 grid grid-cols-3 gap-6 tabular-nums">
            <div>
              <p className="font-mono text-xl font-semibold text-white">7-Day</p>
              <p className="text-xs text-slate-300 mt-0.5">Weighted demand horizon</p>
            </div>
            <div>
              <p className="font-mono text-xl font-semibold text-white">2.5 kg</p>
              <p className="text-xs text-slate-300 mt-0.5">CO₂e saved per kg food</p>
            </div>
            <div>
              <p className="font-mono text-xl font-semibold text-white">Direct</p>
              <p className="text-xs text-slate-300 mt-0.5">NGO pickup dispatch</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Split: Auth Form */}
      <div className="flex flex-col justify-between p-6 sm:p-10 lg:p-14">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 lg:hidden">
            <AppLogo size="md" />
            <span className="font-display text-lg font-bold">EcoPredict</span>
          </div>
          <div className="ml-auto">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="w-full max-w-md mx-auto my-auto py-8">
          {/* Mode Tabs */}
          {mode !== 'forgot' ? (
            <div
              role="tablist"
              aria-label="Authentication mode"
              className="grid grid-cols-2 p-1 rounded-lg bg-slate-200/70 dark:bg-slate-800/70 mb-7"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                onClick={() => switchMode('login')}
                className={`py-2 text-sm font-semibold rounded-md transition-colors whitespace-nowrap ${
                  mode === 'login'
                    ? 'bg-white dark:bg-[#11191F] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signup'}
                onClick={() => switchMode('signup')}
                className={`py-2 text-sm font-semibold rounded-md transition-colors whitespace-nowrap ${
                  mode === 'signup'
                    ? 'bg-white dark:bg-[#11191F] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to sign in</span>
            </button>
          )}

          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              {mode === 'login'
                ? 'Sign in to your kitchen workspace'
                : mode === 'signup'
                  ? 'Register your organization'
                  : 'Reset your password'}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1.5">
              {mode === 'login'
                ? 'Access daily meal logs, demand predictions, and NGO pickup coordination.'
                : mode === 'signup'
                  ? 'Start logging daily prep and receiving weighted demand forecasts.'
                  : 'Enter your registered email to receive a simulated verification code.'}
            </p>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3.5 py-3 text-sm text-red-800 dark:text-red-300"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Work Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vendor@ecopredict.io"
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#11191F] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="login-password"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full h-11 pl-3.5 pr-11 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#11191F] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-lg bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{submitting ? 'Signing in...' : 'Sign In'}</span>
              </button>

              <div className="pt-5 border-t border-slate-200 dark:border-slate-800">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2.5">
                  One-click demo sign-in (60 days of history preloaded):
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleQuickDemoLogin('vendor')}
                    className="px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#11191F] hover:border-emerald-600 dark:hover:border-emerald-500 disabled:opacity-60 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                  >
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">
                      Demo Vendor
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      vendor@ecopredict.io
                    </p>
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleQuickDemoLogin('admin')}
                    className="px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#11191F] hover:border-emerald-600 dark:hover:border-emerald-500 disabled:opacity-60 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                  >
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">
                      Demo Admin
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      admin@ecopredict.io
                    </p>
                  </button>
                </div>
              </div>
            </form>
          )}

          {mode === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="signup-name"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Full Name
                </label>
                <input
                  id="signup-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jordan Rivera"
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#11191F] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label
                  htmlFor="signup-email"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Work Email
                </label>
                <input
                  id="signup-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="kitchen@organization.org"
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#11191F] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label
                    htmlFor="signup-org"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Organization Name
                  </label>
                  <input
                    id="signup-org"
                    type="text"
                    required
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    placeholder="North Hall Hostel"
                    className="w-full h-11 px-3.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#11191F] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label
                    htmlFor="signup-org-type"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Organization Type
                  </label>
                  <select
                    id="signup-org-type"
                    value={organizationType}
                    onChange={(e) => setOrganizationType(e.target.value as OrganizationType)}
                    className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#11191F] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    {ORG_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="signup-password"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a strong password"
                    className="w-full h-11 pl-3.5 pr-11 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#11191F] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                <div className="mt-2.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Password strength</span>
                    <span
                      className={`font-semibold ${
                        strength.score >= 4
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : strength.score >= 2
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-500'
                      }`}
                    >
                      {strength.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[1, 2, 3, 4].map((bar) => (
                      <div
                        key={bar}
                        className={`h-1.5 rounded-full transition-colors ${
                          strength.score >= bar
                            ? strength.score >= 4
                              ? 'bg-emerald-600'
                              : 'bg-amber-500'
                            : 'bg-slate-200 dark:bg-slate-800'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs text-slate-500 dark:text-slate-400">
                    {strength.checks.map((chk) => (
                      <div key={chk.label} className="flex items-center gap-1.5">
                        <Check
                          className={`w-3.5 h-3.5 ${
                            chk.met ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300 dark:text-slate-700'
                          }`}
                        />
                        <span className={chk.met ? 'text-slate-800 dark:text-slate-200' : ''}>
                          {chk.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-lg bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{submitting ? 'Creating account...' : 'Create Account'}</span>
              </button>
            </form>
          )}

          {mode === 'forgot' && resetStep === 'request' && (
            <form onSubmit={handleForgotRequest} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="forgot-email"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Registered Email
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vendor@ecopredict.io"
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#11191F] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-lg bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{submitting ? 'Sending code...' : 'Send Reset Code'}</span>
              </button>
            </form>
          )}

          {mode === 'forgot' && resetStep === 'confirm' && (
            <form onSubmit={handleForgotConfirm} className="space-y-4" noValidate>
              {demoCodeHint && (
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-3 text-xs text-emerald-900 dark:text-emerald-200">
                  Simulated email inbox: Your verification code is{' '}
                  <span className="font-mono font-bold text-sm">{demoCodeHint}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="reset-code"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Verification Code
                </label>
                <input
                  id="reset-code"
                  type="text"
                  required
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  placeholder="6-digit code"
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#11191F] font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label
                  htmlFor="reset-new-password"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="reset-new-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new strong password"
                    className="w-full h-11 pl-3.5 pr-11 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#11191F] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded text-slate-500"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-lg bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{submitting ? 'Updating...' : 'Update Password'}</span>
              </button>
            </form>
          )}
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-500 text-center">
          EcoPredict Kitchen Sustainability Platform
        </p>
      </div>
    </div>
  );
}
