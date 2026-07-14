import { describe, it, expect } from "vitest";
import { computeProductionCost, DEFAULT_PRODUCTION_COST } from "@/lib/productionCost";

describe("computeProductionCost", () => {
  it("returns ingredient-only cost when template is null", () => {
    const r = computeProductionCost(10, null, 5);
    expect(r.ingredientCostPerUnit).toBe(10);
    expect(r.overheadCostPerUnit).toBe(0);
    expect(r.totalCostPerUnit).toBe(10);
    expect(r.totalBatchCost).toBe(50);
  });

  it("adds per-unit components directly", () => {
    const r = computeProductionCost(20, {
      ...DEFAULT_PRODUCTION_COST,
      packing_cover: 5,
      packing_cover_mode: "per_unit",
      label_cost: 2,
      label_cost_mode: "per_unit",
      default_batch_size: 10,
    }, 10);
    // ingredient 20 + packing 5 + label 2 = 27 (no tax)
    expect(r.totalCostPerUnit).toBe(27);
    expect(r.overheadCostPerUnit).toBe(7);
  });

  it("amortizes per-batch components across batch size", () => {
    const r = computeProductionCost(0, {
      ...DEFAULT_PRODUCTION_COST,
      labor_cost: 500,
      labor_cost_mode: "per_batch",
      default_batch_size: 100,
    }, 100);
    // 500 / 100 = 5 per unit
    expect(r.overheadCostPerUnit).toBe(5);
    expect(r.totalBatchCost).toBe(500);
  });

  it("applies percent tax on (ingredient + overhead) when basis = cost", () => {
    const r = computeProductionCost(80, {
      ...DEFAULT_PRODUCTION_COST,
      packing_cover: 20,
      packing_cover_mode: "per_unit",
      tax_value: 10,
      tax_mode: "percent",
      tax_basis: "cost",
      default_batch_size: 1,
    }, 1);
    // base = 80 + 20 = 100, tax = 10, total = 110
    expect(r.taxPerUnit).toBe(10);
    expect(r.totalCostPerUnit).toBe(110);
  });

  it("applies percent tax on MRP when basis = mrp", () => {
    const r = computeProductionCost(80, {
      ...DEFAULT_PRODUCTION_COST,
      tax_value: 5,
      tax_mode: "percent",
      tax_basis: "mrp",
      default_batch_size: 1,
    }, 1, { sellingPrice: 200 });
    // 5% of MRP 200 = 10
    expect(r.taxPerUnit).toBe(10);
  });

  it("applies flat tax per unit", () => {
    const r = computeProductionCost(50, {
      ...DEFAULT_PRODUCTION_COST,
      tax_value: 7,
      tax_mode: "flat",
      default_batch_size: 1,
    }, 1);
    expect(r.taxPerUnit).toBe(7);
    expect(r.totalCostPerUnit).toBe(57);
  });

  it("combines per-unit + per-batch + percent tax correctly", () => {
    const r = computeProductionCost(40, {
      packing_cover: 5, packing_cover_mode: "per_unit",
      label_cost: 2, label_cost_mode: "per_unit",
      labor_cost: 500, labor_cost_mode: "per_batch",
      machine_cost: 200, machine_cost_mode: "per_batch",
      eb_cost: 100, eb_cost_mode: "per_batch",
      utilities_cost: 0, utilities_cost_mode: "per_batch",
      shipping_cost: 0, shipping_cost_mode: "per_batch",
      tax_value: 5, tax_mode: "percent",
      tax_basis: "cost",
      default_batch_size: 100,
    }, 100);
    // per-unit overhead: 5 + 2 + 5 + 2 + 1 = 15
    // base for tax: 40 + 15 = 55, tax = 2.75
    // total per unit: 57.75
    expect(r.overheadCostPerUnit).toBe(17.75);
    expect(r.totalCostPerUnit).toBe(57.75);
    expect(r.totalBatchCost).toBe(5775);
  });
});
