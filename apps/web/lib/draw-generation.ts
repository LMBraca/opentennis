export const BULK_DRAW_STATUSES = ['draft', 'ready', 'published'] as const;

export function isBulkDrawEligible(status: string): boolean {
  return BULK_DRAW_STATUSES.some((eligibleStatus) => eligibleStatus === status);
}

export function drawResultSnapshot(results: readonly (readonly [string, number])[]): string {
  return results
    .filter(([, resultCount]) => resultCount > 0)
    .sort(([eventA], [eventB]) => eventA.localeCompare(eventB))
    .map(([eventId, resultCount]) => `${eventId}:${resultCount}`)
    .join('|');
}
