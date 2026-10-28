import type { S3Client } from '@aws-sdk/client-s3';
import { getR2ObjectPath, getR2PublicUrl, isR2PublicBucket, resolveR2BucketName } from '@/lib/r2Public';

type UploadOptions = {
  contentType?: string;
  upsert?: boolean;
};

type StorageError = {
  message: string;
};

let publicR2Client: S3Client | null = null;
let privateR2Client: S3Client | null = null;

function getRequiredEnvironmentValue(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name}이 설정되지 않았습니다.`);
  }

  return value;
}

async function getR2Client(isPublicBucket: boolean) {
  const cachedClient = isPublicBucket ? publicR2Client : privateR2Client;

  if (cachedClient) {
    return cachedClient;
  }

  const { S3Client } = await import('@aws-sdk/client-s3');
  const accessKeyId = getRequiredEnvironmentValue(
    isPublicBucket ? 'R2_ACCESS_KEY_ID' : 'R2_PRIVATE_ACCESS_KEY_ID',
  );
  const secretAccessKey = getRequiredEnvironmentValue(
    isPublicBucket ? 'R2_SECRET_ACCESS_KEY' : 'R2_PRIVATE_SECRET_ACCESS_KEY',
  );
  const client = new S3Client({
    credentials: { accessKeyId, secretAccessKey },
    endpoint: getRequiredEnvironmentValue('R2_ENDPOINT'),
    region: 'auto',
  });

  if (isPublicBucket) {
    publicR2Client = client;
  } else {
    privateR2Client = client;
  }

  return client;
}

function toStorageError(error: unknown): StorageError {
  return {
    message: error instanceof Error ? error.message : 'R2 저장소 작업에 실패했습니다.',
  };
}

function createBucketStorage(bucket: string) {
  const r2Bucket = resolveR2BucketName(bucket);
  const isPublicBucket = isR2PublicBucket(bucket);

  return {
    getPublicUrl(value: string) {
      return {
        data: {
          publicUrl: getR2PublicUrl(bucket, value),
        },
      };
    },
    async upload(value: string, body: ArrayBuffer | Blob | Buffer | Uint8Array, options: UploadOptions = {}) {
      const objectPath = getR2ObjectPath(value);

      try {
        const [{ PutObjectCommand }, client] = await Promise.all([
          import('@aws-sdk/client-s3'),
          getR2Client(isPublicBucket),
        ]);
        const uploadBody =
          body instanceof Blob
            ? Buffer.from(await body.arrayBuffer())
            : body instanceof ArrayBuffer
              ? Buffer.from(body)
              : body;

        await client.send(
          new PutObjectCommand({
            Bucket: r2Bucket,
            Key: objectPath,
            Body: uploadBody,
            ContentType: options.contentType,
          }),
        );

        return {
          data: {
            fullPath: objectPath,
            id: objectPath,
            path: objectPath,
          },
          error: null,
        };
      } catch (error) {
        return { data: null, error: toStorageError(error) };
      }
    },
    async remove(values: string[]) {
      const objects = values
        .map(getR2ObjectPath)
        .filter(Boolean)
        .map((Key) => ({ Key }));

      if (!objects.length) {
        return { data: [], error: null };
      }

      try {
        const [{ DeleteObjectsCommand }, client] = await Promise.all([
          import('@aws-sdk/client-s3'),
          getR2Client(isPublicBucket),
        ]);
        const input = {
          Bucket: r2Bucket,
          Delete: { Objects: objects, Quiet: true },
        };
        await client.send(new DeleteObjectsCommand(input));

        return { data: values, error: null };
      } catch (error) {
        return { data: null, error: toStorageError(error) };
      }
    },
    async createSignedUrl(value: string, expiresIn: number) {
      const objectPath = getR2ObjectPath(value);

      try {
        const [{ GetObjectCommand }, { getSignedUrl }, client] = await Promise.all([
          import('@aws-sdk/client-s3'),
          import('@aws-sdk/s3-request-presigner'),
          getR2Client(isPublicBucket),
        ]);
        const signedUrl = await getSignedUrl(client, new GetObjectCommand({ Bucket: r2Bucket, Key: objectPath }), {
          expiresIn,
        });

        return { data: { signedUrl }, error: null };
      } catch (error) {
        return { data: null, error: toStorageError(error) };
      }
    },
  };
}

export const r2Storage = {
  from(bucket: string) {
    return createBucketStorage(bucket);
  },
};
