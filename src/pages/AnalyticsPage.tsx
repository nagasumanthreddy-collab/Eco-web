import { Download, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DashboardSkeleton, TableRowsSkeleton } from '../components/Skeletons.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { apiDownloadCsv, apiFetch } from '../lib/api.ts';
import type { DailyEntry, DashboardSummary } from '../types.ts';

const MEALS = ['All', 'Breakfast', 'Lunch', 'Dinner', 'Snacks'];

export function AnalyticsPage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { showToast } = useToast();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [mealType, setMealType] = useState('All');
  const [scopeAll, setScopeAll] = useState(false);

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (mealType !== 'All') params.set('mealType', mealType);
      if (scopeAll && user?.role === 'ADMIN') params.set('scope', 'all');

      const qs = params.toString() ? `?${params.toString()}` : '';
      const [sumRes, entRes] = await Promise.all([
        apiFetch<DashboardSummary>(`/api/entries/summary${qs}`),
        apiFetch<{ entries: DailyEntry[] }>(`/api/entries${qs}`),
      ]);
      setSummary(sumRes);
      setEntries(entRes.entries);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load analytics.', 'error');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, mealType, scopeAll, user?.role, showToast]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    setMealType('All');
    setScopeAll(false);
  };

  const handleExportCsv = async () => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (mealType !== 'All') params.set('mealType', mealType);
    const qs = params.toString() ? `?${params.toString()}` : '';
    try {
      await apiDownloadCsv(`/api/entries/export.csv${qs}`, 'ecopredict-waste-analytics.csv');
      showToast('Downloaded waste analytics CSV export.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to export CSV.', 'error');
    }
  };

  const axisTickColor = theme === 'dark' ? '#94A3B8' : '#64748B';
  const gridStroke = theme === 'dark' ? '#1E293B' : '#E2E8F0';
  const tooltipStyle = {
    backgroundColor: theme === 'dark' ? '#0F172A' : '#FFFFFF',
    borderColor: theme === 'dark' ? '#334155' : '#E2E8F0',
    borderRadius: '0.5rem',
    color: theme === 'dark' ? '#F8FAFC' : '#0F172A',
    fontSize: '12px',
  };

  return (
    <div className="space-y-6">
      {/* Filter Toolbar */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] p-5 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3.5">
          <div>
            <label
              htmlFor="filter-start"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
            >
              From Date
            </label>
            <input
              id="filter-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1115] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
          <div>
            <label
              htmlFor="filter-end"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
            >
              To Date
            </label>
            <input
              id="filter-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1115] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
          <div>
            <label
              htmlFor="filter-meal"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
            >
              Meal Type
            </label>
            <select
              id="filter-meal"
              value={mealType}
              onChange={(e) => setMealType(e.target.value)}
              className="h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1115] text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              {MEALS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {user?.role === 'ADMIN' && (
            <label className="inline-flex items-center gap-2 h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer select-none">
              <input
                type="checkbox"
                checked={scopeAll}
                onChange={(e) => setScopeAll(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
              />
              <span>All Organizations (Admin)</span>
            </label>
          )}
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="h-10 px-3.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="h-10 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </section>

      {loading ? (
        <div className="space-y-6">
          <DashboardSkeleton />
          <TableRowsSkeleton rows={6} />
        </div>
      ) : summary && (
        <>
          {/* Summary Strip */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Filtered Prepared</p>
              <p className="font-mono text-xl font-semibold text-slate-900 dark:text-white mt-1">
                {summary.kpis.totalPreparedKg.toLocaleString()} kg
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Filtered Consumed</p>
              <p className="font-mono text-xl font-semibold text-slate-900 dark:text-white mt-1">
                {summary.kpis.totalConsumedKg.toLocaleString()} kg
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Filtered Leftover</p>
              <p className="font-mono text-xl font-semibold text-amber-600 dark:text-amber-400 mt-1">
                {summary.kpis.totalLeftoverKg.toLocaleString()} kg
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Period Waste Rate</p>
              <p className="font-mono text-xl font-semibold text-emerald-700 dark:text-emerald-400 mt-1">
                {summary.kpis.wastePct}%
              </p>
            </div>
          </section>

          {/* Meal Comparison Chart */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] p-5">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white mb-1">
                Waste Comparison by Meal Window
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Prepared vs. leftover volume across meal periods (kg)
              </p>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.byMealType} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="mealType" tick={{ fill: axisTickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: axisTickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="consumedKg" name="Consumed (kg)" fill="#16A34A" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="leftoverKg" name="Leftover (kg)" fill="#D97706" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] p-5">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white mb-1">
                Category Efficiency Breakdown
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Share of waste by food category
              </p>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {summary.byCategory.map((cat) => (
                  <div key={cat.category} className="py-3 flex items-center justify-between gap-4 text-sm">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{cat.category}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {cat.preparedKg.toLocaleString()} kg prepared <span aria-hidden="true">·</span> {cat.consumedKg.toLocaleString()} kg consumed
                      </p>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <p className="font-semibold text-slate-900 dark:text-white">{cat.leftoverKg} kg</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400">{cat.wastePct}% waste</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Detailed Table */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Filtered Service Records ({entries.length})
              </h2>
            </div>

            {entries.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
                No records match the selected date range and meal filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Meal</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-right">Headcount</th>
                      <th className="py-3 px-4 text-right">Prepared</th>
                      <th className="py-3 px-4 text-right">Consumed</th>
                      <th className="py-3 px-4 text-right">Leftover</th>
                      <th className="py-3 px-4 text-right">Waste %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                    {entries.slice(0, 60).map((row) => {
                      const wPct =
                        row.preparedKg > 0
                          ? ((row.leftoverKg / row.preparedKg) * 100).toFixed(1)
                          : '0.0';
                      return (
                        <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-4 font-mono text-xs tabular-nums text-slate-900 dark:text-white">
                            {row.date}
                          </td>
                          <td className="py-2.5 px-4 text-xs text-slate-700 dark:text-slate-300">
                            {row.mealType}
                          </td>
                          <td className="py-2.5 px-4 text-xs text-slate-700 dark:text-slate-300">
                            {row.category}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                            {row.headcount}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                            {row.preparedKg} kg
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                            {row.consumedKg} kg
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                            {row.leftoverKg} kg
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                            {wPct}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
