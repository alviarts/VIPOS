// P2-08 — integration coverage against a real MinIO container.
//
// Only runs when `MINIO_ENDPOINT` (and the matching access keys) are
// in the env. Locally:
//
//   docker run -d --rm --name vipos-minio \
//     -p 9000:9000 -p 9001:9001 \
//     -e MINIO_ROOT_USER=miniouser -e MINIO_ROOT_PASSWORD=miniopass \
//     minio/minio:latest server /data --console-address ":9001"
//
//   MINIO_ENDPOINT=http://localhost:9000 \
//   MINIO_ACCESS_KEY=miniouser MINIO_SECRET_KEY=miniopass \
//   MINIO_BUCKET=vipos-bk-it npx vitest run src/__tests__/storage-minio.test.mjs
//
// CI wires this up automatically via the docker service block in
// .github/workflows/ci.yml — see the `minio` step.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Readable } from 'node:stream';
import { S3Client, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

const ENDPOINT = process.env.MINIO_ENDPOINT;
const ACCESS = process.env.MINIO_ACCESS_KEY;
const SECRET = process.env.MINIO_SECRET_KEY;
const BUCKET = process.env.MINIO_BUCKET || 'vipos-bk-it';

const enabled = Boolean(ENDPOINT && ACCESS && SECRET);

const ORIG_ENV = { ...process.env };
let storage;

beforeAll(async () => {
  if (!enabled) return;
  process.env.S3_ENDPOINT = ENDPOINT;
  process.env.S3_REGION = 'us-east-1';
  process.env.S3_ACCESS_KEY_ID = ACCESS;
  process.env.S3_SECRET_ACCESS_KEY = SECRET;
  process.env.S3_BUCKET = BUCKET;
  process.env.S3_FORCE_PATH_STYLE = '1';

  // Ensure the bucket exists. Use a one-off client because the storage
  // module's cached client is the unit under test.
  const setup = new S3Client({
    endpoint: ENDPOINT,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: { accessKeyId: ACCESS, secretAccessKey: SECRET },
  });
  try {
    await setup.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await setup.send(new CreateBucketCommand({ Bucket: BUCKET }));
  }
  await setup.destroy();

  storage = await import('../lib/storage.js');
  storage._resetForTests();
});

afterAll(() => {
  process.env = { ...ORIG_ENV };
  if (storage) storage._resetForTests();
});

describe.skipIf(!enabled)('P2-08 storage @ MinIO', () => {
  it('round trips a small object through put → list → head → get → delete', async () => {
    const key = `it/${Date.now()}-${Math.random().toString(36).slice(2)}.txt`;
    const body = Buffer.from('hello vipos backup');
    await storage.putObject(key, body, {
      contentType: 'text/plain',
      metadata: { 'created-at-utc': new Date().toISOString() },
    });

    const listed = await storage.listObjects('it/');
    expect(listed.find((o) => o.Key === key)).toMatchObject({ Size: body.length });

    const head = await storage.headObject(key);
    expect(head).not.toBeNull();
    expect(head.Size).toBe(body.length);
    expect(head.Metadata['created-at-utc']).toBeTruthy();

    const stream = await storage.getObjectStream(key);
    expect(stream).not.toBeNull();
    const chunks = [];
    for await (const c of Readable.from(stream)) chunks.push(c);
    expect(Buffer.concat(chunks).toString('utf8')).toBe(body.toString('utf8'));

    await storage.deleteObject(key);
    expect(await storage.headObject(key)).toBeNull();
  });

  it('listObjects pages through ContinuationToken', async () => {
    // Plant ~150 small objects to force pagination (default page = 1000
    // but the helper still walks the IsTruncated path even at this size).
    const prefix = `paginate/${Date.now()}/`;
    const planted = [];
    for (let i = 0; i < 5; i += 1) {
      const k = `${prefix}${i}.txt`;
      planted.push(k);
      await storage.putObject(k, Buffer.from(String(i)));
    }
    const listed = await storage.listObjects(prefix);
    expect(listed.map((o) => o.Key).sort()).toEqual(planted.sort());
    for (const k of planted) await storage.deleteObject(k);
  });
});
