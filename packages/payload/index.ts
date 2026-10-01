// @acme/payload — THE ONLY client-side access to Payload content (§3).
// The CMS itself mounts inside apps/web ((payload) route group) once the
// database exists; generated types replace these when `payload generate:types` runs.

export interface PayloadClientConfig {
  /** Payload REST base, e.g. https://example.com/payload-api */
  baseUrl: string;
}

export interface PayloadListResponse<T> {
  docs: T[];
  totalDocs: number;
  page: number;
  totalPages: number;
}

/** Typed REST reader for published content (anon-readable collections only). */
export function createPayloadClient(config: PayloadClientConfig) {
  const get = async <T>(path: string): Promise<T> => {
    const res = await fetch(`${config.baseUrl}${path}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Payload request failed: ${res.status} ${path}`);
    return (await res.json()) as T;
  };

  return {
    find: <T>(collection: string, query = '') =>
      get<PayloadListResponse<T>>(`/${collection}${query ? `?${query}` : ''}`),
    findGlobal: <T>(slug: string) => get<T>(`/globals/${slug}`),
  };
}
