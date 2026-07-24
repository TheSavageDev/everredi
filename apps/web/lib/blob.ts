import { put } from '@vercel/blob';

/** Server-side Blob helper for authenticated uploads. */
export async function putUserUpload(
  userId: string,
  filename: string,
  body: Blob | ArrayBuffer | ReadableStream | string,
) {
  const pathname = `uploads/${userId}/${filename}`;
  return put(pathname, body, {
    access: 'public',
    addRandomSuffix: true,
  });
}
