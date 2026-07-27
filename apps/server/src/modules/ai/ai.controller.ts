import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';

@Controller('api/ai')
export class AiController {
  @Post('models')
  async listModels(@Body() body: { apiBaseUrl: string; apiKey: string }) {
    const { apiBaseUrl, apiKey } = body;

    if (!apiBaseUrl || !apiKey) {
      throw new HttpException('缺少 apiBaseUrl 或 apiKey', HttpStatus.BAD_REQUEST);
    }

    // 兼容各类 OpenAI 兼容接口的 /models 路径
    const urls = [
      apiBaseUrl.replace(/\/+$/, '') + '/models',
      apiBaseUrl.replace(/\/+$/, '') + '/v1/models',
    ];

    let lastError: Error | null = null;

    for (const url of urls) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
          signal: controller.signal as any,
        });
        clearTimeout(timer);

        if (!response.ok) {
          lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
          continue;
        }

        const data = await response.json();
        // OpenAI 返回格式: { data: [{ id: 'gpt-4o', ... }] }
        // 通义千问返回: { data: [{ id: 'qwen-vl-plus' }] }
        // 兜底: 尝试解析
        let models: string[] = [];
        if (Array.isArray(data?.data)) {
          models = data.data.map((m: any) => m.id).filter(Boolean);
        } else if (Array.isArray(data)) {
          models = data.map((m: any) => m.id || m).filter(Boolean);
        }

        models.sort();

        return { success: true, models, total: models.length };
      } catch (e: any) {
        if (e.name === 'AbortError') {
          lastError = new Error('请求超时（10秒）');
        } else {
          lastError = e;
        }
      }
    }

    throw new HttpException(
      `无法获取模型列表：${lastError?.message || '未知错误'}`,
      HttpStatus.BAD_GATEWAY,
    );
  }
}
