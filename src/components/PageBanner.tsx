import { Leaf } from 'lucide-react';
import { useState, type ReactNode } from 'react';

interface PageBannerProps {
  imageSrc: string;
  imageAlt: string;
  kicker: string;
  title: string;
  description: string;
  action?: ReactNode;
}

export function PageBanner({
  imageSrc,
  imageAlt,
  kicker,
  title,
  description,
  action,
}: PageBannerProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <section className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900 min-h-[156px] sm:min-h-[172px] flex items-end">
      {!imgError ? (
        <img
          src={imageSrc}
          alt={imageAlt}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 flex items-center justify-end pr-8">
          <Leaf className="w-16 h-16 text-emerald-700/30" />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/70 to-slate-950/35" />

      <div className="relative z-10 w-full p-5 sm:p-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="max-w-2xl space-y-1">
          <p className="text-xs font-medium text-emerald-300">{kicker}</p>
          <h2 className="font-display text-lg sm:text-xl font-bold text-white leading-snug [text-wrap:balance]">
            {title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
            {description}
          </p>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </section>
  );
}
