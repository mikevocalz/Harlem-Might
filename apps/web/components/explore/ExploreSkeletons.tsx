'use client';

import { LoadingSkeleton } from '@acme/ui';
import { View } from '@acme/ui/tw';

/**
 * Fallbacks that mirror the regions they stand in for, so the page shape is
 * right before any data lands. Everything is wrapped in `hm-suspense-in`,
 * which holds opacity at 0 for the first 250 ms — a fast catalogue shows no
 * skeleton at all instead of a flash.
 */

function RowSkeleton() {
  return (
    <View className="flex-row items-start gap-4 border-b border-b-rule-hairline px-5 py-4">
      <LoadingSkeleton variant="custom" className="mt-2 size-2.5 shrink-0 rotate-45" />
      <View className="min-w-0 flex-1 gap-2">
        <LoadingSkeleton className="w-2/5" />
        <LoadingSkeleton className="w-3/5" />
      </View>
    </View>
  );
}

/** The master pane's search bar, chips and first rows. */
export function MasterSkeleton() {
  return (
    <View className="hm-suspense-in w-full border-rule-hairline md:w-pane-primary md:shrink-0 md:border-r">
      <View className="gap-3 border-b border-rule-hairline p-4 md:gap-4 md:p-5">
        <LoadingSkeleton className="hidden h-8 w-24 md:block" />
        <LoadingSkeleton variant="custom" className="h-12 w-full" />
        <View className="flex-row gap-2">
          <LoadingSkeleton variant="custom" className="h-8 w-14 rounded-full" />
          <LoadingSkeleton variant="custom" className="h-8 w-14 rounded-full" />
          <LoadingSkeleton variant="custom" className="h-8 w-14 rounded-full" />
          <LoadingSkeleton variant="custom" className="h-8 w-14 rounded-full" />
        </View>
        <LoadingSkeleton className="w-1/3" />
      </View>
      <View>
        {Array.from({ length: 8 }, (_, i) => (
          <RowSkeleton key={i} />
        ))}
      </View>
    </View>
  );
}
