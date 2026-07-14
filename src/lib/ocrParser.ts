// OCR Parser - Universal Bill Format Support
// Handles all bill types: retail, wholesale, GST invoices, POS receipts

export type ReceiptItem = {
  id: string;
  name: string;
  qty: number;
  price: number;
  amount: number;
  unit?: string;
};

export type ParsedReceipt = {
  items: ReceiptItem[];
  ocrTotal: number | null;
  computedTotal: number;
  hasTotalMismatch: boolean;
  totalDiscrepancy: number;
};

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

// Extended noise keywords for universal bill support
const NOISE_KEYWORDS = [
  "subtotal", "sub total", "igst", "cgst", "sgst", "gst", "vat",
  "grand total", "net total", "gross total",
  "discount", "disc", "round off", "rounding",
  "phone", "tel", "mobile", "fax", "email",
  "date", "time", "invoice", "bill no", "bill date","pay",
  "thank", "thanks", "visit again", "welcome",
  "address", "gstin", "gst no", "pan", "fssai","cin",
  "cash", "card", "upi", "payment", "paid", "balance", "change",
  "signature", "authorized", "terms", "conditions",
  "hsn", "sac", "cess", "taxable", "non-taxable",
  "customer", "buyer", "sold to", "ship to", "bill to",
  "sr no", "s.no", "sl no", "serial"
];

// Enhanced header patterns to detect table headers
const HEADER_KEYWORDS = {
  item: ["item", "description", "desc", "product", "particulars", "goods", "article", "material","Nutrition"],
  qty: ["qty", "quantity", "qnty", "pcs", "nos", "units", "unit", "pc"],
  price: ["rate", "price", "mrp", "unit price", "u.price", "uprice"],
  amount: ["amount", "value", "total", "amt", "net", "line total"],
  ignore: ["hsn", "sac", "code", "batch", "uom", "measure", "discount", "tax", "gst", "cgst", "sgst"]
};

// Header patterns to skip - detects if a line is a table header
const HEADER_PATTERNS = [
  /^(item|product|description|particulars|goods|article)/i,
  /^(qty|quantity|qnty|pcs|nos|units?)/i,
  /^(rate|price|mrp|unit\s*price)/i,
  /^(amount|value|total|amt)/i,
  /^(sn|sno|s\.?no|sr\.?no|sl\.?no)/i,
  /^(hsn|sac|code|batch)/i,
  /^(uom|unit|measure)/i
];

// Detect column positions from header row
interface ColumnMap {
  hasHeaders: boolean;
  itemCol: number;
  qtyCol: number;
  priceCol: number;
  amountCol: number;
}

function detectHeaderColumns(line: string): ColumnMap | null {
  const lower = line.toLowerCase();
  const tokens = lower.split(/\s{2,}|\t/).map(t => t.trim()).filter(Boolean);
  
  if (tokens.length < 2) return null;
  
  let itemCol = -1, qtyCol = -1, priceCol = -1, amountCol = -1;
  let headerMatches = 0;
  
  tokens.forEach((token, idx) => {
    if (HEADER_KEYWORDS.item.some(k => token.includes(k))) {
      itemCol = idx;
      headerMatches++;
    } else if (HEADER_KEYWORDS.qty.some(k => token.includes(k))) {
      qtyCol = idx;
      headerMatches++;
    } else if (HEADER_KEYWORDS.price.some(k => token.includes(k))) {
      priceCol = idx;
      headerMatches++;
    } else if (HEADER_KEYWORDS.amount.some(k => token.includes(k) && !token.includes("subtotal"))) {
      amountCol = idx;
      headerMatches++;
    }
  });
  
  // Need at least 2 header matches to consider it a valid header row
  if (headerMatches >= 2) {
    return {
      hasHeaders: true,
      itemCol: itemCol >= 0 ? itemCol : 0,
      qtyCol: qtyCol >= 0 ? qtyCol : 1,
      priceCol: priceCol >= 0 ? priceCol : 2,
      amountCol: amountCol >= 0 ? amountCol : tokens.length - 1
    };
  }
  
  return null;
}

