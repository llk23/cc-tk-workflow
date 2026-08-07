import { Controller, Post, Get, Query, Body, HttpException, HttpStatus } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Controller('api/ai')
export class AiController {
  /** WorkBuddy CLI 内置产品配置（含可用模型列表） */
  private static readonly PRODUCT_JSON_CANDIDATES = [
    process.env.WORKBUDDY_CLI_DIR
      ? path.join(process.env.WORKBUDDY_CLI_DIR, 'product.json')
      : '',
    'D:/workbuddy/resources/app.asar.unpacked/cli/product.json',
    'D:/workbuddy/resources/app.asar.unpacked/cli/product.internal.json',
    'C:/Program Files/WorkBuddy/resources/app.asar.unpacked/cli/product.json',
  ];

  /** 项目 skills 根目录候选（按优先级） */
  private static readonly SKILLS_ROOT_CANDIDATES = [
    process.env.WORKSPACE_ROOT ? path.join(process.env.WORKSPACE_ROOT, '.claude', 'skills') : '',
    path.join(process.cwd(), '.claude', 'skills'),
    'D:/cursor-use/TK-workflow-cc/.claude/skills',
  ];

  /**
   * 获取项目已安装的 Skills 列表
   * 兼容两种形态：
   *  - 目录型：<skills>/<name>/SKILL.md
   *  - 单文件型：<skills>/<name>.md
   * 读取 frontmatter 的 name/description，无 frontmatter 用文件名兜底。
   */
  @Post('skills')
  async listSkills(@Body() body: { path?: string }) {
    const skillsRoot = AiController.SKILLS_ROOT_CANDIDATES.filter(Boolean).find((p) => fs.existsSync(p));
    if (!skillsRoot) {
      throw new HttpException('未找到项目 .claude/skills 目录', HttpStatus.NOT_FOUND);
    }

    // 指定 path 时返回单个 skill 全文
    const reqPath = body?.path;
    if (reqPath) {
      return this.readSkillFull(skillsRoot, reqPath);
    }

    const list: Array<{ name: string; path: string; description: string }> = [];
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(skillsRoot, { withFileTypes: true });
    } catch {
      entries = [];
    }

    for (const ent of entries) {
      const entryName = ent.name;
      if (entryName.startsWith('.')) continue; // 过滤隐藏项

      let skillPath = '';
      if (ent.isDirectory()) {
        skillPath = path.join(entryName, 'SKILL.md');
      } else if (entryName.endsWith('.md')) {
        skillPath = entryName;
      }
      if (!skillPath) continue;

      const abs = path.join(skillsRoot, skillPath);
      if (!fs.existsSync(abs)) continue;

      const { name, description } = this.parseFrontmatter(fs.readFileSync(abs, 'utf-8'));
      list.push({
        name: name || entryName.replace(/\.md$/, ''),
        path: skillPath,
        description: description || '',
      });
    }

    // 排序：目录型优先（主技能），其余按名称
    list.sort((a, b) => {
      const aDir = !a.path.includes('/') ? 0 : 1;
      const bDir = !b.path.includes('/') ? 0 : 1;
      if (aDir !== bDir) return aDir - bDir;
      return a.name.localeCompare(b.name, 'zh-CN');
    });

    return { success: true, root: skillsRoot, skills: list, total: list.length };
  }

  /** 读取单个 skill 全文（按 path 相对 skills 根） */
  private readSkillFull(skillsRoot: string, relPath: string) {
    const root = path.resolve(skillsRoot);
    const abs = path.resolve(skillsRoot, relPath);
    // 防目录穿越（resolve 后分隔符一致，可直接比较前缀）
    if (abs !== root && !abs.startsWith(root + path.sep)) {
      throw new HttpException('非法路径', HttpStatus.BAD_REQUEST);
    }
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      throw new HttpException(`Skill 不存在: ${relPath}`, HttpStatus.NOT_FOUND);
    }
    const content = fs.readFileSync(abs, 'utf-8');
    const { name, description } = this.parseFrontmatter(content);
    return {
      success: true,
      name: name || path.basename(relPath).replace(/\.md$/, ''),
      path: relPath,
      description: description || '',
      content,
      length: content.length,
    };
  }

  /** 解析 SKILL.md frontmatter（--- 包裹的 YAML，只取 name/description） */
  private parseFrontmatter(raw: string): { name: string; description: string } {
    const result = { name: '', description: '' };
    const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) return result;
    for (const line of m[1].split(/\r?\n/)) {
      const kv = line.match(/^([a-zA-Z-]+):\s*(.*)$/);
      if (!kv) continue;
      const key = kv[1].trim();
      const val = kv[2].trim().replace(/^["']|["']$/g, '');
      if (key === 'name') result.name = val;
      if (key === 'description') result.description = val;
    }
    return result;
  }

  /**
   * 获取 WorkBuddy Agent 可用模型列表
   * 数据来源：WorkBuddy CLI 安装目录下的 product.json（models 字段）
   */
  @Post('workbuddy-models')
  async listWorkbuddyModels() {
    const candidates = AiController.PRODUCT_JSON_CANDIDATES.filter(Boolean);
    let lastError: string | null = null;

    for (const p of candidates) {
      try {
        if (!fs.existsSync(p)) continue;
        const raw = JSON.parse(fs.readFileSync(p, 'utf-8'));
        const models = Array.isArray(raw?.models) ? raw.models : [];
        // 过滤出适合对话/分析用的模型（带 id 且有 tool 能力优先，但全部返回让用户自选）
        const list = models
          .filter((m: any) => m && m.id)
          .map((m: any) => ({
            id: m.id,
            name: m.name || m.id,
            credits: m.credits || '',
            supportsImages: !!m.supportsImages,
            supportsToolCall: !!m.supportsToolCall,
            maxInputTokens: m.maxInputTokens || 0,
            descriptionZh: m.descriptionZh || '',
          }));
        return { success: true, source: p, models: list, total: list.length };
      } catch (e: any) {
        lastError = e.message || String(e);
      }
    }

    throw new HttpException(
      `无法获取 WorkBuddy 模型列表：${lastError || '未找到 product.json'}`,
      HttpStatus.BAD_GATEWAY,
    );
  }

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
