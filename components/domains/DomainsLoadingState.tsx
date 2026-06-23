export function DomainsLoadingState() {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-soft">
      <div className="border-b border-zinc-200 px-5 py-4">
        <div className="ml-auto h-10 w-full max-w-md rounded-md bg-zinc-100" />
      </div>
      <div className="divide-y divide-zinc-100">
        {[0, 1, 2, 3, 4].map((item) => (
          <div key={item} className="grid grid-cols-[1.2fr_1.4fr_0.8fr_0.6fr_0.8fr_1fr] gap-4 px-5 py-4">
            <div className="h-4 rounded-md bg-zinc-100" />
            <div className="h-4 rounded-md bg-zinc-100" />
            <div className="h-4 rounded-md bg-zinc-100" />
            <div className="h-4 rounded-md bg-zinc-100" />
            <div className="h-4 rounded-md bg-zinc-100" />
            <div className="h-4 rounded-md bg-zinc-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
