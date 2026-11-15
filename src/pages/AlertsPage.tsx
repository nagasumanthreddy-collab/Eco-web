import { AlertTriangle, CheckCircle2, Loader2, SlidersHorizontal } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { TableRowsSkeleton } from '../components/Skeletons.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { apiFetch } from '../lib/api.ts';
import type { WasteAlertItem } from '../types.ts';

export function AlertsPage() {
  const [alerts, setAlerts] = useState<WasteAlertItem[]>([]);
  const [thresholdPct, setThresholdPct] = useState<number>(12);
  const [filter, setFilter] = useState<'ALL' | 'PREDICTION' | 'HISTORICAL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { user, setUser } = useAuth();
  const { showToast } = useToast();

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ alerts: WasteAlertItem[]; thresholdPct: number }>('/api/alerts');
      setAlerts(res.alerts);
      setThresholdPct(res.thresholdPct);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load waste alerts.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleSaveThreshold = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch<{ thresholdPct: number }>('/api/alerts/threshold', {
        method: 'PUT',
        body: JSON.stringify({ thresholdPct }),
      });
      if (user) {
        setUser({ ...user, wasteAlertThreshold: res.thresholdPct });
      }
      showToast(`Alert threshold updated to ${res.thresholdPct}%.`, 'success');
      await loadAlerts();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update threshold.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const visibleAlerts = alerts.filter((a) =>
    filter === 'ALL' ? true : a.source === filter
  );

  return (
    <div className="space-y-6">
      {/* Threshold Config + Filter Controls */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <form onSubmit={handleSaveThreshold} className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
            <SlidersHorizontal className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <label htmlFor="alert-threshold">Waste Alert Threshold (%):</label>
          </div>
          <input
            id="alert-threshold"
            type="number"
            min="2"
            max="50"
            step="0.5"
            value={thresholdPct}
            onChange={(e) => setThresholdPct(Number(e.target.value))}
            className="w-24 h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1115] font-mono text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
          <button
            type="submit"
            disabled={saving}
            className="h-10 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Apply Threshold</span>
          </button>
        </form>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800/70 w-fit">
          {(['ALL', 'PREDICTION', 'HISTORICAL'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                filter === tab
                  ? 'bg-white dark:bg-[#11191F] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab === 'ALL'
                ? 'All Alerts'
                : tab === 'PREDICTION'
                  ? 'Forecast Warnings'
                  : 'Recent Spikes'}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <TableRowsSkeleton rows={5} />
      ) : visibleAlerts.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] p-10 text-center">
          <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            No alerts triggered above {thresholdPct}%
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Upcoming forecasts and recent meal logs are within your waste target.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] divide-y divide-slate-200 dark:divide-slate-800">
          {visibleAlerts.map((alert) => (
            <div key={alert.id} className="p-5 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5 min-w-0">
                <AlertTriangle
                  className={`w-5 h-5 mt-0.5 shrink-0 ${
                    alert.severity === 'CRITICAL'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                />
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {alert.title}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {alert.source === 'PREDICTION' ? 'Forecast warning' : 'Logged spike'}{' '}
                    <span aria-hidden="true">·</span> {alert.date}{' '}
                    <span aria-hidden="true">·</span> {alert.mealType}{' '}
                    <span aria-hidden="true">·</span> Est. excess {alert.estimatedExcessKg} kg
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 pt-0.5">
                    {alert.recommendation}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0 tabular-nums">
                <span
                  className={`font-mono text-xs font-semibold block ${
                    alert.severity === 'CRITICAL'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {alert.severity}
                </span>
                <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
                  {alert.wastePct}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
