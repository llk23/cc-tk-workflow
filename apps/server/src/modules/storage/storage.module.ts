import { Module } from '@nestjs/common';
import { StorageService } from './storage.interface';
import { MinioStorageService } from './minio-storage.service';
import { LocalStorageService } from './local-storage.service';
import { STORAGE_BUCKETS } from './storage.constants';

/**
 * 对象存储模块
 * 根据环境变量选择实现：
 *  - 配置了 MINIO_ENDPOINT → MinioStorageService
 *  - 未配置 → LocalStorageService（本地兜底）
 */
@Module({
  providers: [
    {
      provide: 'STORAGE_SERVICE',
      useFactory: (): StorageService => {
        const useMinio = !!process.env.MINIO_ENDPOINT;
        return useMinio ? new MinioStorageService() : new LocalStorageService();
      },
    },
  ],
  exports: ['STORAGE_SERVICE'],
})
export class StorageModule {
  /** 预创建默认 bucket（本地兜底模式下即建目录） */
  static readonly BUCKETS = STORAGE_BUCKETS;
}
