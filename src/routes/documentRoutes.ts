import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import * as documentController from '../controllers/documentController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

router.post('/documents', upload.array('invoices'), documentController.uploadDocuments);
router.get('/documents', documentController.listDocuments);
router.get('/documents/:id', documentController.getDocument);
router.put('/documents/:id', documentController.updateDocument);
router.post('/reprocess/:id', documentController.reprocessDocument);
router.get('/prompts', documentController.listPrompts);
router.post('/prompts', documentController.createPrompt);
router.put('/prompts/:id/activate', documentController.activatePrompt);

export default router;
