import { Leaf } from 'lucide-react';
import { useState } from 'react';

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<AppLogoProps['size']>, string> = {
  sm: 'w-7 h-7 rounded-md',
  md: 'w-8 h-8 rounded-lg',
  lg: 'w-10 h-10 rounded-xl',
  xl: 'w-24 h-24 rounded-2xl',
};

export function AppLogo({ size = 'md', className = '' }: AppLogoProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`${SIZE_CLASSES[size]} bg-emerald-700 dark:bg-emerald-600 flex items-center justify-center text-white shrink-0 ${className}`}
      >
        <Leaf className={size === 'xl' ? 'w-11 h-11' : 'w-4 h-4'} />
      </div>
    );
  }

  return (
    <img
      src="/src/assets/images/ecopredict_logo_1794735323792.jpg"
      alt="EcoPredict logo"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${SIZE_CLASSES[size]} object-cover shrink-0 select-none ${className}`}
    />
  );
}
