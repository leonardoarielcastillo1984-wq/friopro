'use client';

import { AuthProvider } from '@/lib/auth-context';
import { CompanyProvider } from '@/lib/company-context';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <CompanyProvider>
        {children}
      </CompanyProvider>
    </AuthProvider>
  );
}
