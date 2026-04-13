import path from 'path';

const DEFAULT_UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const DEFAULT_UPLOAD_PUBLIC_BASE = '/api/uploads';

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
};

export function getUploadDir() {
  return process.env.UPLOAD_DIR || DEFAULT_UPLOAD_DIR;
}

export function getUploadPublicUrl(filename: string) {
  return `${DEFAULT_UPLOAD_PUBLIC_BASE}/${encodeURIComponent(filename)}`;
}

export function getUploadFilePath(filename: string) {
  return path.join(getUploadDir(), filename);
}

export function getSafeUploadFilename(originalName: string) {
  const ext = path.extname(originalName).toLowerCase() || '.bin';
  return `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
}

export function isSafeUploadFilename(filename: string) {
  return /^[a-zA-Z0-9._-]+$/.test(filename);
}

export function getUploadMimeType(filename: string) {
  return MIME_TYPES[path.extname(filename).toLowerCase()] || 'application/octet-stream';
}
