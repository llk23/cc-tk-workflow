// 带 Cookie 测试新节点
const fs = require('fs');
const path = require('path');
const { FetchTKPlaywrightNode } = require('D:/cursor-use/TK-workflow-cc/packages/nodes/dist/fetch/playwright');

async function main() {
  const cookie = fs.readFileSync(path.join('D:/cursor-use/TK-workflow-cc/.cache/test_cookie.txt'), 'utf-8').trim();
  const node = new FetchTKPlaywrightNode();
  const logs = [];
  const ctx = {
    pipelineId: 'test',
    node: { id: 'test-node', type: 'fetch-tk-playwright', label: '测试', position: { x: 0, y: 0 }, config: {} },
    logger: (m) => { logs.push(m); console.log('[LOG]', m); },
    onProgress: () => {},
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
    const result = await node.execute(config, { 'tk-account-verify': { cookie, valid: true } }, ctx);
    console.log('\n=== 执行结果 ===');
    console.log('success:', result.success);
    console.log('total:', result.total);
    console.log('dataSource:', result.dataSource);
    console.log('commerceCount:', result.commerceCount);
    for (const v of (result.videos || []).slice(0, 3)) {
      console.log('  -', JSON.stringify({ id: v.id, author: v.author, plays: v.plays, likes: v.likes, dur: v.duration, isCommerce: v.isCommerce }));
    }
    process.exit(result.total > 0 ? 0 : 2);
  } catch (e) {
    console.error('\n=== 执行失败 ===');
    console.error(e);
    process.exit(1);
  }
}

main();
