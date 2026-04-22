import { AppLayout } from '@/components/layout';

// CACHE_BUST_20260422_v3 - force new Next.js chunk hash
export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
