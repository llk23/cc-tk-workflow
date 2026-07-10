import { Injectable } from '@nestjs/common';
import * as Minio from 'minio';
import { StorageService } from './storage.interface';

/**
 * MinIO 对象存储实现（S3 兼容）
 * 用于生产环境存放视频/音频/抽帧等大文件。
 */
@Injectable()
export class MinioStorageService implements StorageService {
  private client: Minio.Client;
  private bucketCache = new Set<string>();

  constructor() {
    this.client = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: Number(process.env.MINIO_PORT || 9000),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    });
  }

  async ensureBucket(bucket: string): Promise<void> {
    if (this.bucketCache.has(bucket)) return;
    const exists = await this.client.bucketExists(bucket);
    if (!exists) await this.client.makeBucket(bucket);
    this.bucketCache.add(bucket);
  }

  async uploadBuffer(bucket: string, key: string, data: Buffer, _contentType?: string): Promise<string> {
    await this.ensureBucket(bucket);
    await this.client.putObject(bucket, key, data);
    return key;
  }

  async downloadBuffer(bucket: string, key: string): Promise<Buffer> {
    const stream = await this.client.getObject(bucket, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks);
  }

  async getUrl(bucket: string, key: string): Promise<string> {
    // 1 小时有效签名 URL
    return this.client.presignedGetObject(bucket, key, 3600);
  }

  async remove(bucket: string, key: string): Promise<void> {
    await this.client.removeObject(bucket, key);
  }
}
