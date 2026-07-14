import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ReceiptItem } from "@/lib/ocrParser";
import { useToast } from "@/hooks/use-toast";
import { toBaseUnit, areUnitsCompatible, convertUnit } from "@/lib/unitConversion";
import { cascadeRecalcForIngredients } from "@/lib/cascadeRecalc";

interface BillSaveData {
  productId: string;
  supplierName?: string;
  billDate?: string;
  total: number;
  items: ReceiptItem[];
}

interface SaveResult {
  success: boolean;
  billId?: string;
  error?: string;
}

export function useBillSave() {
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const validateBill = (data: BillSaveData): string | null => {
    if (!data.productId) {
      return "Please select a product";
    }

    if (data.items.length === 0) {
      return "At least one item is required";
    }

    for (const item of data.items) {
      if (!item.name || item.name.trim().length < 2) {
        return "All items must have a valid name (at least 2 characters)";
      }
      if (item.qty <= 0) {
        return `Invalid quantity for "${item.name}". Quantity must be greater than 0`;
      }
      if (item.price <= 0) {
        return `Invalid price for "${item.name}". Price must be greater than 0`;
      }
    }

    if (data.total <= 0) {
      return "Total must be greater than 0";
    }

    return null;
  };

  const saveBill = async (data: BillSaveData): Promise<SaveResult> => {
    setIsSaving(true);

    try {
      // Validate
      const validationError = validateBill(data);
      if (validationError) {
        toast({
          title: "Validation Error",
          description: validationError,
          variant: "destructive",
        });
        return { success: false, error: validationError };
      }

      // Check authentication
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to save bills.",
          variant: "destructive",
        });
        return { success: false, error: "Not authenticated" };
      }

      // Recalculate total from items for consistency
      const computedTotal = data.items.reduce((sum, item) => sum + item.amount, 0);
      const finalTotal = Math.round(computedTotal * 100) / 100;

      // Insert bill
      const { data: bill, error: billError } = await supabase
        .from("bills")
        .insert({
          user_id: user.id,
          product_id: data.productId,
          supplier_name: data.supplierName || null,
          bill_date: data.billDate || null,
          total: finalTotal,
        })
        .select("id")
        .single();

      if (billError) {
        throw billError;
      }

      // Insert bill items
      const billItems = data.items.map((item) => ({
        bill_id: bill.id,
        item_name: item.name,
        quantity: item.qty,
        price: item.price,
        amount: item.amount,
      }));

      const { error: itemsError } = await supabase
        .from("bill_items")
        .insert(billItems);

      if (itemsError) {
        // Rollback bill if items fail
        await supabase.from("bills").delete().eq("id", bill.id);
        throw itemsError;
      }

      // Update product ingredients (aggregation logic with unit conversion)
      for (const item of data.items) {
        const itemUnit = item.unit || "kg";
        // Convert to base unit (kg or L) for storage
        const { quantity: baseQty, unit: baseUnit } = toBaseUnit(item.qty, itemUnit);
        // Price per base unit: total amount / base quantity
        const pricePerBaseUnit = baseQty > 0 ? Math.round((item.amount / baseQty) * 100) / 100 : 0;

        // Check if ingredient already exists for this product
        const { data: existing, error: fetchError } = await supabase
          .from("product_ingredients")
          .select("id, quantity, total_cost, total_purchased, unit")
          .eq("product_id", data.productId)
          .eq("ingredient_name", item.name.trim())
          .maybeSingle();

        if (fetchError) {
          console.error("Error checking ingredient:", fetchError);
          continue;
        }

        if (existing) {
          // Convert incoming quantity to match stored unit if needed
          const storedUnit = existing.unit || "kg";
          let qtyToAdd = baseQty;

          if (areUnitsCompatible(itemUnit, storedUnit)) {
            // Convert to stored unit
            const converted = convertUnit(item.qty, itemUnit, storedUnit);
            if (converted !== null) {
              qtyToAdd = converted;
            }
          }

          // Aggregate: increment quantity and total cost
          const newQuantity = Number(existing.quantity) + qtyToAdd;
          const newTotalCost = Number(existing.total_cost) + item.amount;
          const newPrice = newQuantity > 0 ? Math.round((newTotalCost / newQuantity) * 100) / 100 : 0;
          const newTotalPurchased = Number(existing.total_purchased || 0) + qtyToAdd;

          const { error: updateError } = await supabase
            .from("product_ingredients")
            .update({
              quantity: Math.round(newQuantity * 10000) / 10000,
              total_cost: Math.round(newTotalCost * 100) / 100,
              price: newPrice,
              total_purchased: Math.round(newTotalPurchased * 10000) / 10000,
            })
            .eq("id", existing.id);

          if (updateError) {
            console.error("Error updating ingredient:", updateError);
          }
        } else {
          // Create new ingredient entry in base unit
          const { error: insertError } = await supabase
            .from("product_ingredients")
            .insert({
              user_id: user.id,
              product_id: data.productId,
              ingredient_name: item.name.trim(),
              quantity: baseQty,
              unit: baseUnit,
              total_cost: item.amount,
              price: pricePerBaseUnit,
              total_purchased: baseQty,
            });

          if (insertError) {
            console.error("Error inserting ingredient:", insertError);
          }
        }
      }

      // Phase 4: cascade cost recalculation across all linked products
      try {
        await cascadeRecalcForIngredients(
          user.id,
          data.items.map((i) => i.name),
          bill.id
        );
      } catch (e) {
        console.error("Cascade recalc failed (non-fatal):", e);
      }

      toast({
        title: "Bill Saved!",
        description: `Bill with ${data.items.length} item(s) saved and inventory updated.`,
      });

      return { success: true, billId: bill.id };
    } catch (error: any) {
      console.error("Error saving bill:", error);
      toast({
        title: "Save Failed",
        description: "Failed to save bill. Please try again.",
        variant: "destructive",
      });
      return { success: false, error: "Failed to save bill" };

    } finally {
      setIsSaving(false);
    }
  };

  return { saveBill, isSaving, validateBill };
}
