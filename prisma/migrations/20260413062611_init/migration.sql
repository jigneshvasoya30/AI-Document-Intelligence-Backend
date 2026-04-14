-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "originalPath" TEXT NOT NULL,
    "vendorName" TEXT,
    "invoiceNumber" TEXT,
    "invoiceDate" DATETIME,
    "currency" TEXT DEFAULT 'USD',
    "totalAmount" REAL,
    "taxAmount" REAL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "confidenceScore" REAL,
    "extractionLog" TEXT,
    "processingTime" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT,
    "quantity" REAL,
    "unitPrice" REAL,
    "lineTotal" REAL,
    CONSTRAINT "LineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ValidationError" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "field" TEXT,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    CONSTRAINT "ValidationError_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PromptConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" INTEGER NOT NULL,
    "promptText" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "PromptConfig_version_key" ON "PromptConfig"("version");
