import { parseReviewLinesFromCsv } from "@/lib/review-import-parse";

/** İlk sayfa → CSV metnine çevirip mevcut CSV ayrıştırıcıyı kullanır (xlsx/xls). */
export async function parseReviewFile(file: File): Promise<{ lines: string[]; errorKey?: "parseEmpty" | "parseFailed" }> {
  const name = file.name.toLowerCase();
  try {
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) {
        return { lines: [], errorKey: "parseEmpty" };
      }
      const sheet = wb.Sheets[sheetName];
      if (!sheet) {
        return { lines: [], errorKey: "parseEmpty" };
      }
      const csv = XLSX.utils.sheet_to_csv(sheet);
      const { lines, error } = parseReviewLinesFromCsv(csv);
      if (error === "empty" || lines.length === 0) {
        return { lines: [], errorKey: "parseEmpty" };
      }
      return { lines };
    }
    const text = await file.text();
    const { lines, error } = parseReviewLinesFromCsv(text);
    if (error === "empty" && lines.length === 0) {
      return { lines: [], errorKey: "parseEmpty" };
    }
    return { lines };
  } catch {
    return { lines: [], errorKey: "parseFailed" };
  }
}
