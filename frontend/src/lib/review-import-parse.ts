/** CSV / yapıştırılmış metinden yorum satırları — backend import ile uyumlu. */

const BODY_HEADERS = new Set(["body", "text", "yorum", "comment", "review", "message", "content"]);

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/^\ufeff/, "");
}

/** İlk sütun metin kabul edilir; başlıkta body/text/yorum/... varsa o sütun seçilir. */
export function parseReviewLinesFromCsv(text: string): { lines: string[]; error?: string } {
  const raw = text.trim();
  if (!raw) {
    return { lines: [], error: "empty" };
  }
  const rows = raw.split(/\r?\n/).filter((r) => r.trim().length > 0);
  if (rows.length === 0) {
    return { lines: [] };
  }
  const first = rows[0] ?? "";
  const delim = first.includes("\t") && !first.includes(",") ? "\t" : ",";
  const headerCells = first.split(delim).map((c) => normalizeHeader(c.replace(/^"|"$/g, "")));
  const hasHeader = headerCells.some((c) => BODY_HEADERS.has(c));
  let bodyCol = 0;
  if (hasHeader) {
    const idx = headerCells.findIndex((c) => BODY_HEADERS.has(c));
    bodyCol = idx >= 0 ? idx : 0;
  }
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const lines: string[] = [];
  for (const row of dataRows) {
    const cells = row.split(delim).map((c) => c.replace(/^"|"$/g, "").trim());
    const body = (cells[bodyCol] ?? "").trim();
    if (body.length >= 2) {
      lines.push(body);
    }
  }
  return { lines };
}

export function parseReviewLinesFromPaste(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}
