import { Command } from 'commander';

const program = new Command();

program
  .name('tk-workflow')
  .description('TK AI Video Pipeline CLI')
  .version('0.1.0');

program
  .command('run <workflow-id>')
  .description('执行指定工作流')
  .action(async (workflowId: string) => {
    console.log(`执行工作流: ${workflowId}`);
    // 后续接入核心引擎
  });

program
  .command('fetch')
  .description('手动触发 TK 视频抓取')
  .option('-k, --keyword <keyword>', '搜索关键词')
  .option('-c, --count <count>', '抓取数量', '10')
  .action(async (options) => {
    console.log(`抓取 TK 视频: ${options.keyword} x${options.count}`);
    // 后续接入抓取节点
  });

program.parse(process.argv);
