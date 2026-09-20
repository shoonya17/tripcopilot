import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from './env';

function localRoot() { return env.LOCAL_STORAGE_ROOT ?? path.join(process.cwd(), '../../storage'); }
function isR2() { return Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY); }
function client() {
  return import('@aws-sdk/client-s3').then(({ S3Client }) => new S3Client({
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    region: 'auto',
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID!, secretAccessKey: env.R2_SECRET_ACCESS_KEY! },
  }));
}

export async function putSource(buffer: Buffer, contentType: string): Promise<{ key: string; hash: string }> {
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const key = `source/${new Date().toISOString().slice(0,10)}/${hash}`;
  if (isR2()) {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const s3 = await client();
    await s3.send(new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: key, Body: buffer, ContentType: contentType, Metadata: { sha256: hash } }));
    return { key, hash };
  }
  const localPath = path.join(localRoot(), key);
  await fs.mkdir(path.dirname(localPath), { recursive: true });
  await fs.writeFile(localPath, buffer);
  return { key, hash };
}

export async function deleteSource(key: string) {
  if (isR2()) {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const s3 = await client();
    await s3.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
    return;
  }
  await fs.rm(path.join(localRoot(), key), { force: true });
}

export async function readSource(key: string) {
  if (isR2()) {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const s3 = await client();
    const result = await s3.send(new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
    if (!result.Body) throw new Error('NOT_FOUND: source object');
    return Buffer.from(await result.Body.transformToByteArray());
  }
  return fs.readFile(path.join(localRoot(), key));
}

export async function signedSourceUrl(key: string, expiresIn = 300) {
  if (!isR2()) return null;
  const { GetObjectCommand } = await import('@aws-sdk/client-s3');
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
  const s3 = await client();
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key }), { expiresIn });
}
