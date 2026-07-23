import type { Request, Response, NextFunction } from 'express';
import * as extraService from '../services/extra.service.js';

export async function listExtrasHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ extras: await extraService.listActiveExtras() });
  } catch (e) {
    next(e);
  }
}
