import type { Request, Response, NextFunction } from 'express';
import * as locationService                     from '../services/location.service.js';

export async function listLocationsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const locations = await locationService.getLocations();
    res.json({ locations });
  } catch (e) { next(e); }
}
