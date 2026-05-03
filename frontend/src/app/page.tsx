export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Vivindis</h1>
      <p className="max-w-md text-center text-muted-foreground text-sm">
        Oturum 1 iskeleti hazır. Bağlam için{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">VIVINDIS_SPEC.md</code>{" "}
        dosyasını okuyun; API ve dashboard sonraki oturumlarda eklenecek.
      </p>
    </main>
  );
}
