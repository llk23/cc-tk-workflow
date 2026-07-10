/**
 * 对象存储抽象接口
 * 实现：MinioStorageService(S3 兼容) / LocalStorageService(本地兜底)
 * 节点(fetch/analyze/generate)只依赖此接口，不关心底层是 MinIO 还是本地磁盘。
 */
export interface StorageService {
  /** 确保 bucket 存在（不存在则创建） */
  ensureBucket(bucket: string): Promise<void>;

  /**
   * 上传二进制
   * @returns 可用于后续下载/访问的 key（或公开 URL）
   */
  uploadBuffer(bucket: string, key: string, data: Buffer, contentType?: string): Promise<string>;

  /** 下载二进制 */
  downloadBuffer(bucket: string, key: string): Promise<Buffer>;

  /** 获取可访问的 URL（MinIO 走签名 URL，本地走 file:// 路径） */
  getUrl(bucket: string, key: string): Promise<string>;

  /** 删除对象 */
  remove(bucket: string, key: string): Promise<void>;
}
