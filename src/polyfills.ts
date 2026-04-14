import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Polyfill DOMMatrix for pdf-parse compatibility in Node.js
if (typeof (global as any).DOMMatrix === 'undefined') {
  try {
    (global as any).DOMMatrix = require('dommatrix');
    console.log('DOMMatrix polyfill applied');
  } catch (e) {
    console.error('Failed to load dommatrix polyfill:', e);
  }
}
