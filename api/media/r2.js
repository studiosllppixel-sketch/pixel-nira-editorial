import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required R2 configuration: ${name}`);
  return value;
}

export function r2Config() {
  const accountId = requiredEnv('R2_ACCOUNT_ID');
  return {
    accountId,
    bucket: requiredEnv('R2_BUCKET_NAME'),
    client: new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: requiredEnv('R2_ACCESS_KEY_ID'),
        secretAccessKey: requiredEnv('R2_SECRET_ACCESS_KEY')
      }
    })
  };
}

export async function presignR2Upload({ pathname, contentType, size }) {
  const { client, bucket } = r2Config();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: pathname,
    ContentType: contentType,
    ContentLength: size
  });
  return getSignedUrl(client, command, { expiresIn: 600 });
}

export async function readR2Object(pathname) {
  const { client, bucket } = r2Config();
  return client.send(new GetObjectCommand({ Bucket: bucket, Key: pathname }));
}

export async function deleteR2Object(pathname) {
  const { client, bucket } = r2Config();
  return client.send(new DeleteObjectCommand({ Bucket: bucket, Key: pathname }));
}
