import './polyfills.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

try {
  const pdfImport = require('pdf-parse');
  if (pdfImport && typeof pdfImport === 'object') {
    if (pdfImport.default) {
      console.log('Type of .default:', typeof pdfImport.default);
    }
  }
} catch (e: any) {
  console.error('Debug script failed:', e.message);
}
