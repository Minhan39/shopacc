import { readFile } from 'fs/promises';
import { NextResponse } from 'next/server';
import {
  getUploadFilePath,
  getUploadMimeType,
  isSafeUploadFilename,
} from '@/lib/uploads';

export async function GET(
  _req: Request,
  context: { params: Promise<{ filename: string }> }
) {
  const { filename } = await context.params;

  if (!isSafeUploadFilename(filename)) {
    return NextResponse.json({ error: 'File khong hop le' }, { status: 400 });
  }

  try {
    const file = await readFile(getUploadFilePath(filename));
    return new NextResponse(file, {
      headers: {
        'Content-Type': getUploadMimeType(filename),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Khong tim thay file' }, { status: 404 });
  }
}
