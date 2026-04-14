import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.promptConfig.upsert({
    where: { version: 1 },
    update: {},
    create: {
      version: 1,
      description: 'Default invoice extraction prompt v1',
      isActive: true,
      promptText: `You are an invoice data extraction expert. Extract structured data from the invoice text below.
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
- Return ONLY the JSON, no markdown, no explanation`
    }
  });
  console.log('Seeded default prompt config');
}

main().catch(console.error).finally(() => prisma.$disconnect());
