import '../polyfills.js';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

const AI_PROVIDER = process.env.AI_PROVIDER || 'mock';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export interface ExtractionResult {
  data: any;
  confidence: number;
  rawResponse: string;
}

const DEFAULT_PROMPT = `You are an invoice data extraction expert. Extract structured data from the invoice text below.
Return ONLY a valid JSON object with exactly these fields:
{
  "vendor_name": "string or null",
  "invoice_number": "string or null",
  "invoice_date": "string in YYYY-MM-DD format or null",
  "currency": "3-letter ISO code like INR, USD, EUR or null",
  "total_amount": number or null,
  "tax_amount": number or null,
  "line_items": [
    {
      "description": "string",
      "quantity": number,
      "unit_price": number,
      "line_total": number
    }
  ]
}

Rules:
- invoice_number may appear as "Invoice No", "Bill ID", "Inv #", "Invoice Number", etc.
- vendor_name is the company/person issuing the invoice
- total_amount and tax_amount must be plain numbers (no currency symbols)
- If a field is not found, use null
- line_items must be an array (empty array if none found)
- Return ONLY the JSON, no markdown, no explanation`;

async function extractTextFromPDF(filePath: string): Promise<string> {
  // Dynamically import pdf-parse CJS to avoid ESM/CJS conflicts
  const pdfParsePath = path.join(__dirname, '../../node_modules/pdf-parse/dist/pdf-parse/cjs/index.cjs');
  
  let PDFParseClass: any;
  try {
    // Try loading via the CJS path directly
    const mod = await import(pdfParsePath);
    PDFParseClass = mod.PDFParse;
  } catch (e1) {
    try {
      // Fallback: try standard require via createRequire
      const { createRequire } = await import('module');
      const req = createRequire(import.meta.url);
      const mod = req('pdf-parse');
      PDFParseClass = mod.PDFParse;
    } catch (e2) {
      throw new Error(`Failed to load pdf-parse: ${e2}`);
    }
  }

  if (!PDFParseClass) {
    throw new Error('PDFParse class not found in pdf-parse module');
  }

  const dataBuffer = fs.readFileSync(filePath);
  const parser = new PDFParseClass({ data: dataBuffer, verbosity: 0 });
  
  try {
    const result = await parser.getText();
    const text = result.text || '';
    if (text.length < 10) {
      throw new Error('PDF text extraction returned empty or near-empty content');
    }
    return text;
  } finally {
    await parser.destroy().catch(() => {});
  }
}

export const extractInvoiceData = async (filePath: string): Promise<ExtractionResult> => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`PDF file not found: ${filePath}`);
  }

  const text = await extractTextFromPDF(filePath);

  // Get active prompt version from DB
  const promptConfig = await prisma.promptConfig.findFirst({
    where: { isActive: true },
    orderBy: { version: 'desc' }
  });
  const systemPrompt = promptConfig?.promptText || DEFAULT_PROMPT;

  if (AI_PROVIDER === 'gemini' && GEMINI_API_KEY) {
    return await extractWithGemini(text, systemPrompt);
  } else if (AI_PROVIDER === 'openai' && OPENAI_API_KEY && !OPENAI_API_KEY.includes('your_openai_key')) {
    return await extractWithOpenAI(text, systemPrompt);
  } else {
    console.log('[AI] No valid AI provider configured, using regex-based extraction');
    return extractWithRegex(text);
  }
};

async function extractWithGemini(text: string, prompt: string): Promise<ExtractionResult> {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: { responseMimeType: 'application/json' }
  });

  const fullPrompt = `${prompt}\n\nInvoice Text:\n${text}`;
  
  try {
    const result = await model.generateContent(fullPrompt);
    const rawResponse = result.response.text();

    let data: any;
    try {
      data = JSON.parse(rawResponse);
    } catch {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        data = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse Gemini response as JSON');
      }
    }

    return { data, confidence: 0.95, rawResponse };
  } catch (error: any) {
    console.error('[Gemini] Error:', error.message);
    console.log('[AI] Falling back to regex extraction');
    return extractWithRegex(text);
  }
}