// Check if a line is a header row
function isHeaderRow(line: string): boolean {
  const lower = line.toLowerCase();
  const tokens = lower.split(/\s+/);
  
  // Count header keyword matches
  let headerMatches = 0;
  for (const token of tokens) {
    for (const patterns of Object.values(HEADER_KEYWORDS)) {
      if (patterns.some(p => token.includes(p))) {
        headerMatches++;
        break;
      }
    }
  }
  
  // If most tokens match header keywords, it's a header
  return headerMatches >= 2 || (tokens.length <= 4 && headerMatches >= 1);
}

// Check if line contains noise keywords
function isNoiseLine(line: string): boolean {
  const lower = line.toLowerCase();
  
  // Check for noise keywords (but allow "total" through for detection)
  for (const keyword of NOISE_KEYWORDS) {
    if (lower.includes(keyword)) {
      return true;
    }
  }
  
  // Skip lines that are just numbers (like bill numbers, dates)
  if (/^\d[\d\s\-\/\.]*$/.test(line)) {
    return true;
  }
  
  // Skip lines with phone number patterns
  if (/\d{10,}/.test(line.replace(/[\s\-]/g, ""))) {
    return true;
  }
  
  return false;
}

// Extract all numeric values from a line
function extractNumbers(line: string): number[] {
  const matches = line.match(/\d+(?:\.\d{1,2})?/g);
  if (!matches) return [];
  return matches.map(n => parseFloat(n)).filter(n => n > 0);
}

// Extract the item name (longest meaningful text segment)
function extractItemName(line: string): string {
  // Remove all numbers and special chars, keep letters and spaces
  let cleaned = line
    .replace(/\d+(?:\.\d{1,2})?/g, " ")  // Remove numbers
    .replace(/\b(rs\.?|inr|normal)\b/gi, " ") // Remove Rs, Rs., INR, normal
    .replace(/[^\w\s]/g, " ")             // Remove special chars
    .replace(/\b(sn|sno|s\.?no|sr\.?no|sl\.?no|hsn|sac|uom|pcs|nos|kg|gm|ltr|ml|pc)\b/gi, " ") // Remove unit/code words
    .replace(/\s+/g, " ")
    .trim();
  
  // If cleaned text is too short, try to get meaningful part
  if (cleaned.length < 2) {
    // Try extracting alphabetic sequences
    const alphaMatches = line.match(/[a-zA-Z]{2,}/g);
    if (alphaMatches) {
      cleaned = alphaMatches.join(" ");
    }
  }
  
  return cleaned;
}

// Smart extraction: handles various column orders and extra columns
function extractLineData(line: string): ReceiptItem | null {
  const numbers = extractNumbers(line);
  const name = extractItemName(line);
  
  // Need at least a name and some numbers
  if (name.length < 2 || numbers.length < 2) {
    return null;
  }
  
  // Strategy: 
  // - Amount is typically the LAST number (rightmost)
  // - Qty is typically the FIRST small integer
  // - Price is either explicit or calculated
  
  let qty: number;
  let amount: number;
  let price: number;
  
  // Amount = last number (usually the line total)
  amount = numbers[numbers.length - 1];
  
  // Find qty: first number that looks like a quantity (usually small integer)
  // Quantities are typically 1-999 for most business cases
  let qtyIndex = 0;
  for (let i = 0; i < numbers.length - 1; i++) {
    if (numbers[i] <= 9999 && Number.isInteger(numbers[i])) {
      qty = numbers[i];
      qtyIndex = i;
      break;
    }
  }
  
  // If no integer qty found, use first number
  if (qty === undefined) {
    qty = numbers[0];
    qtyIndex = 0;
  }
  
  // Price: try to find it, or calculate
  if (numbers.length >= 3 && qtyIndex + 1 < numbers.length - 1) {
    // There's a number between qty and amount - likely the price
    price = numbers[qtyIndex + 1];
    
    // Validate: qty * price should be close to amount
    const calculated = qty * price;
    const tolerance = amount * 0.1; // 10% tolerance for rounding
    
    if (Math.abs(calculated - amount) > tolerance) {
      // Price doesn't match, calculate it
      price = amount / qty;
    }
  } else {
    // No explicit price, calculate it
    price = amount / qty;
  }
  
  // Sanity checks
  if (qty <= 0 || amount <= 0 || price <= 0) {
    return null;
  }
  
  // Recalculate amount to ensure consistency
  const calculatedAmount = qty * price;
  
  return {
    id: generateId(),
    name,
    qty: Math.round(qty * 100) / 100,
    price: Math.round(price * 100) / 100,
    amount: Math.round(calculatedAmount * 100) / 100
  };
}

