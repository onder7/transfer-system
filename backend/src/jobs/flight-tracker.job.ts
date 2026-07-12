import cron                  from 'node-cron';
import { checkActiveFlights } from '../services/flight.service.js';
import { logger }             from '../config/logger.js';

let task: ReturnType<typeof cron.schedule> | null = null;

export function startFlightTracker() {
  // Her 15 dakikada bir aktif uçuşları güncelle
  task = cron.schedule('*/15 * * * *', async () => {
    logger.info('✈️  Uçuş takip görevi başladı');
    try {
      await checkActiveFlights();
    } catch (err) {
      logger.error({ err }, 'Uçuş takip görevi hatası');
    }
  });

  logger.info('✈️  Uçuş takip görevi zamanlandı (her 15 dakika)');
  return task;
}

export function stopFlightTracker() {
  task?.stop();
}
