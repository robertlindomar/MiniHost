export function RecordsLoadingState() {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-soft">
      <div className="border-b border-zinc-200 px-5 py-4">
        <div className="h-5 w-52 rounded-md bg-zinc-100" />
      </div>
      <div className="divide-y divide-zinc-100">
        {[0, 1, 2, 3, 4].map((item) => (
          <div key={item} className="grid grid-cols-[0.4fr_1fr_1fr_1.4fr_0.6fr_0.7fr_0.8fr_1fr] gap-4 px-5 py-4">
            <div className="h-5 rounded-md bg-zinc-100" />
            <div className="h-5 rounded-md bg-zinc-100" />
            <div className="h-5 rounded-md bg-zinc-100" />
            <div className="h-5 rounded-md bg-zinc-100" />
            <div className="h-5 rounded-md bg-zinc-100" />
            <div className="h-5 rounded-md bg-zinc-100" />
            <div className="h-5 rounded-md bg-zinc-100" />
            <div className="h-5 rounded-md bg-zinc-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
