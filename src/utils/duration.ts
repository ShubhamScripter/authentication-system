// Minimal "15m" / "7d" / "60s" -> milliseconds parser so we don't need an
// extra dependency just for JWT-style duration strings.
const UNIT_TO_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export const parseDurationToMs = (duration: string): number => {
  const match = /^(\d+)\s*(ms|s|m|h|d)$/i.exec(duration.trim());
  if (!match) {
    throw new Error(`Invalid duration string: "${duration}". Use formats like "15m", "7d", "60s".`);
  }
  const [, amount, unit] = match;
  return Number(amount) * UNIT_TO_MS[unit!.toLowerCase()]!;
};
