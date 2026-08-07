// ==========================================
// Skill 配置节点
// ==========================================
// 作用：列出项目中已安装的 skills（前端通过 /api/ai/skills 拉取），
//       用户选择本次任务使用的 skill，节点读取该 skill 的 SKILL.md 全文
//       输出给下游（分析节点注入 prompt）。
// 输出契约：{ name, path, content, description }
// ==========================================

import { BaseNode, NodeDefinition, NodeExecutionContext } from '../base/base-node';
import { NodeConfig, NodeTypeEnum } from '@tk-workflow/types';
import * as fs from 'fs';
import * as path from 'path';

/** 项目 skills 根目录候选（按优先级） */
const SKILLS_ROOT_CANDIDATES = [
  process.env.WORKSPACE_ROOT ? path.join(process.env.WORKSPACE_ROOT, '.claude', 'skills') : '',
  path.join(process.cwd(), '.claude', 'skills'),
  'D:/cursor-use/TK-workflow-cc/.claude/skills',
];

export class SkillConfigNode extends BaseNode {
  static definition: NodeDefinition = {
    type: NodeTypeEnum.SKILL_CONFIG,
    label: 'Skill 配置',
    description: '选择项目已安装的 skill，输出其内容供下游节点使用',
    category: 'config',
    icon: '📚',
    inputs: [{ id: 'trigger', name: '触发信号', type: 'any', required: false }],
    outputs: [{ id: 'skill', name: 'Skill 内容', type: 'any', required: true }],
    defaultConfig: {
      skillName: '',
      skillPath: '',
    },
  };

  /** 定位 skills 根目录 */
  private findSkillsRoot(): string {
    for (const p of SKILLS_ROOT_CANDIDATES) {
      if (p && fs.existsSync(p)) return p;
    }
    return '';
  }

  /** 解析 frontmatter 的 name/description */
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

  async execute(config: NodeConfig, _input: unknown, ctx: NodeExecutionContext): Promise<unknown> {
    const cfg = config as any;
    const skillName = String(cfg.skillName || '').trim();
    const skillPath = String(cfg.skillPath || '').trim();

    if (!skillPath && !skillName) {
      ctx.logger('⚠️ 未选择任何 skill，请在配置面板中选择');
      return { name: '', path: '', content: '', description: '', selected: false };
    }

    const root = this.findSkillsRoot();
    if (!root) {
      throw new Error('未找到项目 .claude/skills 目录');
    }

    // 确定相对路径：优先用 skillPath，兜底按名称搜索
    let relPath = skillPath;
    if (!relPath) {
      // 按名称搜索：目录型 <name>/SKILL.md 或单文件型 <name>.md
      const dirAbs = path.join(root, skillName, 'SKILL.md');
      const fileAbs = path.join(root, skillName + '.md');
      if (fs.existsSync(dirAbs)) relPath = path.join(skillName, 'SKILL.md');
      else if (fs.existsSync(fileAbs)) relPath = skillName + '.md';
    }

    if (!relPath) {
      throw new Error(`未找到 skill: ${skillName}`);
    }

    const abs = path.resolve(root, relPath);
    const rootResolved = path.resolve(root);
    if (abs !== rootResolved && !abs.startsWith(rootResolved + path.sep)) {
      throw new Error('非法 skill 路径');
    }
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      throw new Error(`skill 文件不存在: ${relPath}`);
    }

    const content = fs.readFileSync(abs, 'utf-8');
    const { name, description } = this.parseFrontmatter(content);

    ctx.logger(`  ✅ 已加载 skill: ${name || relPath} (${content.length} 字符)`);

    return {
      name: name || skillName,
      path: relPath,
      content,
      description: description || '',
      selected: true,
    };
  }
}
