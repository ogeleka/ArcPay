import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-gray-100", className)} />;
}

// Column widths as Tailwind classes so we avoid inline style prop issues
const COL_WIDTHS = ["w-28", "w-20", "w-16", "w-24", "w-28", "w-10"];

/** Full payments-table skeleton - matches the real table column layout */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden">
      <div className="bg-gray-50 px-6 py-3 flex gap-4">
        {COL_WIDTHS.map((w, i) => (
          <Skeleton key={i} className={cn("h-3", w)} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-t border-gray-100 px-6 py-3.5 flex gap-4 items-center">
          {COL_WIDTHS.map((w, j) => (
            <Skeleton key={j} className={cn("h-3.5", w)} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Stats-row skeleton */
export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-white shadow-sm p-5 space-y-2">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-2.5 w-16" />
        </div>
      ))}
    </div>
  );
}
