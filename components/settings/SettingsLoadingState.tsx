export function SettingsLoadingState() {
  return (
    <div className="space-y-5">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="overflow-hidden rounded-lg border border-zinc-200 bg-white p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-zinc-100" />
            <div className="space-y-2">
              <div className="h-4 w-40 rounded-md bg-zinc-100" />
              <div className="h-3 w-64 rounded-md bg-zinc-100" />
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <div className="h-10 rounded-md bg-zinc-100" />
            <div className="h-10 rounded-md bg-zinc-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
