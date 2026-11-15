import {
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Phone,
  Plus,
  Truck,
} from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { TableRowsSkeleton } from '../components/Skeletons.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { apiFetch } from '../lib/api.ts';
import type { NgoPartner, SurplusListing } from '../types.ts';

const CATEGORIES = [
  'Grains & Rice',
  'Proteins & Mains',
  'Produce & Salads',
  'Bakery & Pastry',
  'Dairy & Desserts',
];
const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
const STORAGE_TYPES = ['Refrigerated', 'Hot Hold', 'Ambient'];

export function SurplusPage() {
  const [listings, setListings] = useState<SurplusListing[]>([]);
  const [ngos, setNgos] = useState<NgoPartner[]>([]);
  const [loading, setLoading] = useState(true);

  // New surplus form
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Grains & Rice');
  const [quantityKg, setQuantityKg] = useState('10');
  const [mealType, setMealType] = useState('Lunch');
  const [expiryWindow, setExpiryWindow] = useState('Today, 19:30');
  const [storageType, setStorageType] = useState('Hot Hold');
  const [creating, setCreating] = useState(false);

  // Request pickup drawer/modal state
  const [activeSurplusId, setActiveSurplusId] = useState<string | null>(null);
  const [selectedNgoId, setSelectedNgoId] = useState('');
  const [pickupTime, setPickupTime] = useState('Today, 18:00');
  const [pickupNotes, setPickupNotes] = useState('');
  const [requesting, setRequesting] = useState(false);

  const { showToast } = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ listings: SurplusListing[]; ngos: NgoPartner[] }>(
        '/api/surplus'
      );
      setListings(res.listings);
      setNgos(res.ngos);
      if (res.ngos.length > 0) {
        setSelectedNgoId((prev) => prev || res.ngos[0].id);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load surplus listings.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateSurplus = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Please enter a food item title.', 'error');
      return;
    }
    setCreating(true);
    try {
      const res = await apiFetch<{ listing: SurplusListing }>('/api/surplus', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          category,
          quantityKg: Number(quantityKg),
          mealType,
          expiryWindow: expiryWindow.trim(),
          storageType,
        }),
      });
      setListings((prev) => [res.listing, ...prev]);
      setTitle('');
      setShowAddForm(false);
      showToast('Surplus batch published for NGO pickup.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to add surplus item.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleRequestPickup = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeSurplusId || !selectedNgoId) return;

    setRequesting(true);
    try {
      const res = await apiFetch<{ listing: SurplusListing }>(
        `/api/surplus/${activeSurplusId}/request-pickup`,
        {
          method: 'POST',
          body: JSON.stringify({
            ngoId: selectedNgoId,
            pickupTime,
            notes: pickupNotes,
          }),
        }
      );
      setListings((prev) =>
        prev.map((item) => (item.id === res.listing.id ? res.listing : item))
      );
      setActiveSurplusId(null);
      setPickupNotes('');
      showToast('Pickup request dispatched to NGO partner.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not schedule pickup.', 'error');
    } finally {
      setRequesting(false);
    }
  };

  const handleMarkCollected = async (id: string) => {
    try {
      const res = await apiFetch<{ listing: SurplusListing }>(`/api/surplus/${id}/collect`, {
        method: 'PATCH',
      });
      setListings((prev) => prev.map((item) => (item.id === id ? res.listing : item)));
      showToast('Marked as collected by partner NGO.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update status.', 'error');
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Left: Surplus Batches */}
      <section className="xl:col-span-7 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              Surplus Food Inventory
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Publish leftover edible batches and dispatch nearby rescue pickups
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddForm((s) => !s)}
            className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{showAddForm ? 'Close Form' : 'List Surplus'}</span>
          </button>
        </div>

        {showAddForm && (
          <form
            onSubmit={handleCreateSurplus}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] p-5 space-y-4"
          >
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
              Add Surplus Batch
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2">
                <label
                  htmlFor="surplus-title"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Batch Description
                </label>
                <input
                  id="surplus-title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Unserved Vegetable Biryani Trays"
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1115] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label
                  htmlFor="surplus-cat"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Category
                </label>
                <select
                  id="surplus-cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1115] text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="surplus-qty"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Quantity (kg)
                </label>
                <input
                  id="surplus-qty"
                  type="number"
                  step="0.5"
                  min="0.5"
                  required
                  value={quantityKg}
                  onChange={(e) => setQuantityKg(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1115] text-sm font-mono tabular-nums"
                />
              </div>

              <div>
                <label
                  htmlFor="surplus-meal"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Meal Service
                </label>
                <select
                  id="surplus-meal"
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1115] text-sm"
                >
                  {MEALS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="surplus-storage"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Storage Condition
                </label>
                <select
                  id="surplus-storage"
                  value={storageType}
                  onChange={(e) => setStorageType(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1115] text-sm"
                >
                  {STORAGE_TYPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="surplus-expiry"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Safe Pickup Window
                </label>
                <input
                  id="surplus-expiry"
                  type="text"
                  required
                  value={expiryWindow}
                  onChange={(e) => setExpiryWindow(e.target.value)}
                  placeholder="Today, 20:00"
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1115] text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Publish Surplus</span>
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <TableRowsSkeleton rows={5} />
        ) : listings.length === 0 ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] p-10 text-center">
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              No surplus food batches listed
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Click “List Surplus” whenever edible food remains after a meal service.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] divide-y divide-slate-200 dark:divide-slate-800">
            {listings.map((item) => {
              const latestRequest = item.pickupRequests[0];
              const isScheduling = activeSurplusId === item.id;

              return (
                <div key={item.id} className="p-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {item.category} <span aria-hidden="true">·</span> {item.quantityKg} kg{' '}
                        <span aria-hidden="true">·</span> {item.mealType}{' '}
                        <span aria-hidden="true">·</span> {item.storageType}{' '}
                        <span aria-hidden="true">·</span> Pickup by {item.expiryWindow}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      {item.status === 'AVAILABLE' && (
                        <button
                          type="button"
                          onClick={() =>
                            setActiveSurplusId(isScheduling ? null : item.id)
                          }
                          className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>Request pickup</span>
                        </button>
                      )}

                      {item.status === 'REQUESTED' && (
                        <button
                          type="button"
                          onClick={() => handleMarkCollected(item.id)}
                          className="px-3.5 py-2 rounded-lg border border-emerald-600 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-xs font-semibold whitespace-nowrap"
                        >
                          Mark collected
                        </button>
                      )}

                      {item.status === 'COLLECTED' && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Collected</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {latestRequest && (
                    <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2 pt-1">
                      <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>
                        Assigned to <strong>{latestRequest.ngo.name}</strong> ({latestRequest.pickupTime})
                        {latestRequest.notes ? ` · ${latestRequest.notes}` : ''}
                      </span>
                    </div>
                  )}

                  {isScheduling && (
                    <form
                      onSubmit={handleRequestPickup}
                      className="mt-3 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label
                            htmlFor={`ngo-${item.id}`}
                            className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                          >
                            Select NGO / Food Bank
                          </label>
                          <select
                            id={`ngo-${item.id}`}
                            value={selectedNgoId}
                            onChange={(e) => setSelectedNgoId(e.target.value)}
                            className="w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1115] text-xs"
                          >
                            {ngos.map((n) => (
                              <option key={n.id} value={n.id}>
                                {n.name} ({n.distanceKm} km)
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label
                            htmlFor={`time-${item.id}`}
                            className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                          >
                            Preferred Pickup Window
                          </label>
                          <input
                            id={`time-${item.id}`}
                            type="text"
                            required
                            value={pickupTime}
                            onChange={(e) => setPickupTime(e.target.value)}
                            className="w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1115] text-xs"
                          />
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor={`notes-${item.id}`}
                          className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                        >
                          Loading Bay / Courier Notes
                        </label>
                        <input
                          id={`notes-${item.id}`}
                          type="text"
                          value={pickupNotes}
                          onChange={(e) => setPickupNotes(e.target.value)}
                          placeholder="Gate code, packaging type, contact desk"
                          className="w-full h-9 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1115] text-xs"
                        />
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveSurplusId(null)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={requesting}
                          className="px-4 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                        >
                          {requesting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          <span>Confirm Dispatch</span>
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Right: Nearby NGOs & Food Banks */}
      <section className="xl:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] p-5">
        <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
          Verified Local NGOs &amp; Food Banks
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
          Sorted by distance from your kitchen facility
        </p>

        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {ngos.map((ngo) => (
            <div key={ngo.id} className="py-3.5 first:pt-0 last:pb-0 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {ngo.name}
                </h3>
                <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums shrink-0">
                  {ngo.distanceKm} km
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span>{ngo.address}</span>
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Accepts: {ngo.acceptedTypes} <span aria-hidden="true">·</span> Cap {ngo.dailyCapacityKg} kg/day
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 tabular-nums">
                <Phone className="w-3 h-3 shrink-0" />
                <span>
                  {ngo.contactPhone} <span aria-hidden="true">·</span> {ngo.operatingHours}
                </span>
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
