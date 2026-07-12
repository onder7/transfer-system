import type { Request, Response, NextFunction } from 'express';
import { SearchTransferSchema }                from '@transfer/shared';
import * as transferService                    from '../services/transfer.service.js';

export async function searchTransfersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input   = SearchTransferSchema.parse(req.query);
    const results = await transferService.searchTransfers(input);
    res.json({ results });
  } catch (e) { next(e); }
}

export async function listFleetHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const fleet = await transferService.listFleet();
    res.json({ fleet });
  } catch (e) { next(e); }
}
