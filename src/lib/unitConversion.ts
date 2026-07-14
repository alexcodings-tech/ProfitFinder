/**
 * Unit conversion utility for ingredient management.
 * Supports: kg ↔ g, L ↔ ml, pcs (no conversion)
 */

type MassUnit = "kg" | "g";
type VolumeUnit = "L" | "ml";
type CountUnit = "pcs";
type SupportedUnit = MassUnit | VolumeUnit | CountUnit;

const UNIT_TO_BASE: Record<string, { base: string; factor: number }> = {
  kg: { base: "kg", factor: 1 },
  g: { base: "kg", factor: 0.001 },
  L: { base: "L", factor: 1 },
  ml: { base: "L", factor: 0.001 },
  l: { base: "L", factor: 1 },
  pcs: { base: "pcs", factor: 1 },
};

/**
 * Converts a quantity from one unit to another.
 * Returns null if units are incompatible.
 */
export function convertUnit(
  quantity: number,
  fromUnit: string,
  toUnit: string
): number | null {
  const from = UNIT_TO_BASE[fromUnit] || UNIT_TO_BASE[fromUnit.toLowerCase()];
  const to = UNIT_TO_BASE[toUnit] || UNIT_TO_BASE[toUnit.toLowerCase()];

  if (!from || !to) return null;
  if (from.base !== to.base) return null;

  // Convert: fromUnit → base → toUnit
  const baseValue = quantity * from.factor;
  const result = baseValue / to.factor;
  return Math.round(result * 10000) / 10000; // 4 decimal precision
}

/**
 * Normalizes quantity to base unit (kg or L).
 */
export function toBaseUnit(quantity: number, unit: string): { quantity: number; unit: string } {
  const info = UNIT_TO_BASE[unit] || UNIT_TO_BASE[unit.toLowerCase()];
  if (!info) return { quantity, unit };
  return {
    quantity: Math.round(quantity * info.factor * 10000) / 10000,
    unit: info.base,
  };
}

/**
 * Checks if two units are compatible (same family).
 */
export function areUnitsCompatible(unitA: string, unitB: string): boolean {
  const a = UNIT_TO_BASE[unitA] || UNIT_TO_BASE[unitA.toLowerCase()];
  const b = UNIT_TO_BASE[unitB] || UNIT_TO_BASE[unitB.toLowerCase()];
  if (!a || !b) return false;
  return a.base === b.base;
}

/**
 * Format quantity with appropriate precision.
 */
export function formatQuantity(quantity: number, unit: string): string {
  // For g and ml, show whole numbers if possible
  if ((unit === "g" || unit === "ml") && quantity >= 1) {
    return Number.isInteger(quantity) ? quantity.toString() : quantity.toFixed(1);
  }
  // For kg and L, show up to 3 decimal places
  const rounded = Math.round(quantity * 1000) / 1000;
  return rounded.toString();
}

/**
 * Get a human-friendly display for a quantity + unit.
 * Automatically picks best unit (e.g. 0.5 kg stays kg, but 50 g stays g).
 */
export function displayQuantity(quantity: number, unit: string): string {
  return `${formatQuantity(quantity, unit)} ${unit}`;
}
