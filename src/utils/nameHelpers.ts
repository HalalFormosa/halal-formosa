export function formatDisplayName(name: string | null | undefined): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name;
  const first = parts[0];
  const initials = parts.slice(1).map(p => {
    const char = p.charAt(0);
    return char ? `${char.toUpperCase()}.` : "";
  }).filter(Boolean);
  return [first, ...initials].join(" ");
}
