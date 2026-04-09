export default function InboxLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header skeleton */}
      <div className="mb-6 flex items-center justify-between">
        <div className="h-8 w-48 animate-pulse rounded-md bg-gray-200" />
        <div className="flex items-center gap-3">
          <div className="h-9 w-28 animate-pulse rounded-md bg-gray-200" />
          <div className="h-9 w-28 animate-pulse rounded-md bg-gray-200" />
        </div>
      </div>

      {/* DM list item skeletons */}
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4"
          >
            {/* Avatar skeleton */}
            <div className="h-10 w-10 flex-shrink-0 animate-pulse rounded-full bg-gray-200" />

            {/* Content skeleton */}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {/* Name and handle row */}
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-pulse rounded-full bg-gray-200" />
                <div className="h-4 w-28 animate-pulse rounded-md bg-gray-200" />
                <div className="h-3 w-20 animate-pulse rounded-md bg-gray-100" />
                <div className="h-4 w-4 animate-pulse rounded bg-gray-100" />
              </div>

              {/* Message preview skeleton */}
              <div className="space-y-1.5">
                <div className="h-3.5 w-full animate-pulse rounded bg-gray-100" />
                <div className="h-3.5 w-3/4 animate-pulse rounded bg-gray-100" />
              </div>

              {/* Status badge and timestamp row */}
              <div className="flex items-center gap-2">
                <div className="h-5 w-16 animate-pulse rounded-full bg-gray-200" />
                <div className="h-3 w-12 animate-pulse rounded bg-gray-100" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination skeleton */}
      <div className="mt-6 flex items-center justify-center gap-2">
        <div className="h-8 w-20 animate-pulse rounded-md bg-gray-200" />
        <div className="h-8 w-8 animate-pulse rounded-md bg-gray-200" />
        <div className="h-8 w-8 animate-pulse rounded-md bg-gray-200" />
        <div className="h-8 w-8 animate-pulse rounded-md bg-gray-200" />
        <div className="h-8 w-20 animate-pulse rounded-md bg-gray-200" />
      </div>
    </div>
  );
}