/**
 * P2-08 — S3-compatible object-storage client.
 *
 * Wraps `@aws-sdk/client-s3` so the rest of the codebase can talk to
 * Cloudflare R2, Backblaze B2, AWS S3, or a local MinIO without
 * caring which one is on the other end. The default deployment target
 * for VIPOS production is **Cloudflare R2** (zero-egress pricing,
 * S3-compatible API), but every helper here is provider-neutral and
 * exercised in CI against MinIO.
 *
 * ## Environment contract
 *
 *   S3_ENDPOINT         override SDK endpoint (e.g.
 *                       `https://<account>.r2.cloudflarestorage.com`).
 *                       Required for R2 / B2 / MinIO; omit for AWS S3.
 *   S3_REGION           AWS region. Defaults to `auto` for R2, `us-east-1`
 *                       otherwise.
 *   S3_ACCESS_KEY_ID    access key id.
 *   S3_SECRET_ACCESS_KEY secret key.
 *   S3_BUCKET           backup bucket. **Backup is no-op when this is unset**
 *                       so PR-A ships safely on hosts without R2 wired up.
 *   S3_FORCE_PATH_STYLE set to `1` for MinIO / non-AWS that requires
 *                       path-style addressing. Auto-enabled when the
 *                       endpoint hostname is `localhost` / `127.0.0.1`.
 *
 * ## Public surface
 *
 *   isStorageEnabled()       -> boolean
 *   getS3Client()            -> S3Client | null
 *   putObject(key, body, md) -> Promise<void>
 *   listObjects(prefix)      -> Promise<Array<{Key, Size, LastModified}>>
 *   headObject(key)          -> Promise<{Size, LastModified, Metadata} | null>
 *   getObjectStream(key)     -> Promise<Readable | null>
 *   deleteObject(key)        -> Promise<void>
 *   _resetForTests()         clears the cached client (test isolation)
 */
const {
  S3Client,
  ListObjectsV2Command,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { logger } = require('./logger');

const log = logger.child({ component: 'storage' });

let cachedClient = null;
let cachedBucket = null;

/**
 * @returns {boolean} true when both `S3_BUCKET` and credentials are set
 *   so the rest of the codebase can call into S3 without crashing.
 */
function isStorageEnabled() {
  return Boolean(
    process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
  );
}

/**
 * @returns {string} the configured bucket name. Throws if storage is
 *   not configured — callers should guard with `isStorageEnabled()`.
 */
function getBucket() {
  if (!isStorageEnabled()) {
    throw new Error('S3 storage is not configured (missing S3_BUCKET / creds)');
  }
  return process.env.S3_BUCKET;
}

function shouldUsePathStyle(endpoint) {
  if (process.env.S3_FORCE_PATH_STYLE === '1') return true;
  if (!endpoint) return false;
  try {
    const url = new URL(endpoint);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function defaultRegion(endpoint) {
  if (process.env.S3_REGION) return process.env.S3_REGION;
  // Cloudflare R2 expects literally `auto`. AWS S3 needs a real region.
  if (endpoint && /\.r2\.cloudflarestorage\.com$/.test(new URL(endpoint).hostname)) {
    return 'auto';
  }
  return 'us-east-1';
}

/**
 * Lazily constructs and caches a single S3 client per process. Returns
 * `null` when storage is disabled so callers can short-circuit.
 *
 * @returns {import('@aws-sdk/client-s3').S3Client | null}
 */
function getS3Client() {
  if (!isStorageEnabled()) return null;
  if (cachedClient && cachedBucket === process.env.S3_BUCKET) return cachedClient;

  const endpoint = process.env.S3_ENDPOINT;
  const region = defaultRegion(endpoint);
  cachedClient = new S3Client({
    endpoint: endpoint || undefined,
    region,
    forcePathStyle: shouldUsePathStyle(endpoint),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });
  cachedBucket = process.env.S3_BUCKET;
  log.info(
    { bucket: cachedBucket, endpoint: endpoint || '(default AWS)', region },
    'S3 client initialised'
  );
  return cachedClient;
}

/**
 * Upload a Buffer or Readable stream to S3. Uses the high-level
 * `Upload` helper from `@aws-sdk/lib-storage` so streams of any size
 * are multipart-uploaded transparently.
 *
 * @param {string} key
 * @param {Buffer | NodeJS.ReadableStream} body
 * @param {object} [opts]
 * @param {Record<string,string>} [opts.metadata] custom metadata, attached
 *   to the object via the `x-amz-meta-*` headers.
 * @param {string} [opts.contentType]
 */
async function putObject(key, body, opts = {}) {
  const client = getS3Client();
  if (!client) throw new Error('S3 storage is not configured');
  const upload = new Upload({
    client,
    params: {
      Bucket: getBucket(),
      Key: key,
      Body: body,
      Metadata: opts.metadata,
      ContentType: opts.contentType,
    },
  });
  await upload.done();
}

/**
 * List every object under `prefix`. Pages through ContinuationToken
 * automatically. Returns an array of `{Key, Size, LastModified}` for
 * easy consumption by the retention + uploads-sync workers.
 *
 * @param {string} prefix
 * @returns {Promise<Array<{Key: string, Size: number, LastModified: Date}>>}
 */
async function listObjects(prefix) {
  const client = getS3Client();
  if (!client) return [];
  const out = [];
  let token;
  do {
    const resp = await client.send(
      new ListObjectsV2Command({
        Bucket: getBucket(),
        Prefix: prefix,
        ContinuationToken: token,
      })
    );
    for (const obj of resp.Contents || []) {
      out.push({ Key: obj.Key, Size: obj.Size ?? 0, LastModified: obj.LastModified });
    }
    token = resp.IsTruncated ? resp.NextContinuationToken : undefined;
  } while (token);
  return out;
}

/**
 * Fetch object metadata. Returns null when the object doesn't exist
 * (so callers can use this as a cheap existence check before deciding
 * whether to re-upload).
 *
 * @param {string} key
 * @returns {Promise<{Size: number, LastModified: Date, Metadata: Record<string,string>} | null>}
 */
async function headObject(key) {
  const client = getS3Client();
  if (!client) return null;
  try {
    const resp = await client.send(new HeadObjectCommand({ Bucket: getBucket(), Key: key }));
    return {
      Size: resp.ContentLength ?? 0,
      LastModified: resp.LastModified,
      Metadata: resp.Metadata || {},
    };
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NotFound') {
      return null;
    }
    throw err;
  }
}

/**
 * Stream an object back. Returns null when storage is disabled.
 * Restore scripts pipe this into psql / file write.
 *
 * @param {string} key
 * @returns {Promise<NodeJS.ReadableStream | null>}
 */
async function getObjectStream(key) {
  const client = getS3Client();
  if (!client) return null;
  const resp = await client.send(new GetObjectCommand({ Bucket: getBucket(), Key: key }));
  return resp.Body;
}

/**
 * Delete a single object. Used by the retention worker when an old
 * `daily/` snapshot rolls past 30 days.
 *
 * @param {string} key
 */
async function deleteObject(key) {
  const client = getS3Client();
  if (!client) throw new Error('S3 storage is not configured');
  await client.send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}

/**
 * Test helper — clears the cached client + bucket so each test can
 * mutate `process.env` freely. Not exported for runtime use.
 */
function _resetForTests() {
  cachedClient = null;
  cachedBucket = null;
}

module.exports = {
  isStorageEnabled,
  getS3Client,
  putObject,
  listObjects,
  headObject,
  getObjectStream,
  deleteObject,
  _resetForTests,
};
