export type HealthResponse = { status: string; service?: string };

export async function fetchHealth(): Promise<HealthResponse> {
  const r = await fetch("/api/v1/health");
  if (!r.ok) throw new Error(`health ${r.status}`);
  return r.json() as Promise<HealthResponse>;
}
