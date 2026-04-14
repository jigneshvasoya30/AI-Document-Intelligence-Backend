"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAndNormalize = void 0;
const validateAndNormalize = async (data) => {
    const errors = [];
    // 1. Normalize and validate Dates
    let normalizedDate = null;
    if (data.invoice_date) {
        const date = new Date(data.invoice_date);
        if (!isNaN(date.getTime())) {
            normalizedDate = date;
        }
        else {
            errors.push({ field: 'invoice_date', message: 'Invalid date format', severity: 'WARNING' });
        }
    }
    else {
        errors.push({ field: 'invoice_date', message: 'Missing invoice date', severity: 'ERROR' });
    }
    // 2. Normalize and validate Amounts
    const totalAmount = parseFloat(data.total_amount);
    const taxAmount = parseFloat(data.tax_amount || 0);
    if (isNaN(totalAmount)) {
        errors.push({ field: 'total_amount', message: 'Missing or invalid total amount', severity: 'ERROR' });
    }
    // 3. Line Items Validation
    const lineItems = (data.line_items || []).map((item) => ({
        description: item.description || 'Unknown',
        quantity: parseFloat(item.quantity) || 0,
        unitPrice: parseFloat(item.unit_price) || 0,
        lineTotal: parseFloat(item.line_total) || 0,
    }));
    if (lineItems.length === 0) {
        errors.push({ field: 'line_items', message: 'No line items detected', severity: 'WARNING' });
    }
    // 4. Mathematical Validation (Total Check)
    const lineItemSum = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const diff = Math.abs(lineItemSum + taxAmount - totalAmount);
    if (diff > 0.05 && !isNaN(totalAmount)) { // Allowance for rounding
        errors.push({
            field: 'total_amount',
            message: `Sum of line items (${lineItemSum.toFixed(2)}) + tax (${taxAmount.toFixed(2)}) does not match total amount (${totalAmount.toFixed(2)})`,
            severity: 'WARNING'
        });
    }
    // 5. Detect missing required fields
    if (!data.vendor_name) {
        errors.push({ field: 'vendor_name', message: 'Vendor name not detected', severity: 'ERROR' });
    }
    if (!data.invoice_number) {
        errors.push({ field: 'invoice_number', message: 'Invoice number not detected', severity: 'ERROR' });
    }
    return {
        vendorName: data.vendor_name || null,
        invoiceNumber: data.invoice_number || null,
        invoiceDate: normalizedDate,
        currency: data.currency || 'USD',
        totalAmount: isNaN(totalAmount) ? null : totalAmount,
        taxAmount: isNaN(taxAmount) ? null : taxAmount,
        lineItems,
        errors
    };
};
exports.validateAndNormalize = validateAndNormalize;
//# sourceMappingURL=validationService.js.map