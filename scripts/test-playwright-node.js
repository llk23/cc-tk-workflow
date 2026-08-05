// 临时测试脚本：直接实例化 Playwright 版抓取节点验证功能
const { FetchTKPlaywrightNode } = require('D:/cursor-use/TK-workflow-cc/packages/nodes/dist/fetch/playwright');

async function main() {
  const node = new FetchTKPlaywrightNode();
  const logs = [];
  const ctx = {
    pipelineId: 'test',
    node: { id: 'test-node', type: 'fetch-tk-playwright', label: '测试', position: { x: 0, y: 0 }, config: {} },
    logger: (m) => { logs.push(m); console.log('[LOG]', m); },
    onProgress: (p) => { /* console.log('进度', p + '%'); */ },
  };

  const config = {
    keyword: 'travel bag',
    maxCount: 3,
    region: 'US',
    sortBy: 'relevance',
    minPlays: 0,
    minLikes: 0,
    commerceSource: 'all',
    commerceOnly: false,
    autoDownload: false,
    videoDuration: 'all',
    publishTime: 'all',
  };

  try {
    const result = await node.execute(config, {}, ctx);
    console.log('\n=== 执行结果 ===');
    console.log('success:', result.success);
    console.log('total:', result.total);
    console.log('dataSource:', result.dataSource);
    console.log('commerceCount:', result.commerceCount);
    console.log('videos 前3条:');
    for (const v of (result.videos || []).slice(0, 3)) {
      console.log('  -', JSON.stringify({ id: v.id, author: v.author, plays: v.plays, likes: v.likes, isCommerce: v.isCommerce }));
    }
    console.log('\n=== 日志 ===');
    logs.forEach((l) => console.log(' ', l));
    process.exit(0);
  } catch (e) {
    console.error('\n=== 执行失败 ===');
    console.error(e);
    console.log('\n=== 日志 ===');
    logs.forEach((l) => console.log(' ', l));
    process.exit(1);
  }
}

main();
