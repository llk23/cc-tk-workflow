import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { StorageService } from './storage.interface';

/**
 * 本地文件系统存储实现（兜底）
 * 当未配置 MINIO_ENDPOINT 时启用，便于本地开发/无 Docker 环境也能跑通链路。
 * 生产环境请使用 MinioStorageService。
 */
@Injectable()
export class LocalStorageService implements StorageService {
  private baseDir = path.resolve(process.cwd(), '.storage');

  private bucketDir(bucket: string): string {
    return path.join(this.baseDir, bucket);
  }

  async ensureBucket(bucket: string): Promise<void> {
    await fs.mkdir(this.bucketDir(bucket), { recursive: true });
  }

  async uploadBuffer(bucket: string, key: string, data: Buffer): Promise<string> {
    const dir = this.bucketDir(bucket);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);
    return key;
  }

  async downloadBuffer(bucket: string, key: string): Promise<Buffer> {
    return fs.readFile(path.join(this.bucketDir(bucket), key));
  }

  async getUrl(bucket: string, key: string): Promise<string> {
    // 本地模式返回绝对路径（节点侧可直接读取文件）
    return `file://${path.join(this.bucketDir(bucket), key)}`;
  }

  async remove(bucket: string, key: string): Promise<void> {
    await fs.rm(path.join(this.bucketDir(bucket), key), { force: true });
  }
}
