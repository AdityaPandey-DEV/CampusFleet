import { createWorker } from "tesseract.js";

/**
 * Attempts to automatically extract a 12-digit Indian UPI UTR number
 * or Bank Transaction ID from an uploaded payment screenshot.
 */
export async function extractTransactionIdFromImage(
  imageFile: File,
  onProgress?: (progressText: string) => void
): Promise<{ transactionId: string | null; fullText: string }> {
  try {
    if (onProgress) onProgress("Initializing neural OCR engine...");
    const worker = await createWorker("eng");

    if (onProgress) onProgress("Scanning receipt for UPI Ref / UTR number...");
    const ret = await worker.recognize(imageFile);
    await worker.terminate();

    const text = ret.data.text || "";

    // 1. Check for labeled patterns (e.g., UTR: 428194829104, UPI Ref No: 428194829104)
    const labelMatch = text.match(
      /(?:UTR|UPI\s*Ref(?:\s*No)?|Ref\s*No|Txn\s*ID|Transaction\s*ID|Bank\s*Reference)[\s:#-]*([A-Za-z0-9]{10,25})/i
    );
    if (labelMatch && labelMatch[1]) {
      return { transactionId: labelMatch[1].trim(), fullText: text };
    }

    // 2. Check for PhonePe transaction pattern (T followed by 18-24 digits/alphanumerics)
    const phonePeMatch = text.match(/\b(T[0-9A-Za-z]{18,24})\b/);
    if (phonePeMatch && phonePeMatch[1]) {
      return { transactionId: phonePeMatch[1].trim(), fullText: text };
    }

    // 3. Check for standard 12-digit numeric Indian UPI UTR
    const utr12Match = text.match(/\b([0-9]{12})\b/);
    if (utr12Match && utr12Match[1]) {
      return { transactionId: utr12Match[1].trim(), fullText: text };
    }

    // 4. Fallback: Any 10 to 16 digit number
    const genericNumeric = text.match(/\b([0-9]{10,16})\b/);
    if (genericNumeric && genericNumeric[1]) {
      return { transactionId: genericNumeric[1].trim(), fullText: text };
    }

    return { transactionId: null, fullText: text };
  } catch (err) {
    console.warn("OCR auto-detection error, fallback to manual entry:", err);
    return { transactionId: null, fullText: "" };
  }
}
