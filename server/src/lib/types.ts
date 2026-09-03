// Shared value types. Mirrors the Prisma enum without importing the generated
// client into pure logic modules, so the maths stays testable on its own.
export type SourceType = 'bottle' | 'small_glass' | 'large_glass' | 'custom';

export const SOURCE_TYPES: readonly SourceType[] = [
  'bottle',
  'small_glass',
  'large_glass',
  'custom',
];

export function isSourceType(value: unknown): value is SourceType {
  return typeof value === 'string' && (SOURCE_TYPES as readonly string[]).includes(value);
}
