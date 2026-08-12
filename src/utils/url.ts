/**
 * External-link helpers for `Edges(external)` kinds (`part-supplier-link`).
 *
 * Its own module, not the manifest, so a unit test can reach it: a manifest imports
 * its `.tsx` renderer, and `vitest.config.ts` has no Solid JSX transform.
 */

/**
 * Normalize a user-entered external link, or `null` if it isn't one we will render
 * as an `href`.
 *
 * Load-bearing, not cosmetic: the value is typed by a user and put straight into an
 * anchor, so `javascript:` / `data:` must never survive this. Only `http`/`https`
 * pass. A bare `example.com/part` is assumed `https` — that is how people type a
 * supplier URL, and refusing it would make the field feel broken.
 */
export function safeHttpUrl(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    let parsed: URL;
    try {
        parsed = new URL(candidate);
    } catch {
        return null;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.href;
}

/** Compact display form of an external link — host + path, no scheme. */
export function displayUrl(raw: string): string {
    const safe = safeHttpUrl(raw);
    if (!safe) return raw;
    const { host, pathname, search } = new URL(safe);
    const tail = `${pathname === '/' ? '' : pathname}${search}`;
    return `${host}${tail}`;
}
