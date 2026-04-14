import './polyfills.js';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

async function test() {
  try {
     // Get a sample PDF file if exists
     const uploadsDir = path.join(__dirname, '../uploads');
     const files = fs.readdirSync(uploadsDir);
     const pdfFile = files.find(f => f.endsWith('.pdf'));
     
     if (!pdfFile) {
       console.log('No PDF file found in uploads to test with.');
       return;
     }
     
     const filePath = path.join(uploadsDir, pdfFile);
     const dataBuffer = fs.readFileSync(filePath);
     
     // The constructor expects LoadParameters
     const parser = new PDFParse({ 
       data: dataBuffer,
       verbosity: 0 
     });
     
     const result = await parser.getText();
     
     await parser.destroy();
  } catch (err: any) {
    console.error('Test failed:', err.message);
    console.error(err.stack);
  }
}

test();
