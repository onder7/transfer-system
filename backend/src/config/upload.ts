import multer from 'multer';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

// Yüklenen görseller proje kökündeki backend/uploads altına kaydedilir.
// docker-compose'da `.:/app` mount'lu olduğu için host'ta kalıcıdır.
export const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);
const EXT: Record<string, string> = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
  'image/avif': '.avif', 'image/gif': '.gif',
};

// Belirli bir alt klasöre resim yükleyen multer örneği üretir.
function makeImageUpload(subdir: string, prefix: string) {
  const dir = path.join(UPLOAD_ROOT, subdir);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename: (_req, file, cb) => {
      const stamp = Date.now();
      const rand  = randomBytes(4).toString('hex');
      cb(null, `${prefix}_${stamp}_${rand}${EXT[file.mimetype] ?? '.img'}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (_req, file, cb) => {
      if (ALLOWED.has(file.mimetype)) cb(null, true);
      else cb(new Error('Yalnızca resim dosyaları yüklenebilir (jpg, png, webp, avif, gif)'));
    },
  });
}

export const vehicleImageUpload = makeImageUpload('vehicles', 'vc');
export const heroImageUpload    = makeImageUpload('hero', 'hero');
