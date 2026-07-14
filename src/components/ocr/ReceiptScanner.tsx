import { useState, useCallback, useRef } from "react";
import Tesseract from "tesseract.js";
import { Scan, FileText, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { ImageUploader } from "./ImageUploader";
import { ScanProgress } from "./ScanProgress";
import { EditableItemsTable } from "./EditableItemsTable";
import { InlineCostRevisionPanel } from "./InlineCostRevisionPanel";
import { ProductSelector } from "@/components/products/ProductSelector";
import { smartParseReceipt, ReceiptItem } from "@/lib/ocrParser";
import { useToast } from "@/hooks/use-toast";
import { useBillSave } from "@/hooks/useBillSave";
import { useCostRevision, RecipeIngredient } from "@/hooks/useCostRevision";
import { Product } from "@/hooks/useProducts";

export function ReceiptScanner() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [ocrTotal, setOcrTotal] = useState<number | null>(null);
  const [computedTotal, setComputedTotal] = useState<number>(0);
  const [hasTotalMismatch, setHasTotalMismatch] = useState(false);
  const [totalDiscrepancy, setTotalDiscrepancy] = useState(0);
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "success" | "error">("idle");
  const [scanProgress, setScanProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const { toast } = useToast();
  const { saveBill, isSaving } = useBillSave();
  const { saveRevision, calculateRevision } = useCostRevision();

  // Inline cost revision state
  const costIngredientsRef = useRef<RecipeIngredient[]>([]);
  const costSellingPriceRef = useRef<number>(0);
  const [costAllFilled, setCostAllFilled] = useState(false);
  const [hasRecipe, setHasRecipe] = useState(true);

  const handleProductChange = (productId: string | null, product: Product | null) => {
    setSelectedProductId(productId);
    setSelectedProduct(product);
    // Reset cost state when product changes
    costIngredientsRef.current = [];
    costSellingPriceRef.current = 0;
    setCostAllFilled(false);
    setHasRecipe(true);
  };

  const handleCostIngredientsChange = useCallback(
    (ingredients: RecipeIngredient[], sellingPrice: number, allFilled: boolean) => {
      costIngredientsRef.current = ingredients;
      costSellingPriceRef.current = sellingPrice;
      setCostAllFilled(allFilled);
      setHasRecipe(ingredients.length > 0);
    },
    []
  );

  const handleImageSelect = useCallback((file: File) => {
    setImageFile(file);
    setItems([]);
    setOcrTotal(null);
    setComputedTotal(0);
    setHasTotalMismatch(false);
    setTotalDiscrepancy(0);
    setScanStatus("idle");
    setScanProgress(0);
  }, []);

  const extractTextFromImage = async () => {
    if (!imageFile) return;
    setScanStatus("scanning");
    setScanProgress(0);

    try {
      const result = await Tesseract.recognize(imageFile, "eng", {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setScanProgress(Math.round(m.progress * 100));
            setProgressMessage("Analyzing receipt...");
          } else if (m.status === "loading tesseract core") {
            setProgressMessage("Loading OCR engine...");
          } else if (m.status === "initializing api") {
            setProgressMessage("Initializing...");
          }
        },
      });

      const text = result.data.text;
      const parsed = smartParseReceipt(text);

      setItems(parsed.items);
      setOcrTotal(parsed.ocrTotal);
      setComputedTotal(parsed.computedTotal);
      setHasTotalMismatch(parsed.hasTotalMismatch);
      setTotalDiscrepancy(parsed.totalDiscrepancy);
      setScanStatus("success");

      if (parsed.items.length === 0) {
        toast({ title: "No items detected", description: "Try uploading a clearer image or add items manually." });
      } else {
        toast({ title: "Scan complete!", description: `Found ${parsed.items.length} item${parsed.items.length > 1 ? "s" : ""}.` });
      }
    } catch (error) {
      console.error("OCR Error:", error);
      setScanStatus("error");
      toast({ title: "Scan failed", description: "There was an error processing the image. Please try again.", variant: "destructive" });
    }
  };

  const handleItemsChange = useCallback((newItems: ReceiptItem[]) => {
    setItems(newItems);
    const newComputedTotal = newItems.reduce((sum, item) => sum + item.amount, 0);
    const roundedTotal = Math.round(newComputedTotal * 100) / 100;
    setComputedTotal(roundedTotal);

    if (ocrTotal !== null) {
      const discrepancy = Math.abs(ocrTotal - roundedTotal);
      const tolerance = ocrTotal * 0.01;
      setHasTotalMismatch(discrepancy > tolerance);
      setTotalDiscrepancy(Math.round(discrepancy * 100) / 100);
    }
  }, [ocrTotal]);

  const handleSaveClick = async () => {
    if (!selectedProductId) {
      toast({ title: "Product Required", description: "Please select a product before saving the bill.", variant: "destructive" });
      return;
    }


    const costIngredients = costIngredientsRef.current;
    const sellingPrice = costSellingPriceRef.current;

    const result = await saveBill({ productId: selectedProductId, total: computedTotal, items });

    if (result.success && result.billId && costIngredients.length > 0 && sellingPrice !== undefined) {
      const revision = calculateRevision(costIngredients, sellingPrice);
      await saveRevision(selectedProductId, result.billId, costIngredients, revision);
    }

    if (result.success) {
      if (sellingPrice !== undefined && sellingPrice > 0) {
        const { supabase } = await import("@/integrations/supabase/client");
        await supabase.from("products").update({ selling_price: sellingPrice }).eq("id", selectedProductId);
      }

      // Reset all state
      setImageFile(null);
      setItems([]);
      setOcrTotal(null);
      setComputedTotal(0);
      setHasTotalMismatch(false);
      setTotalDiscrepancy(0);
      setScanStatus("idle");
      setSelectedProductId(null);
      setSelectedProduct(null);
      costIngredientsRef.current = [];
      costSellingPriceRef.current = 0;
      setCostAllFilled(false);
      setHasRecipe(true);
    }
  };

  const canSave = items.length > 0 && selectedProductId !== null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Upload Section */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Upload Receipt
          </CardTitle>
          <CardDescription>Upload a receipt image to automatically extract items</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ImageUploader onImageSelect={handleImageSelect} disabled={scanStatus === "scanning"} />
          <ScanProgress status={scanStatus} progress={scanProgress} message={progressMessage} />
          <Button
            onClick={extractTextFromImage}
            disabled={!imageFile || scanStatus === "scanning"}
            className="w-full gradient-primary text-primary-foreground"
            size="lg"
          >
            {scanStatus === "scanning" ? <>Scanning...</> : (<><Scan className="h-4 w-4 mr-2" />Scan Receipt</>)}
          </Button>
          <Alert className="border-muted bg-muted/50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              For best results, ensure the receipt is well-lit and text is clearly visible.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Results Section */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5 text-primary" />
            Detected Items
          </CardTitle>
          <CardDescription>Review and edit extracted items before saving</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Product Selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Select Product <span className="text-destructive">*</span>
            </Label>
            <ProductSelector value={selectedProductId} onChange={handleProductChange} disabled={isSaving} />
            {selectedProduct && (
              <p className="text-xs text-muted-foreground">
                Ingredients will be added to: <strong>{selectedProduct.name}</strong>
              </p>
            )}
            {items.length > 0 && !selectedProductId && (
              <p className="text-xs text-destructive">Please select a product before saving</p>
            )}
          </div>

          {/* Inline Cost Revision Panel — only when product selected */}
          {selectedProductId && selectedProduct && (
            <InlineCostRevisionPanel
              productId={selectedProductId}
              productName={selectedProduct.name}
              onIngredientsChange={handleCostIngredientsChange}
            />
          )}


          <EditableItemsTable
            items={items}
            ocrTotal={ocrTotal}
            computedTotal={computedTotal}
            hasTotalMismatch={hasTotalMismatch}
            totalDiscrepancy={totalDiscrepancy}
            onItemsChange={handleItemsChange}
            onSave={canSave ? handleSaveClick : undefined}
            isSaving={isSaving}
          />
        </CardContent>
      </Card>
    </div>
  );
}
