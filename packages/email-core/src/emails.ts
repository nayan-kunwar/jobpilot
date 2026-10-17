/**
 * Extract + dedupe email addresses from free-form text.
 * Pure module — safe to import from client components.
 */
export function parseEmails(text: string): string[] {
  const seen = new Set<string>();
  return (text.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) || []).filter(
    (e) => !seen.has(e.toLowerCase()) && (seen.add(e.toLowerCase()), true),
  );
}
