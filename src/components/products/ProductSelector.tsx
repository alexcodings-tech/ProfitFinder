import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProducts, Product } from "@/hooks/useProducts";
import { cn } from "@/lib/utils";

interface ProductSelectorProps {
  value: string | null;
  onChange: (productId: string | null, product: Product | null) => void;
  disabled?: boolean;
}

export function ProductSelector({ value, onChange, disabled }: ProductSelectorProps) {
  const { products, isLoading, createProduct } = useProducts();
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newSellingPrice, setNewSellingPrice] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);

  const selectedProduct = products.find((p) => p.id === value);

  const handleCreateProduct = async () => {
    const price = parseFloat(newSellingPrice);
    if (!newProductName.trim() || !price || price <= 0) return;

    setIsCreating(true);
    const product = await createProduct(newProductName, price);
    setIsCreating(false);

    if (product) {
      onChange(product.id, product);
      setDialogOpen(false);
      setNewProductName("");
      setNewSellingPrice("");
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled || isLoading}
          >
            {selectedProduct ? selectedProduct.name : "Select a product..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0 bg-popover border-border" align="start">
          <Command>
            <CommandInput placeholder="Search products..." />
            <CommandList>
              <CommandEmpty>No products found.</CommandEmpty>
              <CommandGroup>
                {products.map((product) => (
                  <CommandItem
                    key={product.id}
                    value={product.name}
                    onSelect={() => {
                      onChange(product.id, product);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === product.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {product.name}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setOpen(false);
                    setDialogOpen(true);
                  }}
                  className="text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create new product
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Create New Product</DialogTitle>
            <DialogDescription>
              Add a new product to track its ingredients and costs.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="product-name">Product Name</Label>
              <Input
                id="product-name"
                placeholder="e.g., ABC Malt, Orange Juice"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="selling-price">
                Selling Price (₹) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="selling-price"
                type="number"
                min={0}
                step="0.01"
                placeholder="e.g., 150"
                value={newSellingPrice}
                onChange={(e) => setNewSellingPrice(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isCreating) {
                    handleCreateProduct();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Required — used to calculate margin & profit insights.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateProduct}
              disabled={
                !newProductName.trim() ||
                !newSellingPrice ||
                parseFloat(newSellingPrice) <= 0 ||
                isCreating
              }
              className="gradient-primary text-primary-foreground"
            >
              {isCreating ? "Creating..." : "Create Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
