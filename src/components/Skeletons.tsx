export function KpiGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] p-5 animate-pulse"
        >
          <div className="h-3.5 w-28 bg-slate-200 dark:bg-slate-800 rounded mb-3" />
          <div className="h-7 w-24 bg-slate-200 dark:bg-slate-800 rounded mb-2" />
          <div className="h-3 w-36 bg-slate-100 dark:bg-slate-800/70 rounded" />
        </div>
      ))}
    </div>
  );
}

export function TableRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] overflow-hidden">
      <div className="border-b border-slate-200 dark:border-slate-800 px-5 py-3.5 flex items-center justify-between">
        <div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        <div className="h-4 w-20 bg-slate-100 dark:bg-slate-800/70 rounded animate-pulse" />
      </div>
      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {Array.from({ length: rows }).map((_, idx) => (
          <div
            key={idx}
            className="px-5 py-3 flex items-center justify-between gap-4 animate-pulse"
          >
            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-4 w-32 bg-slate-100 dark:bg-slate-800/70 rounded" />
            <div className="h-4 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-4 w-16 bg-slate-100 dark:bg-slate-800/70 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <KpiGridSkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 h-80 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] p-5 animate-pulse">
          <div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded mb-4" />
          <div className="h-60 w-full bg-slate-100 dark:bg-slate-800/50 rounded-lg" />
        </div>
        <div className="h-80 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11191F] p-5 animate-pulse">
          <div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded mb-4" />
          <div className="h-60 w-full bg-slate-100 dark:bg-slate-800/50 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
