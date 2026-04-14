import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';
import * as aiService from '../services/aiService.js';
import * as validationService from '../services/validationService.js';

const prisma = new PrismaClient();

export const uploadDocuments = async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = [];
    for (const file of files) {
      const invoice = await prisma.invoice.create({
        data: {
          filename: file.originalname,
          originalPath: file.filename, // Store unique filename instead of absolute path
          status: 'PENDING',
        }
      });
      processInvoice(invoice.id, file.path); // Still pass absolute path for initial processing
      results.push(invoice);
    }

    res.status(201).json(results);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload documents' });
  }
};

export const listDocuments = async (req: Request, res: Response) => {
  try {
    const invoices = await prisma.invoice.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { validationErrors: true } } }
    });
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list documents' });
  }
};

export const getDocument = async (req: Request, res: Response) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { lineItems: true, validationErrors: true }
    });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get document' });
  }
};

export const updateDocument = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { vendorName, invoiceNumber, invoiceDate, currency, totalAmount, taxAmount, lineItems } = req.body;

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        vendorName: vendorName ?? undefined,
        invoiceNumber: invoiceNumber ?? undefined,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : undefined,
        currency: currency ?? undefined,
        totalAmount: totalAmount !== undefined ? parseFloat(totalAmount) : undefined,
        taxAmount: taxAmount !== undefined ? parseFloat(taxAmount) : undefined,
        ...(lineItems && {
          lineItems: {
            deleteMany: {},
            create: lineItems.map((item: any) => ({
              description: item.description,
              quantity: parseFloat(item.quantity),
              unitPrice: parseFloat(item.unitPrice),
              lineTotal: parseFloat(item.lineTotal),
            }))
          }
        })
      },
      include: { lineItems: true, validationErrors: true }
    });

    res.json(updated);
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
};

export const reprocessDocument = async (req: Request, res: Response) => {
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    await prisma.invoice.update({ where: { id: req.params.id }, data: { status: 'PENDING' } });
    processInvoice(req.params.id, invoice.originalPath);
    res.json({ message: 'Reprocessing started' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reprocess document' });
  }
};

export const listPrompts = async (req: Request, res: Response) => {
  try {
    const prompts = await prisma.promptConfig.findMany({ orderBy: { version: 'desc' } });
    res.json(prompts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list prompts' });
  }
};

export const createPrompt = async (req: Request, res: Response) => {
  try {
    const { promptText, description } = req.body;
    const latest = await prisma.promptConfig.findFirst({ orderBy: { version: 'desc' } });
    const newVersion = (latest?.version ?? 0) + 1;
    const prompt = await prisma.promptConfig.create({
      data: { version: newVersion, promptText, description: description || '', isActive: false }
    });
    res.status(201).json(prompt);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create prompt' });
  }
};

export const activatePrompt = async (req: Request, res: Response) => {
  try {
    await prisma.promptConfig.updateMany({ data: { isActive: false } });
    const prompt = await prisma.promptConfig.update({
      where: { id: req.params.id },
      data: { isActive: true }
    });
    res.json(prompt);
  } catch (error) {
    res.status(500).json({ error: 'Failed to activate prompt' });
  }
};

// Internal processing logic
async function processInvoice(id: string, filePath: string) {
  const startTime = Date.now();
  try {
    // If filePath is just a filename, resolve it to the uploads directory
    let absolutePath = filePath;
    if (!path.isAbsolute(filePath)) {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      absolutePath = path.join(__dirname, '../../uploads', filePath);
    }

    const extractionResults = await aiService.extractInvoiceData(absolutePath);
    const validatedData = await validationService.validateAndNormalize(extractionResults.data);

    await prisma.invoice.update({
      where: { id },
      data: {
        vendorName: validatedData.vendorName,
        invoiceNumber: validatedData.invoiceNumber,
        invoiceDate: validatedData.invoiceDate,
        currency: validatedData.currency,
        totalAmount: validatedData.totalAmount,
        taxAmount: validatedData.taxAmount,
        status: 'PROCESSED',
        confidenceScore: extractionResults.confidence,
        extractionLog: extractionResults.rawResponse,
        processingTime: Date.now() - startTime,
        lineItems: { deleteMany: {}, create: validatedData.lineItems },
        validationErrors: { deleteMany: {}, create: validatedData.errors }
      }
    });
  } catch (error: any) {
    console.error(`[Process] Error for ${id}:`, error.message);
    await prisma.invoice.update({
      where: { id },
      data: {
        status: 'ERROR',
        extractionLog: `Error: ${error.message}`,
        processingTime: Date.now() - startTime,
      }
    });
  }
}
