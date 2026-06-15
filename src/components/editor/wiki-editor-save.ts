export function resolveWikiEditorSaveBody(
  getCurrentMarkdown: (() => string) | null,
  latestBody: string,
): string {
  return getCurrentMarkdown ? getCurrentMarkdown() : latestBody
}
