import { BaseNode, NodeDefinition, NodeExecutionContext } from '../base/base-node';
import { NodeConfig, NodeTypeEnum } from '@tk-workflow/types';
import * as fs from 'fs';

/**
 * AI 模型配置节点
 *
 * 两套能力：
 * 1. OpenAI 兼容直调（apiBaseUrl / apiKey / model）——供直调类分析节点使用
 * 2. WorkBuddy Agent 运行时（cliPath / nodePath / model / permissionMode / workingDir）——供 Agent 类分析节点使用
 *
 * 校验规则（条件校验，至少满足其一）：
 * - 填了 apiBaseUrl + apiKey + model → 直调场景放行
 * - 填了 cliPath（Agent CLI）→ Agent 场景放行
 * 两者都未满足 → 报错
 *
 * 输出 modelConfig 对象，由引擎在合并时保留为 inputObj.modelConfig。
 */
export class ModelConfigNode extends BaseNode {
  static definition: NodeDefinition = {
    type: NodeTypeEnum.MODEL_CONFIG,
    label: 'AI 模型配置',
    description: '配置 OpenAI 兼容模型 或 WorkBuddy Agent 运行时（CLI/Node/模型/权限/工作目录）',
    category: 'config',
    icon: '🤖',
    inputs: [{ id: 'trigger', name: '触发信号', type: 'any', required: false }],
    outputs: [{ id: 'model-config', name: '模型配置', type: 'any', required: true }],
    defaultConfig: {
      apiBaseUrl: '',
      apiKey: '',
      model: '',
      agentModel: '',
      cliPath: '',
      nodePath: '',
      permissionMode: 'bypassPermissions',
      workingDir: '',
    },
  };

  /** 探测可用的 CLI 脚本路径 */
  private findCliPath(configured: string): string {
    if (configured && fs.existsSync(configured)) return configured;
    const candidates = [
      'D:/workbuddy/resources/app.asar.unpacked/cli/dist/codebuddy.js',
      'D:/workbuddy/resources/app.asar.unpacked/cli/bin/codebuddy',
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return '';
  }

  /** 探测可用的 Node 可执行路径 */
  private findNodePath(configured: string): string {
    if (configured && fs.existsSync(configured)) return configured;
    const candidates = [
      'C:/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2/node.exe',
      'C:/Program Files/nodejs/node.exe',
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return 'node'; // 最后回退到 PATH
  }

  async execute(config: NodeConfig, _input: unknown, ctx: NodeExecutionContext): Promise<unknown> {
    const cfg = config as any;
    const apiBaseUrl = String(cfg.apiBaseUrl || '').trim();
    const apiKey = String(cfg.apiKey || '').trim();
    const model = String(cfg.model || '').trim();
    const agentModel = String(cfg.agentModel || '').trim(); // WorkBuddy CLI 网关模型（如 deepseek-v4-flash），与直调 model 独立
    const cliPathConfigured = String(cfg.cliPath || '').trim();
    const nodePathConfigured = String(cfg.nodePath || '').trim();
    const permissionMode = String(cfg.permissionMode || 'bypassPermissions').trim();
    const workingDir = String(cfg.workingDir || '').trim() || 'D:/cursor-use/TK-workflow-cc';

    // 条件校验：OpenAI 三件套 或 Agent CLI，至少满足其一
    const openaiReady = !!(apiBaseUrl && apiKey && model);
    const agentReady = !!cliPathConfigured || !!this.findCliPath(cliPathConfigured);

    if (!openaiReady && !agentReady) {
      throw new Error(
        '模型配置不完整：请填写 OpenAI 三件套（API 地址/Key/模型）用于直调，或填写 WorkBuddy CLI 路径用于 Agent 分析，至少满足其一',
      );
    }

    const cliPath = cliPathConfigured || this.findCliPath('');
    const nodePath = nodePathConfigured || this.findNodePath('');

    const out: Record<string, any> = { configured: true };
    if (openaiReady) {
      out.apiBaseUrl = apiBaseUrl;
      out.apiKey = apiKey;
      out.model = model;
    }
    if (agentReady) {
      out.cliPath = cliPath;
      out.nodePath = nodePath;
      out.permissionMode = permissionMode;
      out.workingDir = workingDir;
      out.agentModel = agentModel; // Agent 专用模型（空则走 CLI 默认 auto）
    }

    ctx.logger(
      agentReady
        ? `[Agent 配置] CLI=${cliPath} node=${nodePath} model=${agentModel || '(CLI默认 auto)'} perm=${permissionMode}`
        : `[OpenAI 配置] ${apiBaseUrl} / ${model}`,
    );

    return out;
  }
}
