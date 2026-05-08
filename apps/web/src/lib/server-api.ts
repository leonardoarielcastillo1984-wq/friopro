/**
 * Server-side API base URL helper.
 *
 * In Next.js route handlers (src/app/api/**) code runs on the Node.js server,
 * NOT in the browser.  Only env vars WITHOUT the NEXT_PUBLIC_ prefix are safe to
 * use here because they are resolved at runtime (not baked into the JS bundle).
 *
 * Priority:
 *  1. API_URL          — internal Docker network URL (e.g. http://api:4002)
 *  2. localhost:3002   — development fallback
 *
 * NEVER use NEXT_PUBLIC_API_URL in server-side code: when its value is a relative
 * path like "/api" it breaks server-to-server fetch calls.
 */
export function getServerApiBase(): string {
  const raw = process.env.API_URL || 'http://localhost:3002';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}
