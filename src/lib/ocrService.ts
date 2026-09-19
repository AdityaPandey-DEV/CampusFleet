import { createWorker } from "tesseract.js";

export interface OcrExtractionResult {
  transactionId: string | null;
  amount: number | null;
  fullText: string;
}

/**
 * Extracts a UPI UTR / Bank Transaction ID AND payment amount
 * from an uploaded payment screenshot using Tesseract.js OCR.
 *
 * Amount extraction supports Indian currency formats:
 * - ₹14,000 / ₹ 14000.00 / Rs. 6,000 / INR 12000 / 14,000.00
 */
export async function extractTransactionIdFromImage(
  imageFile: File,
  onProgress?: (progressText: string) => void
): Promise<OcrExtractionResult> {
  try {
    if (onProgress) onProgress("Initializing neural OCR engine...");
    const worker = await createWorker("eng");

    if (onProgress) onProgress("Scanning receipt for UPI Ref / UTR number & amount...");
    const ret = await worker.recognize(imageFile);
    await worker.terminate();

    const text = ret.data.text || "";

    const transactionId = extractTransactionId(text);
    const amount = extractAmount(text);

    return { transactionId, amount, fullText: text };
  } catch (err) {
    console.warn("OCR auto-detection error, fallback to manual entry:", err);
    return { transactionId: null, amount: null, fullText: "" };
  }
}

/**
 * Extracts transaction ID from OCR text using multiple pattern strategies.
 */
function extractTransactionId(text: string): string | null {
  // 1. Check for labeled patterns (e.g., UTR: 428194829104, UPI Ref No: 428194829104)
  const labelMatch = text.match(
    /(?:UTR|UPI\s*Ref(?:\s*No)?|Ref\s*No|Txn\s*ID|Transaction\s*ID|Bank\s*Reference)[\s:#-]*([A-Za-z0-9]{10,25})/i
  );
  if (labelMatch?.[1]) {
    return labelMatch[1].trim();
  }

  // 2. Check for PhonePe transaction pattern (T followed by 18-24 digits/alphanumerics)
  const phonePeMatch = text.match(/\b(T[0-9A-Za-z]{18,24})\b/);
  if (phonePeMatch?.[1]) {
    return phonePeMatch[1].trim();
  }

  // 3. Check for standard 12-digit numeric Indian UPI UTR
  const utr12Match = text.match(/\b([0-9]{12})\b/);
  if (utr12Match?.[1]) {
    return utr12Match[1].trim();
  }

  // 4. Fallback: Any 10 to 16 digit number
  const genericNumeric = text.match(/\b([0-9]{10,16})\b/);
  if (genericNumeric?.[1]) {
    return genericNumeric[1].trim();
  }

  return null;
}

/**
 * Extracts payment amount from OCR text using Indian currency patterns.
 * Supports: ₹14,000 | ₹ 14000.00 | Rs. 6,000 | Rs 6000 | INR 12000 | Amount: 14000
 */
function extractAmount(text: string): number | null {
  // Strategy 1: Labeled amount patterns (most reliable)
  // Matches: "Amount ₹14,000" / "Paid ₹ 6,000.00" / "Total: Rs. 12000" / "Debited INR 10,000"
  const labeledPatterns = [
    /(?:Amount|Paid|Total|Debited|Debit|Sent|Transferred|Payment)[\s:₹]*(?:₹|Rs\.?|INR)?\s*([0-9]{1,3}(?:,?[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
    /(?:₹|Rs\.?|INR)\s*([0-9]{1,3}(?:,?[0-9]{3})*(?:\.[0-9]{1,2})?)\s*(?:paid|sent|debited|transferred|successful)/i,
  ];

  for (const pattern of labeledPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const parsed = parseIndianAmount(match[1]);
      if (parsed && parsed >= 100 && parsed <= 500000) {
        return parsed;
      }
    }
  }

  // Strategy 2: Currency symbol/prefix followed by amount
  // Matches: "₹14,000" / "Rs. 6000" / "INR 12,000.00"
  const currencyMatch = text.match(
    /(?:₹|Rs\.?|INR)\s*([0-9]{1,3}(?:,?[0-9]{3})*(?:\.[0-9]{1,2})?)/i
  );
  if (currencyMatch?.[1]) {
    const parsed = parseIndianAmount(currencyMatch[1]);
    if (parsed && parsed >= 100 && parsed <= 500000) {
      return parsed;
    }
  }

  // Strategy 3: Standalone large numbers that look like payment amounts (4-6 digits)
  // Only as last resort — matches amounts like "14000" or "6,000"
  const standaloneMatch = text.match(/\b([0-9]{1,2},?[0-9]{3}(?:\.[0-9]{1,2})?)\b/);
  if (standaloneMatch?.[1]) {
    const parsed = parseIndianAmount(standaloneMatch[1]);
    if (parsed && parsed >= 1000 && parsed <= 100000) {
      return parsed;
    }
  }

  return null;
}

/**
 * Parses an Indian-format number string (e.g., "14,000" or "6000.00") into a number.
 */
function parseIndianAmount(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, "").trim();
  const num = parseFloat(cleaned);
  if (isNaN(num) || num <= 0) return null;
  return Math.round(num * 100) / 100; // Round to 2 decimal places
}
