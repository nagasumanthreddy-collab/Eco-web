import { AlertTriangle, Calendar, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageBanner } from '../components/PageBanner.tsx';
import { DashboardSkeleton } from '../components/Skeletons.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { apiFetch } from '../lib/api.ts';
import { ASSETS } from '../lib/assets.ts';
import type { ForecastResponse } from '../types.ts';

const MEAL_FILTERS = ['All', 'Breakfast', 'Lunch', 'Dinner', 'Snacks'];

export function PredictionsPage() {
  const [mealType, setMealType] = useState('All');
  const [specialEvent, setSpecialEvent] = useState(false);
  const [eventLabel, setEventLabel] = useState('Campus Tech Fair');
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const { theme } = useTheme();

  useEffect(() => {
    let active = true;
    async function loadForecast() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          mealType,
          days: '7',
          specialEvent: String(specialEvent),
          eventLabel: specialEvent ? eventLabel : '',
        });
        const res = await apiFetch<ForecastResponse>(`/api/predictions/forecast?${params.toString()}`);
        if (active) setData(res);
      } catch {
        // handled cleanly below
      } finally {
        if (active) setLoading(false);
      }
    }
    loadForecast();
    return () => {
      active = false;
    };
  }, [mealType, specialEvent, eventLabel]);

  const axisTickColor = theme === 'dark' ? '#94A3B8' : '#64748B';
  const gridStroke = theme === 'dark' ? '#1E293B' : '#E2E8F0';
  const tooltipStyle = {
    backgroundColor: theme === 'dark' ? '#0F172A' : '#FFFFFF',
    borderColor: theme === 'dark' ? '#334155' : '#E2E8F0',
    borderRadius: '0.5rem',
    color: theme === 'dark' ? '#F8FAFC' : '#0F172A',
    fontSize: '12px',
  };

  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  const tomorrow = data?.tomorrow;
  const horizon = data?.horizon ?? [];
  const chartData = horizon.map((d) => ({
    ...d,
    range: [d.confidenceLowKg, d.confidenceHighKg],
  }));

  return (
    <div className="space-y-6">
      <PageBanner
        imageSrc={ASSETS.predictionDining}
        imageAlt="Modern institutional dining hall and canteen counter during busy lunch service"
        kicker="Demand Forecasting · 7-Day Horizon"
        title="Predict Diner Volume Before Firing the Kitchen"
        description="Combines an exponentially weighted moving average with weekday seasonality and special-event uplift to recommend optimal prep weights."
      />

      {/* Controls Toolbar */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-lg bg-slate-100 dark:bg-slate-800/70 w-fit">
          {MEAL_FILTERS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMealType(m)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                mealType === m
                  ? 'bg-white dark:bg-[#11191F] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 cursor-pointer select-none text-sm font-medium text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={specialEvent}
              onChange={(e) => setSpecialEvent(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
            />
            <span>Simulate Special Event Tomorrow</span>
          </label>
          {specialEvent && (
            <input
              type="text"
              aria-label="Event name"
              value={eventLabel}
              onChange={(e) => setEventLabel(e.target.value)}
              placeholder="Event name"
              className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1115] text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          )}
        </div>
      </section>

      {tomorrow && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Tomorrow Hero Prediction */}
          <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    Tomorrow · {tomorrow.dayName} ({tomorrow.date}) · {tomorrow.mealType}
                  </span>
                </p>
                <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                  Prepare {tomorrow.recommendedPrepKg} kg
                </h2>
              </div>
              {tomorrow.alertTriggered && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Current habit risks {tomorrow.expectedWasteWithCurrentHabitPct}% waste</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y border-slate-200 dark:border-slate-800 tabular-nums">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Expected Demand</p>
                <p className="font-mono text-lg font-semibold text-slate-900 dark:text-white mt-1">
                  {tomorrow.predictedConsumedKg} kg
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">90% Confidence Band</p>
                <p className="font-mono text-lg font-semibold text-slate-900 dark:text-white mt-1">
                  {tomorrow.confidenceLowKg}–{tomorrow.confidenceHighKg} kg
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Est. Headcount</p>
                <p className="font-mono text-lg font-semibold text-slate-900 dark:text-white mt-1">
                  {tomorrow.predictedHeadcount}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Optimal Waste Rate</p>
                <p className="font-mono text-lg font-semibold text-emerald-700 dark:text-emerald-400 mt-1">
                  {tomorrow.expectedWasteWithRecommendedPct}%
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-200">
                <Sparkles className="w-4 h-4 mt-0.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <p className="font-medium leading-relaxed">{tomorrow.explanation}</p>
              </div>

              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {tomorrow.factors.map((factor) => (
                  <div
                    key={factor.label}
                    className="py-2.5 flex items-center justify-between gap-4 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {factor.label}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 ml-2">
                        {factor.detail}
                      </span>
                    </div>
                    <span
                      className={`font-mono font-semibold tabular-nums ${
                        factor.impactPct >= 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {factor.impactPct >= 0 ? `+${factor.impactPct}%` : `${factor.impactPct}%`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tomorrow By Meal Breakdown */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] p-6">
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Tomorrow’s Prep by Meal
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
              Recommended target batch quantities per service window
            </p>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {data?.tomorrowByMeal.map((m) => (
                <div key={m.mealType} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {m.mealType}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      Range {m.confidenceLowKg}–{m.confidenceHighKg} kg <span aria-hidden="true">·</span> {m.predictedHeadcount} guests
                    </p>
                  </div>
                  <div className="text-right tabular-nums">
                    <p className="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                      {m.recommendedPrepKg} kg
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Demand {m.predictedConsumedKg} kg
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 7-Day Forecast Chart */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] p-6">
        <div className="mb-4">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            7-Day Demand &amp; Prep Horizon ({mealType})
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Shaded confidence envelope with recommended prep quantity vs. historical over-prep habit
          </p>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis
                dataKey="dayName"
                tick={{ fill: axisTickColor, fontSize: 11 }}
                tickFormatter={(v: string) => v.slice(0, 3)}
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
                dataKey="confidenceHighKg"
                name="Upper 90% Bound (kg)"
                stroke="none"
                fill="#16A34A"
                fillOpacity={0.14}
              />
              <Line
                type="monotone"
                dataKey="baselinePrepKg"
                name="Current Habit Prep (kg)"
                stroke="#D97706"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="recommendedPrepKg"
                name="Recommended Prep (kg)"
                stroke="#15803D"
                strokeWidth={2.5}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="predictedConsumedKg"
                name="Predicted Demand (kg)"
                stroke="#0284C7"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* 7-Day Table */}
        <div className="mt-6 overflow-x-auto border-t border-slate-200 dark:border-slate-800 pt-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Explanation</th>
                <th className="py-2.5 px-3 text-right">Predicted Demand</th>
                <th className="py-2.5 px-3 text-right">Recommended Prep</th>
                <th className="py-2.5 px-3 text-right">90% Interval</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              {horizon.map((day) => (
                <tr key={day.date}>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className="font-mono text-xs text-slate-900 dark:text-white tabular-nums">
                      {day.date}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                      {day.dayName.slice(0, 3)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-xs text-slate-600 dark:text-slate-300">
                    {day.explanation}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                    {day.predictedConsumedKg} kg
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                    {day.recommendedPrepKg} kg
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {day.confidenceLowKg}–{day.confidenceHighKg} kg
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