async function extractWithOpenAI(text: string, prompt: string): Promise<ExtractionResult> {
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `Invoice Text:\n${text}` }
      ],
      response_format: { type: 'json_object' }
    });

    const rawResponse = response.choices?.[0]?.message?.content || '{}';
    return { data: JSON.parse(rawResponse), confidence: 0.95, rawResponse };
  } catch (error: any) {
    console.error('[OpenAI] Error:', error.message);
    return extractWithRegex(text);
  }
}

// Robust regex-based fallback extractor
function extractWithRegex(text: string): ExtractionResult {

  const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

  // Vendor name: first non-empty line or after "Vendor Name:"
  let vendor_name: string | null = null;
  const vendorMatch = text.match(/vendor\s*name\s*[:\-]?\s*(.+)/i);
  if (vendorMatch) {
    vendor_name = clean(vendorMatch[1]);
  } else {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    vendor_name = lines[0] || null;
  }

  // Invoice number - look for labeled field first
  let invoice_number: string | null = null;
  const invNumMatch = text.match(/(?:invoice\s*(?:no|number|#)|bill\s*(?:id|no|number))\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\/]{2,})/i);
  if (invNumMatch) {
    const candidate = clean(invNumMatch[1]);
    const skipWords = /^(number|date|amount|total|tax|currency|name|address|invoice)$/i;
    if (!skipWords.test(candidate)) {
      invoice_number = candidate;
    }
  }
  // Fallback: look for patterns like INV-XXXX
  if (!invoice_number) {
    const fallback = text.match(/\b(INV|BILL|PO|ORD|REF|REC)[-#][A-Z0-9\-]{3,20}\b/i);
    if (fallback) invoice_number = clean(fallback[0]);
  }

  // Invoice date
  let invoice_date: string | null = null;
  const dateMatch = text.match(/(?:invoice\s*date|date)\s*[:\-]?\s*(\d{1,2}[-\/]\w+[-\/]\d{2,4}|\d{4}[-\/]\d{2}[-\/]\d{2}|\w+\s+\d{1,2},?\s+\d{4})/i);
  if (dateMatch) {
    const raw = clean(dateMatch[1]);
    const parsed = new Date(raw);
    invoice_date = isNaN(parsed.getTime()) ? raw : parsed.toISOString().split('T')[0];
  }

  // Currency
  let currency: string | null = null;
  const currMatch = text.match(/currency\s*[:\-]?\s*([A-Z]{3})/i) || text.match(/\b(INR|USD|EUR|GBP|AUD|CAD|JPY)\b/);
  if (currMatch) currency = currMatch[1].toUpperCase();

  // Total amount
  let total_amount: number | null = null;
  const totalMatch = text.match(/total\s*amount\s*[:\-]?\s*[\$₹€£]?\s*([\d,]+\.?\d*)/i) ||
                     text.match(/(?:grand\s*total|total)\s*[:\-]?\s*[\$₹€£]?\s*([\d,]+\.?\d*)/i);
  if (totalMatch) total_amount = parseFloat(totalMatch[1].replace(/,/g, ''));

  // Tax amount
  let tax_amount: number | null = null;
  const taxMatch = text.match(/(?:tax|gst|vat|cgst|sgst|igst)\s*(?:\([^)]*\))?\s*[:\-]?\s*[\$₹€£]?\s*([\d,]+\.?\d*)/i);
  if (taxMatch) tax_amount = parseFloat(taxMatch[1].replace(/,/g, ''));

  // Line items - try to parse table rows
  const line_items: any[] = [];
  const lineItemPattern = /([A-Za-z][A-Za-z\s]+?)\s+(\d+)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)/g;
  let match;
  while ((match = lineItemPattern.exec(text)) !== null) {
    const desc = clean(match[1]);
    const qty = parseFloat(match[2]);
    const unit = parseFloat(match[3].replace(/,/g, ''));
    const total = parseFloat(match[4].replace(/,/g, ''));
    if (desc.length > 2 && qty > 0 && unit > 0) {
      line_items.push({ description: desc, quantity: qty, unit_price: unit, line_total: total });
    }
  }

  const data = { vendor_name, invoice_number, invoice_date, currency, total_amount, tax_amount, line_items };

  return {
    data,
    confidence: 0.70,
    rawResponse: JSON.stringify(data)
  };
}
