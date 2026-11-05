'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Gift, Copy, Check, Share2 } from 'lucide-react';

interface ReferralInfo {
  code: string;
  url: string;
  shareText: string;
  clicks: number;
  registered: number;
  rewarded: number;
  rewardDays: number;
}

/**
 * Card del loop de referidos (estilo Dropbox):
 * el tenant comparte su link; si alguien se registra con él,
 * el referente gana días extra y el referido +7 días de trial.
 */
export default function ReferralCard() {
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiFetch<ReferralInfo>('/api/referral/link')
      .then(setInfo)
      .catch(() => {}); // sin auth o sin endpoint: ocultar card
  }, []);

  if (!info) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(info.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'SGI 360', text: info.shareText, url: info.url });
      } else {
        await copy();
      }
    } catch { /* usuario canceló */ }
  };

  return (
    <div className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-brand-100 p-2.5">
          <Gift className="h-5 w-5 text-brand-600" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-neutral-900">
            Invitá otra empresa, ganá {info.rewardDays} días gratis
          </h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            Si se registran con tu link, vos sumás {info.rewardDays} días y ellos +7 de trial.
          </p>

          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700">
              {info.url}
            </code>
            <button
              onClick={copy}
              className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
              title="Copiar link"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
            <button
              onClick={share}
              className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-brand-700"
            >
              <Share2 className="h-3.5 w-3.5" /> Compartir
            </button>
          </div>

          {(info.clicks > 0 || info.registered > 0) && (
            <div className="mt-3 flex gap-4 text-xs text-neutral-500">
              <span><strong className="text-neutral-800">{info.clicks}</strong> clicks</span>
              <span><strong className="text-neutral-800">{info.registered}</strong> registrados</span>
              <span><strong className="text-green-700">{info.rewarded * info.rewardDays}</strong> días ganados</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
