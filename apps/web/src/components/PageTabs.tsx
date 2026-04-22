'use client';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { type LucideIcon } from 'lucide-react';

export interface TabDef {
  key: string;
  label: string;
  icon?: LucideIcon;
}

interface Props {
  tabs: TabDef[];
  paramKey?: string;
  children: (activeTab: string) => React.ReactNode;
}

function PageTabsInner({ tabs, paramKey = 'tab', children }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = searchParams.get(paramKey) || tabs[0]?.key || '';

  function setTab(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(paramKey, key);
    router.replace(`?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-neutral-200">
        <nav className="flex gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = active === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-brand-600 text-brand-700'
                    : 'border-transparent text-neutral-500 hover:text-neutral-800 hover:border-neutral-300'
                }`}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>
      <div>{children(active)}</div>
    </div>
  );
}

export default function PageTabs(props: Props) {
  return (
    <Suspense fallback={<div className="h-12 bg-neutral-100 animate-pulse rounded" />}>
      <PageTabsInner {...props} />
    </Suspense>
  );
}
