function isPlainRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Recursively merge base with override. Override wins for leaves; missing keys in override keep base.
 */
export function deepMergeMessages(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const k of Object.keys(override)) {
    const oVal = override[k];
    const bVal = base[k];
    if (isPlainRecord(oVal) && isPlainRecord(bVal)) {
      out[k] = deepMergeMessages(bVal, oVal);
    } else {
      out[k] = oVal;
    }
  }
  return out;
}
