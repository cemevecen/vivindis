/**
 * Mağaza arama / çözümleme / yorum çekme — backend `/api/v1/apps/*` hazır.
 * Gelişmiş tablo ve filtreler burada genişletilecek.
 */
export function StoreExplorerPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-ink">Mağaza</h1>
      <p className="max-w-2xl text-sm text-ink-muted">
        Bu sayfa iskelet aşamasında. Arama, uygulama seçimi ve tarih aralığı ile yorum çekme akışı
        burada toplanacak; veri zaten{" "}
        <code className="text-xs">POST /api/v1/apps/search</code>,{" "}
        <code className="text-xs">/resolve</code>, <code className="text-xs">/fetch-reviews</code>{" "}
        uçlarıyla sunuluyor.
      </p>
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center text-sm text-ink-muted">
        Sonraki sprint: arama kutusu, sonuç listesi, seçilen uygulama özeti, çekilen havuz önizlemesi.
      </div>
    </div>
  );
}
