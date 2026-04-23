import { Skeleton } from "@/components/ui/skeleton";

export function ExecutiveDashboardSkeleton() {
  return (
    <div className="space-y-6 md:space-y-8">
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200/90 bg-card p-4 md:p-5 space-y-3 shadow-sm"
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-20 w-full rounded-2xl" />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-border p-4 space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-[320px] w-full" />
        </div>
        <div className="rounded-2xl border border-border p-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-[280px] w-full mt-2" />
        </div>
      </div>
      <Skeleton className="h-[300px] w-full rounded-2xl" />
      <div className="grid lg:grid-cols-2 gap-4">
        <Skeleton className="h-[340px] w-full rounded-2xl" />
        <Skeleton className="h-[340px] w-full rounded-2xl" />
      </div>
    </div>
  );
}
