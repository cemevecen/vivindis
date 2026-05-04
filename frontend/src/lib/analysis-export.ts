import type { AnalysisDto } from "@/types/analysis";

function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowsToCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

/** Düz metrik tablosu — Excel’de açılabilir. */
export function buildAnalysisSummaryCsv(result: Record<string, unknown> | null | undefined): string {
  if (!result || typeof result !== "object") {
    return rowsToCsv([["key", "value"]]);
  }
  const rows: string[][] = [["key", "value"]];
  const overall = result.overall_score;
  rows.push(["overall_score", overall == null ? "" : String(overall)]);

  const sent = result.sentiment;
  if (sent && typeof sent === "object") {
    for (const [k, v] of Object.entries(sent as Record<string, unknown>)) {
      rows.push([`sentiment.${k}`, v == null ? "" : String(v)]);
    }
  }

  const rd = result.rating_distribution;
  if (rd && typeof rd === "object") {
    for (const [k, v] of Object.entries(rd as Record<string, unknown>)) {
      rows.push([`rating_distribution.${k}`, v == null ? "" : String(v)]);
    }
  }

  const topics = result.top_topics;
  if (Array.isArray(topics)) {
    topics.forEach((item, i) => {
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        rows.push([
          `top_topics.${i}`,
          `${String(o.topic ?? "")} | count=${String(o.count ?? "")} | sentiment=${String(o.sentiment ?? "")}`,
        ]);
      }
    });
  }

  return rowsToCsv(rows);
}

export function triggerDownload(filename: string, body: string, mime: string): void {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadAnalysisJson(fetchId: string, kind: AnalysisDto["type"], row: AnalysisDto | undefined): void {
  if (!row?.result) {
    return;
  }
  const body = JSON.stringify(row.result, null, 2);
  triggerDownload(`vivindis-${kind}-${fetchId}.json`, body, "application/json;charset=utf-8");
}

export function downloadAnalysisCsvExport(fetchId: string, kind: AnalysisDto["type"], row: AnalysisDto | undefined): void {
  if (!row?.result || typeof row.result !== "object") {
    return;
  }
  const csv = buildAnalysisSummaryCsv(row.result as Record<string, unknown>);
  triggerDownload(`vivindis-${kind}-${fetchId}.csv`, csv, "text/csv;charset=utf-8");
}
