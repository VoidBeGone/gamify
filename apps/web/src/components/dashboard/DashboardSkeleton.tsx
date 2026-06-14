import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* header */}
      <div className="space-y-3">
        <div className="flex items-end justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-48" />
          </div>
          <Skeleton className="h-8 w-14 rounded-full" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>

      {/* pillar cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="space-y-3 pt-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-3 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* task list */}
      <Card>
        <CardContent className="space-y-3 pt-5">
          <Skeleton className="h-4 w-32" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded-md" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-5 w-12 rounded-md" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
