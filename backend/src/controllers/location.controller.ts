import type { Request, Response, NextFunction } from 'express';
import * as locationService                     from '../services/location.service.js';

export async function listLocationsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const locations = await locationService.getLocations();
    res.json({ locations });
  } catch (e) { next(e); }
}

export async function listRoutesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const routes = await locationService.getAvailableRoutes();
    res.json({ routes });
  } catch (e) { next(e); }
}
