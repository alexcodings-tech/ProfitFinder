import { useState } from "react";
import { Trash2, Plus, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReceiptItem } from "@/lib/ocrParser";
import { cn } from "@/lib/utils";
import { toBaseUnit } from "@/lib/unitConversion";

// Price is treated as per base unit (per kg / per L / per pcs).
// So amount = qty (converted to base unit) * price.
function computeAmount(qty: number, price: number, unit: string): number {
  const { quantity: baseQty } = toBaseUnit(qty || 0, unit || "kg");
  return Math.round(baseQty * (price || 0) * 100) / 100;
}

interface EditableItemsTableProps {
  items: ReceiptItem[];
  ocrTotal: number | null;
  computedTotal: number;
  hasTotalMismatch: boolean;
  totalDiscrepancy: number;
  onItemsChange: (items: ReceiptItem[]) => void;
  onSave?: () => void;
  isSaving?: boolean;
}

export function EditableItemsTable({
  items,
  ocrTotal,
  computedTotal,
  hasTotalMismatch,
  totalDiscrepancy,
  onItemsChange,
  onSave,
  isSaving = false,
}: EditableItemsTableProps) {
  const displayTotal = computedTotal;

  const handleItemChange = (
    id: string,
    field: keyof Omit<ReceiptItem, "id">,
    value: string
  ) => {
    const updated = items.map((item) => {
      if (item.id !== id) return item;
      
      if (field === "qty" || field === "price") {
        const numValue = Number(value) || 0;
        const newItem = { ...item, [field]: numValue };
        newItem.amount = computeAmount(newItem.qty, newItem.price, newItem.unit || "kg");
        return newItem;
      }
      
      return { ...item, [field]: value };
    });
    
    onItemsChange(updated);
  };

  const handleUnitChange = (id: string, unit: string) => {
    const updated = items.map((item) => {
      if (item.id !== id) return item;
      const newItem = { ...item, unit };
      newItem.amount = computeAmount(newItem.qty, newItem.price, unit);
      return newItem;
    });
    onItemsChange(updated);
  };

  const addNewRow = () => {
    const newItem: ReceiptItem = {
      id: Math.random().toString(36).substring(2, 11),
      name: "",
      qty: 0,
      price: 0,
      amount: 0,
      unit: "kg",
    };
    onItemsChange([...items, newItem]);
  };

  const deleteRow = (id: string) => {
    onItemsChange(items.filter((item) => item.id !== id));
  };

  // Validation check
  const isValid = items.length > 0 && items.every(item => 
    item.name.trim().length >= 2 && item.qty > 0 && item.price > 0
  );

  if (items.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-border rounded-lg bg-muted/30">
        <p className="text-muted-foreground mb-4">No items detected yet</p>
        <Button onClick={addNewRow} variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Item Manually
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in w-full">
      <div className="rounded-lg border border-border overflow-x-auto shadow-card">
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-table-header hover:bg-table-header">
              <TableHead className="font-semibold w-auto">Item Name</TableHead>
              <TableHead className="font-semibold text-center w-20">Qty</TableHead>
              <TableHead className="font-semibold text-center w-20">Unit</TableHead>
              <TableHead className="font-semibold text-right w-28">Price (₹/kg or L)</TableHead>
              <TableHead className="font-semibold text-right w-28">Amount</TableHead>
              <TableHead className="w-12 text-center"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id} className="transition-colors">
                <TableCell className="py-1 px-2">
                  <Input
                    value={item.name}
                    onChange={(e) => handleItemChange(item.id, "name", e.target.value)}
                    className="h-8 w-full bg-transparent border-transparent hover:border-input focus:border-input"
                    placeholder="Item name"
                  />
                </TableCell>
                <TableCell className="py-1 px-1">
                  <Input
                    type="number"
                    value={item.qty || ""}
                    onChange={(e) => handleItemChange(item.id, "qty", e.target.value)}
                    className="h-8 w-full text-center bg-transparent border-transparent hover:border-input focus:border-input"
                    min={0}
                    placeholder="Qty"
                  />
                </TableCell>
                <TableCell className="py-1 px-1">
                  <Select
                    value={item.unit || "kg"}
                    onValueChange={(val) => handleUnitChange(item.id, val)}
                  >
                    <SelectTrigger className="h-8 w-full text-xs px-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="g">g</SelectItem>
                      <SelectItem value="L">L</SelectItem>
                      <SelectItem value="ml">ml</SelectItem>
                      <SelectItem value="pcs">pcs</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="py-1 px-1">
                  <Input
                    type="number"
                    value={item.price || ""}
                    onChange={(e) => handleItemChange(item.id, "price", e.target.value)}
                    className="h-8 w-full text-right bg-transparent border-transparent hover:border-input focus:border-input"
                    min={0}
                    step={0.01}
                    placeholder="Price"
                  />
                </TableCell>
                <TableCell className="py-1 px-1 text-right font-mono text-sm text-foreground whitespace-nowrap">
                  ₹{item.amount.toFixed(2)}
                </TableCell>
                <TableCell className="py-1 px-1 text-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => deleteRow(item.id)}
                    disabled={isSaving}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Total Row */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border shadow-soft">
        <div className="space-y-1">
          <span className="text-lg font-semibold text-foreground">Total</span>
          {ocrTotal !== null && ocrTotal !== computedTotal && (
            <p className="text-xs text-muted-foreground">
              OCR: ₹{ocrTotal.toFixed(2)} | Computed: ₹{computedTotal.toFixed(2)}
            </p>
          )}
        </div>
        <span className={cn(
          "text-2xl font-bold font-mono",
          hasTotalMismatch ? "text-destructive" : "text-primary"
        )}>
          ₹{displayTotal.toFixed(2)}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={addNewRow} variant="outline" size="sm" disabled={isSaving}>
          <Plus className="h-4 w-4 mr-2" />
          Add Row
        </Button>
        {onSave && (
          <Button 
            onClick={onSave} 
            size="sm" 
            className="gradient-primary text-primary-foreground"
            disabled={!isValid || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save & Update Inventory
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
