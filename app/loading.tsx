export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
        Loading Noon...
      </div>
    </main>
  );
}
