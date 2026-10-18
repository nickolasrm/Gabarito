export const UNITS = { mm: 1, cm: 10, m: 1000, in: 25.4, ft: 304.8 } as const;
export type Unit = keyof typeof UNITS;
export function parseDimensions(
  text: string,
  unit: Unit,
  arity: 1 | 2 = 1,
): number[] {
  const parts = text.trim().split(/[,;]/);
  if (parts.length !== arity)
    throw new Error(arity === 2 ? "Enter width,depth" : "Enter one dimension");
  return parts.map((part) => {
    const match = part
      .trim()
      .match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(mm|cm|m|in|ft)?$/i);
    if (!match)
      throw new Error(
        "Use a number with an optional unit: mm, cm, m, in or ft",
      );
    const value =
      Number(match[1]) * UNITS[(match[2]?.toLowerCase() ?? unit) as Unit];
    if (!Number.isFinite(value) || Math.abs(value) < 1e-5)
      throw new Error("Dimension must be finite and nonzero");
    return value;
  });
}
