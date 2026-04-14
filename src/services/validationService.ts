export interface ValidatedData {
  vendorName: string | null;
  invoiceNumber: string | null;
  invoiceDate: Date | null;
  currency: string;
  totalAmount: number | null;
  taxAmount: number | null;
  lineItems: any[];
  errors: any[];
}

function parseDate(raw: any): Date | null {
  if (!raw) return null;
  // Already a Date
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  
  const str = String(raw).trim();
  
  // Try direct parse first
  let d = new Date(str);
  if (!isNaN(d.getTime())) return d;

  // Try DD-Mon-YYYY (e.g. 12-Apr-2026)
  const ddMonYYYY = str.match(/^(\d{1,2})[-\/\s]([A-Za-z]+)[-\/\s](\d{4})$/);
  if (ddMonYYYY) {
    d = new Date(`${ddMonYYYY[2]} ${ddMonYYYY[1]}, ${ddMonYYYY[3]}`);
    if (!isNaN(d.getTime())) return d;
  }

  // Try DD/MM/YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    d = new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2,'0')}-${ddmmyyyy[1].padStart(2,'0')}`);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

function parseNumber(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(String(val).replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

export const validateAndNormalize = async (data: any): Promise<ValidatedData> => {
  const errors: any[] = [];

  // 1. Date
  const invoiceDate = parseDate(data.invoice_date);
  if (!data.invoice_date) {
    errors.push({ field: 'invoice_date', message: 'Missing invoice date', severity: 'WARNING' });
  } else if (!invoiceDate) {
    errors.push({ field: 'invoice_date', message: `Could not parse date: "${data.invoice_date}"`, severity: 'WARNING' });
  }

  // 2. Amounts
  const totalAmount = parseNumber(data.total_amount);
  const taxAmount = parseNumber(data.tax_amount) ?? 0;

  if (totalAmount === null) {
    errors.push({ field: 'total_amount', message: 'Missing or invalid total amount', severity: 'ERROR' });
  }

  // 3. Line items
  const lineItems = (Array.isArray(data.line_items) ? data.line_items : []).map((item: any) => ({
    description: String(item.description || 'Unknown item').trim(),
    quantity: parseNumber(item.quantity) ?? 0,
    unitPrice: parseNumber(item.unit_price) ?? 0,
    lineTotal: parseNumber(item.line_total) ?? 0,
  }));

  if (lineItems.length === 0) {
    errors.push({ field: 'line_items', message: 'No line items detected', severity: 'WARNING' });
  }

  // 4. Math validation
  if (totalAmount !== null && lineItems.length > 0) {
    const lineSum = lineItems.reduce((s: number, i: any) => s + i.lineTotal, 0);
    const diff = Math.abs(lineSum + taxAmount - totalAmount);
    const tolerance = totalAmount * 0.02; // 2% tolerance
    if (diff > Math.max(0.5, tolerance)) {
      errors.push({
        field: 'total_amount',
        message: `Line items sum (${lineSum.toFixed(2)}) + tax (${taxAmount.toFixed(2)}) = ${(lineSum + taxAmount).toFixed(2)}, expected ${totalAmount.toFixed(2)}`,
        severity: 'WARNING'
      });
    }
  }

  // 5. Required fields
  if (!data.vendor_name) {
    errors.push({ field: 'vendor_name', message: 'Vendor name not detected', severity: 'WARNING' });
  }
  if (!data.invoice_number) {
    errors.push({ field: 'invoice_number', message: 'Invoice number not detected', severity: 'WARNING' });
  }

  return {
    vendorName: data.vendor_name ? String(data.vendor_name).trim() : null,
    invoiceNumber: data.invoice_number ? String(data.invoice_number).trim() : null,
    invoiceDate,
    currency: data.currency ? String(data.currency).trim().toUpperCase() : 'USD',
    totalAmount,
    taxAmount,
    lineItems,
    errors
  };
};
