import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import { writeFile, mkdir } from 'fs/promises';
import {
  getSafeUploadFilename,
  getUploadDir,
  getUploadFilePath,
  getUploadPublicUrl,
} from '@/lib/uploads';

export async function POST(req: NextRequest) {
  const { error } = requireAuth(req);
  if (error) return error;

  const formData = await req.formData();
  const files = formData.getAll('files') as File[];

  if (!files.length) return NextResponse.json({ error: 'Không có file' }, { status: 400 });

  const uploadDir = getUploadDir();
  await mkdir(uploadDir, { recursive: true });

  const urls: string[] = [];
  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filename = getSafeUploadFilename(file.name);
    await writeFile(getUploadFilePath(filename), buffer);
    urls.push(getUploadPublicUrl(filename));
  }

  return NextResponse.json({ urls });
}
