import { apiPath } from './api';

export type GrowthEventName =
  | 'PAGE_VIEW' | 'TOOL_VIEW' | 'LEAD_SUBMITTED'
  | 'REGISTER_STARTED' | 'REGISTER_COMPLETED'
  | 'REFERRAL_CLICK' | 'VALIDATE_DOC' | 'UNSUBSCRIBE';

/**
 * Tracking de funnel — best-effort, nunca rompe UX.
 * Usa sendBeacon si está disponible (sobrevive a navegación),
 * fallback a fetch keepalive. El backend responde 204 siempre.
 */
export function track(event: GrowthEventName, page?: string, meta?: Record<string, unknown>) {
  try {
    const url = apiPath('/api/track');
    const body = JSON.stringify({ event, page, meta });
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(url, blob)) return;
    }
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'omit',
    }).catch(() => {});
  } catch {
    /* tracking nunca rompe UX */
  }
}

/** Click de referido — persiste el código y avisa al backend. */
export function trackReferralClick(code: string) {
  try {
    fetch(apiPath('/api/referrals/click'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
      keepalive: true,
      credentials: 'omit',
    }).catch(() => {});
  } catch { /* noop */ }
}
