export function AppsSkeleton() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="h-28 animate-pulse rounded-lg border border-border bg-muted/50"
        />
      ))}
    </ul>
  );
}
