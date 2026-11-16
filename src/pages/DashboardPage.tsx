import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardPlus,
  TrendingDown,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageBanner } from '../components/PageBanner.tsx';
import { DashboardSkeleton } from '../components/Skeletons.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { apiFetch } from '../lib/api.ts';
import { ASSETS } from '../lib/assets.ts';
import type { DashboardSummary, ForecastResponse, WasteAlertItem } from '../types.ts';

export function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [alerts, setAlerts] = useState<WasteAlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { theme } = useTheme();

  useEffect(() => {
    let active = true;
    async function loadDashboard() {
      setLoading(true);
      setError('');
      try {
        const [sumRes, predRes, alertRes] = await Promise.all([
          apiFetch<DashboardSummary>('/api/entries/summary'),
          apiFetch<ForecastResponse>('/api/predictions/forecast?days=7&mealType=All'),
          apiFetch<{ alerts: WasteAlertItem[]; thresholdPct: number }>('/api/alerts'),
        ]);
        if (!active) return;
        setSummary(sumRes);
        setForecast(predRes);
        setAlerts(alertRes.alerts);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load dashboard data.');
      } finally {
        if (active) setLoading(false);
      }
    }
    loadDashboard();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error || !summary) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-white dark:bg-[#11191F] p-6 text-sm text-red-700 dark:text-red-300">
        {error || 'Dashboard data unavailable.'}
      </div>
    );
  }

  if (summary.kpis.entryCount === 0) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] p-10 text-center max-w-xl mx-auto mt-8">
        <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
          No meal service logs recorded yet
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 mb-6">
          Log your first kitchen preparation and consumption record to unlock waste analytics, CO₂ tracking, and AI demand forecasts.
        </p>
        <Link
          to="/entries"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
        >
          <ClipboardPlus className="w-4 h-4" />
          <span>Log First Entry</span>
        </Link>
      </div>
    );
  }

  const axisTickColor = theme === 'dark' ? '#94A3B8' : '#64748B';
  const gridStroke = theme === 'dark' ? '#1E293B' : '#E2E8F0';
  const tooltipStyle = {
    backgroundColor: theme === 'dark' ? '#0F172A' : '#FFFFFF',
    borderColor: theme === 'dark' ? '#334155' : '#E2E8F0',
    borderRadius: '0.5rem',
    color: theme === 'dark' ? '#F8FAFC' : '#0F172A',
    fontSize: '12px',
  };

  const { kpis, weeklyTrend, byCategory } = summary;
  const tomorrow = forecast?.tomorrow;

  return (
    <div className="space-y-6">
      <PageBanner
        imageSrc={ASSETS.dashboardBanner}
        imageAlt="Chefs portioning fresh grains and vegetables at a commercial kitchen pass with a digital prep tablet"
        kicker={`${user?.organizationName || 'Kitchen Operations'} · ${user?.organizationType || 'Food Service'}`}
        title="Daily Kitchen Sustainability Overview"
        description="Track prepared vs. consumed volume, monitor category waste rates, and align tomorrow's batch quantities with real demand."
        action={
          <Link
            to="/predictions"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <span>View Tomorrow’s Prep</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        }
      />

      {/* KPI Row */}
      <section aria-label="Key sustainability indicators" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Prepared vs. Consumed
          </p>
          <p className="font-mono text-2xl font-semibold text-slate-900 dark:text-white mt-2 tabular-nums">
            {kpis.totalConsumedKg.toLocaleString()} <span className="text-sm font-normal text-slate-500">/ {kpis.totalPreparedKg.toLocaleString()} kg</span>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 tabular-nums">
            {kpis.daysTracked} service days tracked
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Overall Waste Rate
          </p>
          <div className="flex items-baseline gap-2.5 mt-2">
            <p className="font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
              {kpis.wastePct}%
            </p>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 tabular-nums">
              <TrendingDown className="w-3.5 h-3.5" />
              {kpis.recentWastePct}% last 14d
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 tabular-nums">
            {kpis.totalLeftoverKg.toLocaleString()} kg total leftover
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Estimated Money Saved
          </p>
          <p className="font-mono text-2xl font-semibold text-emerald-700 dark:text-emerald-400 mt-2 tabular-nums">
            ${kpis.moneySavedUsd.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Versus 16% industry waste baseline
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            CO₂e Emissions Avoided
          </p>
          <p className="font-mono text-2xl font-semibold text-slate-900 dark:text-white mt-2 tabular-nums">
            {kpis.co2AvoidedKg.toLocaleString()} <span className="text-sm font-normal text-slate-500">kg</span>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            2.5 kg CO₂e per kg food saved
          </p>
        </div>
      </section>

      {/* Primary Charts Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                14-Day Prepared vs. Consumed Trend
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Daily kitchen batch output compared with actual consumption (kg)
              </p>
            </div>
            <Link
              to="/analytics"
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0"
            >
              <span>Full analytics</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyTrend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="prepGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#64748B" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#64748B" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="consGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16A34A" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: axisTickColor, fontSize: 11 }}
                  tickFormatter={(v: string) => v.slice(5)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: axisTickColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  unit=" kg"
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="preparedKg"
                  name="Prepared (kg)"
                  stroke="#64748B"
                  strokeWidth={2}
                  fill="url(#prepGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="consumedKg"
                  name="Consumed (kg)"
                  stroke="#16A34A"
                  strokeWidth={2.2}
                  fill="url(#consGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] p-5">
          <div className="mb-4">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Waste by Category
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cumulative leftover weight across food groups (kg)
            </p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={byCategory}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: axisTickColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="category"
                  width={112}
                  tick={{ fill: axisTickColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar
                  dataKey="leftoverKg"
                  name="Leftover (kg)"
                  fill="#15803D"
                  radius={[0, 6, 6, 0]}
                  barSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Forecast & Alerts Split */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {tomorrow && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] p-5 flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  Tomorrow’s AI Prep Recommendation
                </h2>
                <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {tomorrow.date} · {tomorrow.dayName}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-4 py-4 border-y border-slate-200 dark:border-slate-800 tabular-nums">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Recommended Prep</p>
                  <p className="font-mono text-xl font-semibold text-emerald-700 dark:text-emerald-400 mt-1">
                    {tomorrow.recommendedPrepKg} kg
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Predicted Demand</p>
                  <p className="font-mono text-xl font-semibold text-slate-900 dark:text-white mt-1">
                    {tomorrow.predictedConsumedKg} kg
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">90% Confidence</p>
                  <p className="font-mono text-sm font-medium text-slate-700 dark:text-slate-300 mt-2">
                    {tomorrow.confidenceLowKg}–{tomorrow.confidenceHighKg} kg
                  </p>
                </div>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-300 mt-4 leading-relaxed">
                {tomorrow.explanation}
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                Est. {tomorrow.predictedHeadcount} diners expected
              </span>
              <Link
                to="/predictions"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
              >
                <span>Open 7-day forecast</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Waste Threshold Alerts
              </h2>
              <Link
                to="/alerts"
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
              >
                <span>Manage alerts</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {alerts.length === 0 ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  All upcoming meals within waste threshold
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  No predicted spikes exceed your configured alert limit.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {alerts.slice(0, 3).map((alert) => (
                  <div key={alert.id} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                    <AlertTriangle
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        alert.severity === 'CRITICAL'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {alert.title}
                        </p>
                        <span
                          className={`text-xs font-mono font-semibold shrink-0 tabular-nums ${
                            alert.severity === 'CRITICAL'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {alert.severity}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {alert.date} <span aria-hidden="true">·</span> {alert.recommendation}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
