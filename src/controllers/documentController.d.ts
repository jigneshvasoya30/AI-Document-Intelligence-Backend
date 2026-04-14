import { Request, Response } from 'express';
export declare const uploadDocuments: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const listDocuments: (req: Request, res: Response) => Promise<void>;
export declare const getDocument: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const reprocessDocument: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=documentController.d.ts.map