// Extract total from a line - improved detection
function extractTotal(line: string): number | null {
  const lower = line.toLowerCase();
  
  // Skip subtotal lines
  if (lower.includes("subtotal") || lower.includes("sub total")) {
    return null;
  }
  
  // Check for total keyword
  if (lower.includes("total") || lower.includes("grand") || lower.includes("net amount")) {
    const numbers = extractNumbers(line);
    if (numbers.length > 0) {
      // Total is usually the largest number or the last number
      return Math.max(...numbers);
    }
  }
  
  return null;
}

// Tolerance check for total mismatch (1% as per PRD)
const TOTAL_TOLERANCE_PERCENT = 0.01;

export function smartParseReceipt(text: string): ParsedReceipt {
  const rawLines = text.split("\n").map(l => l.trim()).filter(Boolean);

  const items: ReceiptItem[] = [];
  let ocrTotal: number | null = null;
  let columnMap: ColumnMap | null = null;

  for (const rawLine of rawLines) {
    // Stage 1: Basic cleaning - remove currency symbols
    let line = rawLine.replace(/[₹£$€¥]/g, "").trim();
    const lower = line.toLowerCase();

    // Stage 2: Detect header row and extract column positions
    if (!columnMap) {
      const detected = detectHeaderColumns(line);
      if (detected) {
        columnMap = detected;
        continue; // Skip header row
      }
    }

    // Stage 3: Total Detection (check before noise filtering)
    const detectedTotal = extractTotal(line);
    if (detectedTotal !== null) {
      // Keep the largest total found (handles multiple total lines)
      if (ocrTotal === null || detectedTotal > ocrTotal) {
        ocrTotal = detectedTotal;
      }
      continue;
    }

    // Stage 4: Skip noise lines and header rows
    if (isNoiseLine(line) || isHeaderRow(line)) {
      continue;
    }

    // Stage 5: Additional cleaning
    line = line
      .replace(/[\[\](){}]/g, " ")           // Remove brackets
      .replace(/[|\\\/]/g, " ")               // Remove separators
      .replace(/\s+/g, " ")
      .trim();

    // Stage 6: Extract item data using universal strategy
    const item = extractLineData(line);
    
    if (item) {
      items.push(item);
    }
  }

  // Calculate computed total from items
  const computedTotal = items.reduce((sum, item) => sum + item.amount, 0);
  const roundedComputedTotal = Math.round(computedTotal * 100) / 100;

  // If no OCR total found, use computed total
  if (ocrTotal === null && items.length > 0) {
    ocrTotal = roundedComputedTotal;
  }

  // Check for total mismatch
  let hasTotalMismatch = false;
  let totalDiscrepancy = 0;
  
  if (ocrTotal !== null && items.length > 0) {
    totalDiscrepancy = Math.abs(ocrTotal - roundedComputedTotal);
    const toleranceAmount = ocrTotal * TOTAL_TOLERANCE_PERCENT;
    hasTotalMismatch = totalDiscrepancy > toleranceAmount;
  }

  return {
    items,
    ocrTotal,
    computedTotal: roundedComputedTotal,
    hasTotalMismatch,
    totalDiscrepancy: Math.round(totalDiscrepancy * 100) / 100
  };
}
