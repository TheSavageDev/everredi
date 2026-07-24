import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { checkBotId } from 'botid/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Client upload helper for future kit photos / attachments (Vercel Blob).
 * Requires BLOB_READ_WRITE_TOKEN in the environment.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const verification = await checkBotId();
  if (verification.isBot) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(`uploads/${user.id}/`)) {
          throw new Error('Invalid upload path');
        }
        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: user.id }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.info('blob upload completed', blob.url, tokenPayload);
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}
