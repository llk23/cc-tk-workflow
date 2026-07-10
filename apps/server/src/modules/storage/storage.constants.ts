/**
 * 对象存储 Bucket 定义
 * 视频/音频/抽帧等大文件统一走对象存储，不再塞进 SQL Server
 */
export const STORAGE_BUCKETS = {
  /** 原始抓取的视频 */
  VIDEOS: 'tk-videos',
  /** 生成的视频 */
  GENERATED: 'tk-generated',
  /** 音频(配音/BGM) */
  AUDIO: 'tk-audio',
  /** 抽帧图 */
  FRAMES: 'tk-frames',
} as const;

export type BucketName = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];
