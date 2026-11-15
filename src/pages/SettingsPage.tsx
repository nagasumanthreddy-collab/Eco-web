import { Loader2, Shield } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { apiFetch } from '../lib/api.ts';
import type { AdminOrganization, OrganizationType, User } from '../types.ts';

const ORG_TYPES: OrganizationType[] = ['Restaurant', 'Hostel', 'Canteen', 'Event'];

export function SettingsPage() {
  const { user, setUser } = useAuth();
  const { showToast } = useToast();

  const [name, setName] = useState(user?.name || '');
  const [organizationName, setOrganizationName] = useState(user?.organizationName || '');
  const [organizationType, setOrganizationType] = useState<OrganizationType>(
    user?.organizationType || 'Canteen'
  );
  const [wasteAlertThreshold, setWasteAlertThreshold] = useState(
    String(user?.wasteAlertThreshold ?? 12)
  );
  const [emailAlerts, setEmailAlerts] = useState(Boolean(user?.emailAlerts));
  const [surplusAlerts, setSurplusAlerts] = useState(Boolean(user?.surplusAlerts));
  const [dailyDigest, setDailyDigest] = useState(Boolean(user?.dailyDigest));
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [orgs, setOrgs] = useState<AdminOrganization[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      setLoadingOrgs(true);
      apiFetch<{ organizations: AdminOrganization[] }>('/api/admin/organizations')
        .then((res) => setOrgs(res.organizations))
        .catch(() => {})
        .finally(() => setLoadingOrgs(false));
    }
  }, [user?.role]);

  const handleProfileSave = async (e: FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await apiFetch<{ user: User }>('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name: name.trim(),
          organizationName: organizationName.trim(),
          organizationType,
          wasteAlertThreshold: Number(wasteAlertThreshold),
          emailAlerts,
          surplusAlerts,
          dailyDigest,
        }),
      });
      setUser(res.user);
      showToast('Profile and notification preferences saved.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      showToast('Please enter both your current and new password.', 'error');
      return;
    }
    setSavingPassword(true);
    try {
      await apiFetch('/api/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      showToast('Password updated successfully.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Password update failed.', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Profile & Preferences */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] p-6">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Organization &amp; Notification Settings
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Signed in as {user?.email} <span aria-hidden="true">·</span> Role:{' '}
              {user?.role === 'ADMIN' ? 'Admin' : 'Vendor'}
            </p>
          </div>
        </div>

        <form onSubmit={handleProfileSave} className="mt-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="settings-name"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Full Name
              </label>
              <input
                id="settings-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1115] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="settings-org"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Organization Name
              </label>
              <input
                id="settings-org"
                type="text"
                required
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1115] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="settings-type"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Organization Type
              </label>
              <select
                id="settings-type"
                value={organizationType}
                onChange={(e) => setOrganizationType(e.target.value as OrganizationType)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1115] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                {ORG_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="settings-threshold"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Default Waste Alert Threshold (%)
              </label>
              <input
                id="settings-threshold"
                type="number"
                step="0.5"
                min="2"
                max="50"
                value={wasteAlertThreshold}
                onChange={(e) => setWasteAlertThreshold(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1115] font-mono text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div className="pt-2 space-y-2.5">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Notification Preferences
            </p>
            <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={emailAlerts}
                onChange={(e) => setEmailAlerts(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
              />
              <span>Threshold warning alerts when predicted waste exceeds limit</span>
            </label>
            <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={surplusAlerts}
                onChange={(e) => setSurplusAlerts(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
              />
              <span>Surplus NGO pickup confirmation updates</span>
            </label>
            <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={dailyDigest}
                onChange={(e) => setDailyDigest(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
              />
              <span>Daily morning kitchen prep recommendation digest</span>
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="px-5 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              {savingProfile && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </section>

      {/* Security / Change Password */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] p-6">
        <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white pb-4 border-b border-slate-200 dark:border-slate-800">
          Security &amp; Password
        </h2>
        <form onSubmit={handlePasswordChange} className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="current-password"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Current Password
            </label>
            <input
              id="current-password"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1115] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
          <div>
            <label
              htmlFor="new-password"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="8+ chars, upper, lower, number"
              className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1115] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={savingPassword}
              className="px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold inline-flex items-center gap-1.5"
            >
              {savingPassword && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Update Password</span>
            </button>
          </div>
        </form>
      </section>

      {/* Admin-Only RBAC Organization Oversight */}
      {user?.role === 'ADMIN' && (
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Admin Role Oversight: Registered Organizations
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Visible exclusively to Admin accounts
              </p>
            </div>
          </div>

          {loadingOrgs ? (
            <div className="p-6 text-xs text-slate-500">Loading organizations...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4">Organization</th>
                    <th className="py-3 px-4">Manager</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4 text-right">Logs</th>
                    <th className="py-3 px-4 text-right">Prepared</th>
                    <th className="py-3 px-4 text-right">Waste %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  {orgs.map((org) => (
                    <tr key={org.id}>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900 dark:text-white">
                          {org.organizationName}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {org.organizationType}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300">
                        {org.name} <span aria-hidden="true">·</span> {org.email}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono">{org.role}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {org.totalEntries}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {org.totalPreparedKg} kg
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                        {org.wastePct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
