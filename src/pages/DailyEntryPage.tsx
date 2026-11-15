import { Loader2, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { PageBanner } from '../components/PageBanner.tsx';
import { TableRowsSkeleton } from '../components/Skeletons.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { apiFetch } from '../lib/api.ts';
import type { DailyEntry } from '../types.ts';

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
const CATEGORIES = [
  'Grains & Rice',
  'Proteins & Mains',
  'Produce & Salads',
  'Bakery & Pastry',
  'Dairy & Desserts',
];

export function DailyEntryPage() {
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [mealType, setMealType] = useState('Lunch');
  const [category, setCategory] = useState('Grains & Rice');
  const [preparedKg, setPreparedKg] = useState('65');
  const [consumedKg, setConsumedKg] = useState('58');
  const [leftoverOverride, setLeftoverOverride] = useState('');
  const [headcount, setHeadcount] = useState('250');
  const [costPerKg, setCostPerKg] = useState('4.80');
  const [isSpecialEvent, setIsSpecialEvent] = useState(false);
  const [eventLabel, setEventLabel] = useState('');
  const [notes, setNotes] = useState('');

  const { showToast } = useToast();

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ entries: DailyEntry[] }>('/api/entries');
      setEntries(res.entries);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load entries', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const prepNum = Number(preparedKg) || 0;
  const consNum = Number(consumedKg) || 0;
  const computedLeftover = Math.max(0, Number((prepNum - consNum).toFixed(1)));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (prepNum <= 0) {
      showToast('Prepared weight must be greater than 0 kg.', 'error');
      return;
    }
    if (consNum < 0 || consNum > prepNum) {
      showToast('Consumed weight must be between 0 and prepared weight.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch<{ entry: DailyEntry }>('/api/entries', {
        method: 'POST',
        body: JSON.stringify({
          date,
          mealType,
          category,
          preparedKg: prepNum,
          consumedKg: consNum,
          leftoverKg: leftoverOverride !== '' ? Number(leftoverOverride) : computedLeftover,
          headcount: Number(headcount) || 1,
          costPerKg: Number(costPerKg) || 4.8,
          isSpecialEvent,
          eventLabel: isSpecialEvent ? eventLabel : null,
          notes,
        }),
      });
      setEntries((prev) => [res.entry, ...prev]);
      setLeftoverOverride('');
      setEventLabel('');
      setNotes('');
      setIsSpecialEvent(false);
      showToast(`Logged ${res.entry.mealType} entry for ${res.entry.date}.`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save entry.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/entries/${id}`, { method: 'DELETE' });
      setEntries((prev) => prev.filter((item) => item.id !== id));
      showToast('Entry removed.', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete entry.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageBanner
        imageSrc="/src/assets/images/entry_prep_scale_1794736952427.jpg"
        imageAlt="Chef weighing freshly prepped vegetables and grains on a stainless steel digital kitchen scale"
        kicker="Data Capture · Batch Weighing"
        title="Log Meal Preparation, Consumption & Leftovers"
        description="Recording post-service batch weights, diner headcount, and campus events calibrates the 28-day weighted forecasting engine."
      />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Entry Form */}
      <section className="xl:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] p-6">
        <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
          Log Daily Service Record
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-5">
          Feed accurate preparation and consumption figures into the weighted demand engine.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label
                htmlFor="entry-date"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Service Date
              </label>
              <input
                id="entry-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1115] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="entry-meal"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Meal Type
              </label>
              <select
                id="entry-meal"
                value={mealType}
                onChange={(e) => setMealType(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1115] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                {MEAL_TYPES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="entry-category"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Food Category
            </label>
            <select
              id="entry-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1115] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="entry-prepared"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Prepared (kg)
              </label>
              <input
                id="entry-prepared"
                type="number"
                step="0.1"
                min="0.1"
                required
                value={preparedKg}
                onChange={(e) => setPreparedKg(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1115] text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="entry-consumed"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Consumed (kg)
              </label>
              <input
                id="entry-consumed"
                type="number"
                step="0.1"
                min="0"
                required
                value={consumedKg}
                onChange={(e) => setConsumedKg(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1115] text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="entry-leftover"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Leftover (kg)
              </label>
              <input
                id="entry-leftover"
                type="number"
                step="0.1"
                min="0"
                value={leftoverOverride}
                onChange={(e) => setLeftoverOverride(e.target.value)}
                placeholder={String(computedLeftover)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1115] text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label
                htmlFor="entry-headcount"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Diner Headcount
              </label>
              <input
                id="entry-headcount"
                type="number"
                min="1"
                required
                value={headcount}
                onChange={(e) => setHeadcount(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1115] text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="entry-cost"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Unit Cost ($ / kg)
              </label>
              <input
                id="entry-cost"
                type="number"
                step="0.1"
                min="0.5"
                value={costPerKg}
                onChange={(e) => setCostPerKg(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1115] text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div className="pt-1">
            <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isSpecialEvent}
                onChange={(e) => setIsSpecialEvent(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
              />
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                Special Event or Campus Holiday
              </span>
            </label>
          </div>

          {isSpecialEvent && (
            <div>
              <label
                htmlFor="entry-event-label"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Event Name
              </label>
              <input
                id="entry-event-label"
                type="text"
                value={eventLabel}
                onChange={(e) => setEventLabel(e.target.value)}
                placeholder="e.g., Freshman Orientation, Annual Banquet"
                className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1115] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="entry-notes"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Operational Notes (optional)
            </label>
            <input
              id="entry-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Weather impact, menu switch, or batch adjustment"
              className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1115] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-11 rounded-lg bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{submitting ? 'Saving record...' : 'Save Daily Entry'}</span>
          </button>
        </form>
      </section>

      {/* Recent Logs Table */}
      <section className="xl:col-span-7">
        {loading ? (
          <TableRowsSkeleton rows={8} />
        ) : entries.length === 0 ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] p-10 text-center">
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              No daily entries logged yet
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Use the form on the left to record your first kitchen meal log.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  Recent Kitchen Logs
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  Showing {Math.min(entries.length, 25)} of {entries.length} records
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4">Date &amp; Meal</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Prepared</th>
                    <th className="py-3 px-4 text-right">Consumed</th>
                    <th className="py-3 px-4 text-right">Waste</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  {entries.slice(0, 25).map((item) => {
                    const wastePct =
                      item.preparedKg > 0
                        ? ((item.leftoverKg / item.preparedKg) * 100).toFixed(1)
                        : '0.0';
                    const isHigh = Number(wastePct) >= 12;
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="font-mono text-xs text-slate-900 dark:text-white tabular-nums">
                            {item.date}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {item.mealType}
                            {item.isSpecialEvent && (
                              <>
                                {' '}
                                <span aria-hidden="true">·</span>{' '}
                                <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                                  {item.eventLabel || 'Special Event'}
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300">
                          {item.category}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                          {item.preparedKg} kg
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                          {item.consumedKg} kg
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono tabular-nums font-medium ${
                            isHigh
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {item.leftoverKg} kg ({wastePct}%)
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            aria-label={`Delete entry from ${item.date}`}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
      </div>
    </div>
  );
}
