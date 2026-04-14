"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractInvoiceData = void 0;
const openai_1 = __importDefault(require("openai"));
const fs_1 = __importDefault(require("fs"));
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY || 'MOCK_KEY',
});
const DEFAULT_PROMPT = `Extract structured data from this invoice text. 
Return ONLY a JSON object with the following fields:
- vendor_name
- invoice_number
- invoice_date
- currency (3-letter code)
- total_amount (numeric)
- tax_amount (numeric)
- line_items (array of objects: description, quantity, unit_price, line_total)

If a field is missing, return null. 
Be accurate with numbers and line items.`;
const extractInvoiceData = async (filePath) => {
    try {
        // 1. Read PDF and extract text
        const dataBuffer = fs_1.default.readFileSync(filePath);
        const pdfData = await (0, pdf_parse_1.default)(dataBuffer);
        const text = pdfData.text;
        // 2. Get active prompt version
        let promptConfig = await prisma.promptConfig.findFirst({
            where: { isActive: true },
            orderBy: { version: 'desc' }
        });
        const systemPrompt = promptConfig?.promptText || DEFAULT_PROMPT;
        // 3. Mock handling if no API key
        if (process.env.OPENAI_API_KEY === undefined || process.env.OPENAI_API_KEY === 'MOCK_KEY') {
            return getMockResult(text);
        }
        // 4. Call LLM
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Invoice Text:\n${text}` }
            ],
            response_format: { type: 'json_object' }
        });
        const rawResponse = response.choices[0].message.content || '{}';
        const data = JSON.parse(rawResponse);
        return {
            data,
            confidence: 0.95, // Simplified for demo
            rawResponse
        };
    }
    catch (error) {
        throw new Error(`AI Extraction failed: ${error.message}`);
    }
};
exports.extractInvoiceData = extractInvoiceData;
function getMockResult(text) {
    // Simple mock based on regex or just hardcoded for demo
    const mockData = {
        vendor_name: 'Example Vendor',
        invoice_number: 'INV-' + Math.floor(Math.random() * 10000),
        invoice_date: new Date().toISOString(),
        currency: 'USD',
        total_amount: 150.00,
        tax_amount: 10.00,
        line_items: [
            { description: 'Item 1', quantity: 1, unit_price: 100.00, line_total: 100.00 },
            { description: 'Item 2', quantity: 2, unit_price: 20.00, line_total: 40.00 }
        ]
    };
    return {
        data: mockData,
        confidence: 0.8,
        rawResponse: JSON.stringify(mockData)
    };
}
//# sourceMappingURL=aiService.js.map