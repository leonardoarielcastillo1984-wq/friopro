import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile, unlink, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';

// ──────────────────────────────────────────────────────────────
// Interfaz abstracta de almacenamiento
// ──────────────────────────────────────────────────────────────

export interface StorageProvider {
  upload(key: string, buffer: Buffer, contentType?: string): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

// ──────────────────────────────────────────────────────────────
// Implementación local (desarrollo)
// ──────────────────────────────────────────────────────────────

class LocalStorageProvider implements StorageProvider {
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || process.env.STORAGE_LOCAL_PATH || './uploads';
  }

  async upload(key: string, buffer: Buffer): Promise<string> {
    const fullPath = join(this.basePath, key);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, buffer);
    return key;
  }

  async download(key: string): Promise<Buffer> {
    const fullPath = join(this.basePath, key);
    return readFile(fullPath);
  }

  async delete(key: string): Promise<void> {
    const fullPath = join(this.basePath, key);
    try {
      await unlink(fullPath);
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    const fullPath = join(this.basePath, key);
    try {
      await access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}

// ──────────────────────────────────────────────────────────────
// Implementación S3 (producción)
//
// Variables de entorno:
//   AWS_REGION          — e.g. 'us-east-1'
//   AWS_ACCESS_KEY_ID   — IAM access key
//   AWS_SECRET_ACCESS_KEY — IAM secret
//   S3_BUCKET           — bucket name
//   S3_ENDPOINT         — (opcional) para MinIO / R2 / DigitalOcean Spaces
// ──────────────────────────────────────────────────────────────

class S3StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucket: string;

  constructor() {
    const region = process.env.AWS_REGION || 'us-east-1';
    const endpoint = process.env.S3_ENDPOINT;
    this.bucket = process.env.S3_BUCKET || '';

    if (!this.bucket) {
      throw new Error('[storage] S3_BUCKET is required when STORAGE_BACKEND=s3');
    }

    this.client = new S3Client({
      region,
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    });
  }

  async upload(key: string, buffer: Buffer, contentType?: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType || 'application/octet-stream',
      })
    );
    return key;
  }

  async download(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key })
    );

    if (!response.Body) {
      throw new Error(`[storage] Empty body for key: ${key}`);
    }

    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key })
      );
      return true;
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw err;
    }
  }
}

// ──────────────────────────────────────────────────────────────
// Factory
// ──────────────────────────────────────────────────────────────

let _instance: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (!_instance) {
    const backend = process.env.STORAGE_BACKEND || 'local';

    if (backend === 's3') {
      _instance = new S3StorageProvider();
    } else {
      _instance = new LocalStorageProvider();
    }
  }
  return _instance;
}

// ──────────────────────────────────────────────────────────────
// Utilidades
// ──────────────────────────────────────────────────────────────

export function computeFileHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function buildStorageKey(tenantId: string, normativeId: string, fileName: string): string {
  return `${tenantId}/${normativeId}/${fileName}`;
}
