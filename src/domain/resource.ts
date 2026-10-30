/**
 * The workspace stores references, not data — that way one domain can carry a resource
 * belonging to another without knowing its shape.
 *
 * Format: `domain:kind/id?param=value`
 */
export type ResourceRef = {
  domain: string;
  kind: string;
  id?: string;
  params?: Readonly<Record<string, string>>;
};

const SEGMENT = /^[A-Za-z0-9_.~-]+$/;
const REF = /^([^:]+):([^/?]+)(?:\/([^?]*))?(?:\?(.*))?$/;

function parseParams(query: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const pair of query.split("&")) {
    const eq = pair.indexOf("=");
    if (eq > 0)
      params[decodeURIComponent(pair.slice(0, eq))] = decodeURIComponent(pair.slice(eq + 1));
  }
  return params;
}

export function isRef(value: unknown): value is ResourceRef {
  if (typeof value !== "object" || value === null) return false;
  const ref = value as ResourceRef;
  return (
    typeof ref.domain === "string" &&
    SEGMENT.test(ref.domain) &&
    typeof ref.kind === "string" &&
    SEGMENT.test(ref.kind)
  );
}

/** Params are sorted so that two equivalent refs produce the same text and `sameRef` works. */
export function formatRef(ref: ResourceRef): string {
  const id = ref.id ? `/${encodeURIComponent(ref.id)}` : "";
  const entries = Object.entries(ref.params ?? {})
    .filter(([, v]) => v !== "")
    .sort(([a], [b]) => a.localeCompare(b));
  const query = entries.length
    ? `?${entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&")}`
    : "";
  return `${ref.domain}:${ref.kind}${id}${query}`;
}

export function parseRef(text: string): ResourceRef | null {
  const match = REF.exec(text);
  if (!match) return null;

  const [, domain, kind, id, query] = match;
  if (!domain || !kind || !SEGMENT.test(domain) || !SEGMENT.test(kind)) return null;

  const params = query ? parseParams(query) : {};
  return {
    domain,
    kind,
    ...(id ? { id: decodeURIComponent(id) } : {}),
    ...(Object.keys(params).length ? { params } : {}),
  };
}

export function sameRef(a: ResourceRef, b: ResourceRef): boolean {
  return formatRef(a) === formatRef(b);
}

/** Merges instead of replacing; almost always one param changes and the rest are kept. */
export function withParams(ref: ResourceRef, params: Record<string, string>): ResourceRef {
  const merged = { ...(ref.params ?? {}), ...params };
  for (const [key, value] of Object.entries(merged)) if (value === "") delete merged[key];
  const { params: _, ...rest } = ref;
  return Object.keys(merged).length ? { ...rest, params: merged } : rest;
}

/** The resource with no params: tells whether two panels look at the same thing. */
export function rootRef(ref: ResourceRef): ResourceRef {
  return { domain: ref.domain, kind: ref.kind, ...(ref.id ? { id: ref.id } : {}) };
}
