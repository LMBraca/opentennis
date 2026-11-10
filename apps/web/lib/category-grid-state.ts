export function isOfferedButNotGenerated(
  status: string,
  matchCount: number,
  entrantCount: number,
): boolean {
  return status === 'draft' && matchCount === 0 && entrantCount > 0;
}
