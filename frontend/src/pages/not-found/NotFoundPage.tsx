import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
      <h1 className="text-2xl font-bold text-ink">404</h1>
      <p className="mt-2 text-ink-muted">Sayfa bulunamadı.</p>
      <Link to="/" className="mt-6 inline-block text-sm font-semibold text-brand-600 hover:underline">
        Ana sayfaya dön
      </Link>
    </div>
  );
}
