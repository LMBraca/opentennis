export interface NovemberFixtureContent {
  readonly body: string;
  readonly excerpt: string | null;
}

export function cleanNovemberFixtureContent(
  content: NovemberFixtureContent,
): NovemberFixtureContent {
  return {
    body: content.body
      .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
      .replace(/&lt;script\b[\s\S]*?&lt;\/script\s*&gt;/gi, ''),
    excerpt: content.excerpt?.replace(/\bpista\b/gi, 'Cancha') ?? null,
  };
}
