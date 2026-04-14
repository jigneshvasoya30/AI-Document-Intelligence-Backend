"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.reprocessDocument = exports.getDocument = exports.listDocuments = exports.uploadDocuments = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const aiService = __importStar(require("../services/aiService"));
const validationService = __importStar(require("../services/validationService"));
const prisma = new client_1.PrismaClient();
const uploadDocuments = async (req, res) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }
        const results = [];
        for (const file of files) {
            // Create initial record
            const invoice = await prisma.invoice.create({
                data: {
                    filename: file.originalname,
                    originalPath: file.path,
                    status: 'PENDING',
                }
            });
            // Start processing in background (or synchronously for this demo)
            processInvoice(invoice.id, file.path);
            results.push(invoice);
        }
        res.status(201).json(results);
    }
    catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload documents' });
    }
};
exports.uploadDocuments = uploadDocuments;
const listDocuments = async (req, res) => {
    try {
        const invoices = await prisma.invoice.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { validationErrors: true }
                }
            }
        });
        res.json(invoices);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to list documents' });
    }
};
exports.listDocuments = listDocuments;
const getDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const invoice = await prisma.invoice.findUnique({
            where: { id },
            include: {
                lineItems: true,
                validationErrors: true,
            }
        });
        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        res.json(invoice);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get document' });
    }
};
exports.getDocument = getDocument;
const reprocessDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const invoice = await prisma.invoice.findUnique({ where: { id } });
        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        await prisma.invoice.update({
            where: { id },
            data: { status: 'PENDING' }
        });
        processInvoice(id, invoice.originalPath);
        res.json({ message: 'Reprocessing started' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to reprocess document' });
    }
};
exports.reprocessDocument = reprocessDocument;
// Internal processing logic
async function processInvoice(id, filePath) {
    const startTime = Date.now();
    try {
        // 1. Extract data using AI
        const extractionResults = await aiService.extractInvoiceData(filePath);
        // 2. Normalize and Validate
        const validatedData = await validationService.validateAndNormalize(extractionResults.data);
        // 3. Update Database
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
                lineItems: {
                    deleteMany: {},
                    create: validatedData.lineItems
                },
                validationErrors: {
                    deleteMany: {},
                    create: validatedData.errors
                }
            }
        });
    }
    catch (error) {
        console.error('Processing error for invoice', id, ':', error);
        await prisma.invoice.update({
            where: { id },
            data: {
                status: 'ERROR',
                extractionLog: error.message,
                processingTime: Date.now() - startTime,
            }
        });
    }
}
//# sourceMappingURL=documentController.js.map