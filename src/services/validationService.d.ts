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
export declare const validateAndNormalize: (data: any) => Promise<ValidatedData>;
//# sourceMappingURL=validationService.d.ts.map