import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ALLOWED_IMAGE_MIME, MAX_UPLOAD_BYTES } from "./constants";
import { HttpError } from "./auth";

// turbopackIgnore מונע מהבנדלר לנסות לאתר סטטית את כל הקבצים תחת התיקייה
const UPLOAD_DIR = path.resolve(
  /*turbopackIgnore: true*/ process.cwd(),
  process.env.UPLOAD_DIR || "./uploads",
);

export type StoredImage = {
  storageKey: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
};

/**
 * מקבל קובץ שהועלה, מוודא שזו באמת תמונה, מסיר מטא-דאטה (כולל מיקום GPS),
 * מקטין לרוחב מרבי ושומר כ-WebP. מחזיר את פרטי הקובץ שנשמר.
 */
export async function storeImage(file: File, maxWidth = 1600): Promise<StoredImage> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new HttpError(413, "הקובץ גדול מדי (עד 8MB)");
  }
  if (!ALLOWED_IMAGE_MIME.includes(file.type)) {
    throw new HttpError(415, "פורמט לא נתמך — יש להעלות JPG, PNG או WebP");
  }

  const input = Buffer.from(await file.arrayBuffer());

  let pipeline: sharp.Sharp;
  let meta: sharp.Metadata;
  try {
    pipeline = sharp(input, { failOn: "error" });
    meta = await pipeline.metadata();
  } catch {
    throw new HttpError(400, "הקובץ אינו תמונה תקינה");
  }
  if (!meta.width || !meta.height) throw new HttpError(400, "הקובץ אינו תמונה תקינה");

  // rotate() מיישר לפי EXIF ואז המטא-דאטה מושמטת בפלט — כך לא נשמר מיקום צילום
  const output = await pipeline
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  const storageKey = `${randomUUID()}.webp`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, storageKey), output.data);

  return {
    storageKey,
    mime: "image/webp",
    width: output.info.width,
    height: output.info.height,
    bytes: output.info.size,
  };
}

function safePath(storageKey: string): string {
  // הגנה מפני מעבר תיקיות — משתמשים בשם הקובץ בלבד
  const base = path.basename(storageKey);
  return path.join(UPLOAD_DIR, base);
}

export async function readImage(storageKey: string): Promise<Buffer> {
  return readFile(safePath(storageKey));
}

export async function deleteImage(storageKey: string): Promise<void> {
  try {
    await unlink(safePath(storageKey));
  } catch {
    // הקובץ כבר לא קיים — לא מפריע למחיקת הרשומה
  }
}
