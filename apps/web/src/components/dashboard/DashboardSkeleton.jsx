// VIPOS — Skeleton placeholder while dashboard data loads.
export default function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-7 w-56 rounded bg-gray-200" />
      <div className="h-9 w-72 rounded bg-gray-100" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-gray-100" />
        ))}
      </div>

      <div className="h-40 rounded-2xl bg-gray-100" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-72 rounded-2xl bg-gray-100" />
        <div className="h-72 rounded-2xl bg-gray-100" />
      </div>
    </div>
  );
}
