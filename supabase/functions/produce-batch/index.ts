import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface BatchRequest {
  product_id: string;
  quantity: number;
  batch_size_mode?: "units" | "weight";
  batch_weight?: number | null;
  batch_weight_unit?: string | null;
  variant_id?: string | null;
}

// Unit conversion helpers
const UNIT_TO_BASE: Record<string, { base: string; factor: number }> = {
  kg: { base: "kg", factor: 1 },
  g: { base: "kg", factor: 0.001 },
  L: { base: "L", factor: 1 },
  l: { base: "L", factor: 1 },
  ml: { base: "L", factor: 0.001 },
  pcs: { base: "pcs", factor: 1 },
};

function convertUnit(quantity: number, fromUnit: string, toUnit: string): number | null {
  const from = UNIT_TO_BASE[fromUnit] || UNIT_TO_BASE[fromUnit.toLowerCase()];
  const to = UNIT_TO_BASE[toUnit] || UNIT_TO_BASE[toUnit.toLowerCase()];
  if (!from || !to || from.base !== to.base) return null;
  return Math.round((quantity * from.factor / to.factor) * 10000) / 10000;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      product_id,
      quantity,
      batch_size_mode,
      batch_weight,
      batch_weight_unit,
      variant_id,
    }: BatchRequest = await req.json();

    if (!product_id || typeof product_id !== "string" || !quantity || quantity <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid product_id or quantity" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const VALID_MODES = ["units", "weight"] as const;
    const VALID_UNITS = ["kg", "g", "L", "l", "ml", "pcs"] as const;
    if (batch_size_mode != null && !VALID_MODES.includes(batch_size_mode as any)) {
      return new Response(
        JSON.stringify({ error: "Invalid batch_size_mode" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (batch_weight_unit != null && !VALID_UNITS.includes(batch_weight_unit as any)) {
      return new Response(
        JSON.stringify({ error: "Invalid batch_weight_unit" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (batch_weight != null && (typeof batch_weight !== "number" || batch_weight < 0)) {
      return new Response(
        JSON.stringify({ error: "Invalid batch_weight" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (variant_id != null && typeof variant_id !== "string") {
      return new Response(
        JSON.stringify({ error: "Invalid variant_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    // Get recipe
    const { data: recipes, error: recipeError } = await supabase
      .from("product_recipes")
      .select("ingredient_name, quantity_required, unit")
      .eq("product_id", product_id)
      .eq("user_id", user.id);

    if (recipeError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch recipe" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!recipes || recipes.length === 0) {
      return new Response(
        JSON.stringify({ error: "No recipe defined for this product" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get inventory
    const { data: inventory, error: invError } = await supabase
      .from("product_ingredients")
      .select("id, ingredient_name, quantity, unit")
      .eq("product_id", product_id)
      .eq("user_id", user.id);

    if (invError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch inventory" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate requirements with unit conversion
    const insufficientIngredients: string[] = [];
    const deductions: { id: string; ingredient_name: string; new_quantity: number; quantity_used: number; unit: string }[] = [];

    for (const recipe of recipes) {
      const neededInRecipeUnit = recipe.quantity_required * quantity;
      const stock = inventory?.find(i => i.ingredient_name === recipe.ingredient_name);
      
      if (!stock) {
        insufficientIngredients.push(`${recipe.ingredient_name} not found in inventory`);
        continue;
      }

      // Convert needed quantity to stock's unit
      let neededInStockUnit = neededInRecipeUnit;
      if (recipe.unit !== stock.unit) {
        const converted = convertUnit(neededInRecipeUnit, recipe.unit, stock.unit);
        if (converted === null) {
          insufficientIngredients.push(
            `Unit mismatch for ${recipe.ingredient_name}: recipe uses ${recipe.unit}, inventory has ${stock.unit}`
          );
          continue;
        }
        neededInStockUnit = converted;
      }

      const available = Number(stock.quantity);

      if (available < neededInStockUnit) {
        insufficientIngredients.push(
          `Insufficient ${recipe.ingredient_name}: need ${neededInStockUnit.toFixed(4)} ${stock.unit}, have ${available.toFixed(4)} ${stock.unit}`
        );
      } else {
        deductions.push({
          id: stock.id,
          ingredient_name: recipe.ingredient_name,
          new_quantity: Math.round((available - neededInStockUnit) * 10000) / 10000,
          quantity_used: neededInStockUnit,
          unit: stock.unit,
        });
      }
    }

    if (insufficientIngredients.length > 0) {
      return new Response(
        JSON.stringify({ error: "Insufficient stock for production", details: insufficientIngredients }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create batch
    const { data: batch, error: batchError } = await supabase
      .from("batches")
      .insert({
        product_id,
        quantity_produced: quantity,
        user_id: user.id,
        status: "completed",
        batch_size_mode: batch_size_mode || "units",
        batch_weight: batch_weight ?? null,
        batch_weight_unit: batch_weight_unit ?? null,
        variant_id: variant_id ?? null,
      })
      .select("id")
      .single();

    if (batchError) {
      return new Response(
        JSON.stringify({ error: "Failed to create batch record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Perform deductions
    const updatePromises = deductions.map(d =>
      supabase
        .from("product_ingredients")
        .update({ quantity: d.new_quantity, updated_at: new Date().toISOString() })
        .eq("id", d.id)
    );

    const updateResults = await Promise.all(updatePromises);
    const updateErrors = updateResults.filter(r => r.error);

    if (updateErrors.length > 0) {
      return new Response(
        JSON.stringify({ error: "Partial deduction failure - please check inventory" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Record batch ingredients
    const batchIngredients = deductions.map(d => ({
      batch_id: batch.id,
      ingredient_name: d.ingredient_name,
      quantity_used: d.quantity_used,
      unit: d.unit,
    }));

    await supabase.from("batch_ingredients").insert(batchIngredients);

    return new Response(
      JSON.stringify({
        success: true,
        batch_id: batch.id,
        deductions: deductions.map(d => ({
          ingredient: d.ingredient_name,
          quantity_used: d.quantity_used,
          unit: d.unit,
        })),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
