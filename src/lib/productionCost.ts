// Centralized production cost computation.
// Combines ingredient cost (per-unit) with overhead components and tax,
// honoring per-unit vs per-batch modes for each component.

export type CostMode = "per_unit" | "per_batch";
export type TaxMode = "percent" | "flat";
export type TaxBasis = "cost" | "mrp"; // 'mrp' = % applied to selling price (MRP)

export interface ProductionCostTemplate {
  packing_cover: number;
  packing_cover_mode: CostMode;
  label_cost: number;
  label_cost_mode: CostMode;
  labor_cost: number;
  labor_cost_mode: CostMode;
  machine_cost: number;
  machine_cost_mode: CostMode;
  eb_cost: number;
  eb_cost_mode: CostMode;
  utilities_cost: number;
  utilities_cost_mode: CostMode;
  shipping_cost: number;
  shipping_cost_mode: CostMode;
  tax_value: number;
  tax_mode: TaxMode;
  tax_basis: TaxBasis;
  default_batch_size: number;
}

export const DEFAULT_PRODUCTION_COST: ProductionCostTemplate = {
  packing_cover: 0,
  packing_cover_mode: "per_unit",
  label_cost: 0,
  label_cost_mode: "per_unit",
  labor_cost: 0,
  labor_cost_mode: "per_batch",
  machine_cost: 0,
  machine_cost_mode: "per_batch",
  eb_cost: 0,
  eb_cost_mode: "per_batch",
  utilities_cost: 0,
  utilities_cost_mode: "per_batch",
  shipping_cost: 0,
  shipping_cost_mode: "per_batch",
  tax_value: 0,
  tax_mode: "percent",
  tax_basis: "mrp",
  default_batch_size: 1,
};

export interface OverheadBreakdown {
  packing: number;
  label: number;
  labor: number;
  machine: number;
  eb: number;
  utilities: number;
  shipping: number;
  tax: number;
}

export interface ComputedCost {
  ingredientCostPerUnit: number;
  overheadCostPerUnit: number;
  taxPerUnit: number;
  totalCostPerUnit: number;
  totalBatchCost: number;
  breakdown: OverheadBreakdown;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function perUnit(value: number, mode: CostMode, batchSize: number): number {
  const v = Number(value) || 0;
  if (mode === "per_unit") return v;
  return batchSize > 0 ? v / batchSize : 0;
}

/**
 * Computes per-unit and per-batch cost.
 *
 * @param ingredientCostPerUnit ingredient cost per produced unit
 * @param template overhead template (nullable)
 * @param batchSize number of units in this batch (for amortizing per_batch costs)
 * @param opts optional overrides:
 *   - variantCoverCost: replaces template.packing_cover (per-unit) for this variant
 *   - sellingPrice: required when tax_basis === 'mrp' & tax_mode === 'percent'
 */
export function computeProductionCost(
  ingredientCostPerUnit: number,
  template: ProductionCostTemplate | null | undefined,
  batchSize: number,
  opts?: { variantCoverCost?: number; sellingPrice?: number }
): ComputedCost {
  const ingPerUnit = Number(ingredientCostPerUnit) || 0;
  const size = Math.max(batchSize || 0, 1);

  if (!template) {
    return {
      ingredientCostPerUnit: round2(ingPerUnit),
      overheadCostPerUnit: 0,
      taxPerUnit: 0,
      totalCostPerUnit: round2(ingPerUnit),
      totalBatchCost: round2(ingPerUnit * size),
      breakdown: { packing: 0, label: 0, labor: 0, machine: 0, eb: 0, utilities: 0, shipping: 0, tax: 0 },
    };
  }

  // Variant override: when a packaging variant is selected, its cover_cost
  // replaces the template's packing cover (treated as per-unit since covers are per pack).
  const packing =
    opts?.variantCoverCost !== undefined && opts.variantCoverCost !== null
      ? Number(opts.variantCoverCost) || 0
      : perUnit(template.packing_cover, template.packing_cover_mode, size);

  const label = perUnit(template.label_cost, template.label_cost_mode, size);
  const labor = perUnit(template.labor_cost, template.labor_cost_mode, size);
  const machine = perUnit(template.machine_cost, template.machine_cost_mode, size);
  const eb = perUnit(template.eb_cost, template.eb_cost_mode, size);
  const utilities = perUnit(template.utilities_cost, template.utilities_cost_mode, size);
  const shipping = perUnit(template.shipping_cost, template.shipping_cost_mode, size);

  const overheadBeforeTax = packing + label + labor + machine + eb + utilities + shipping;

  let taxPerUnit = 0;
  if (template.tax_mode === "percent") {
    const basisAmount =
      template.tax_basis === "mrp"
        ? Number(opts?.sellingPrice) || 0
        : ingPerUnit + overheadBeforeTax;
    taxPerUnit = basisAmount * ((Number(template.tax_value) || 0) / 100);
  } else {
    taxPerUnit = Number(template.tax_value) || 0;
  }

  const overheadPerUnit = overheadBeforeTax + taxPerUnit;
  const totalPerUnit = ingPerUnit + overheadPerUnit;

  return {
    ingredientCostPerUnit: round2(ingPerUnit),
    overheadCostPerUnit: round2(overheadPerUnit),
    taxPerUnit: round2(taxPerUnit),
    totalCostPerUnit: round2(totalPerUnit),
    totalBatchCost: round2(totalPerUnit * size),
    breakdown: {
      packing: round2(packing),
      label: round2(label),
      labor: round2(labor),
      machine: round2(machine),
      eb: round2(eb),
      utilities: round2(utilities),
      shipping: round2(shipping),
      tax: round2(taxPerUnit),
    },
  };
}
