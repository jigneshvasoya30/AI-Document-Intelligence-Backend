export interface ExtractionResult {
    data: any;
    confidence: number;
    rawResponse: string;
}
export declare const extractInvoiceData: (filePath: string) => Promise<ExtractionResult>;
//# sourceMappingURL=aiService.d.ts.map