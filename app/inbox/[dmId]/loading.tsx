export default function DMDetailLoading() {
  return (
    <div className="flex h-full w-full gap-6 p-6 animate-fade-in">
      {/* Left Column: DM Content + Draft Composer */}
      <div className="flex flex-1 flex-col gap-6">
        {/* DM Content Skeleton */}
        <div className="card space-y-4">
          {/* Sender Info */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
            <div className="flex flex-col gap-1.5">
              <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
              <div className="flex items-center gap-2">
                <div className="h-3 w-20 animate-pulse rounded bg-gray-100" />
                <div className="h-4 w-4 animate-pulse rounded bg-gray-100" />
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="h-5 w-16 animate-pulse rounded-full bg-gray-200" />
              <div className="h-3 w-14 animate-pulse rounded bg-gray-100" />
            </div>
          </div>

          {/* Message Content */}
          <div className="space-y-2 pt-2">
            <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
          </div>
        </div>

        {/* Draft Composer Skeleton */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-5 w-28 animate-pulse rounded bg-gray-200" />
            <div className="flex items-center gap-2">
              <div className="h-5 w-20 animate-pulse rounded-full bg-gray-100" />
              <div className="h-3 w-16 animate-pulse rounded bg-gray-100" />
            </div>
          </div>

          {/* Text Area Placeholder */}
          <div className="h-32 w-full animate-pulse rounded-md bg-gray-100" />

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-9 w-20 animate-pulse rounded-md bg-gray-200" />
              <div className="h-9 w-20 animate-pulse rounded-md bg-gray-200" />
              <div className="h-9 w-24 animate-pulse rounded-md bg-gray-200" />
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Context Panel + Lead Sidebar */}
      <div className="flex w-80 flex-shrink-0 flex-col gap-6">
        {/* Context Panel Skeleton */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-14 animate-pulse rounded bg-gray-100" />
          </div>

          <div className="flex items-center gap-1.5">
            <div className="h-5 w-16 animate-pulse rounded-full bg-gray-200" />
            <div className="h-5 w-12 animate-pulse rounded-full bg-gray-200" />
          </div>

          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="flex items-center gap-2">
                  <div className="h-5 w-16 animate-pulse rounded-full bg-gray-200" />
                  <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
                </div>
                <div className="mt-2 flex gap-1">
                  <div className="h-4 w-12 animate-pulse rounded bg-gray-100" />
                  <div className="h-4 w-14 animate-pulse rounded bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Lead Info Skeleton */}
        <div className="card space-y-4">
          <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />

          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="h-3 w-16 animate-pulse rounded bg-gray-100" />
                <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
              </div>
            ))}
          </div>

          <div className="pt-2">
            <div className="h-9 w-full animate-pulse rounded-md bg-gray-200" />
          </div>
        </div>
      </div>
    </div>
  );
}