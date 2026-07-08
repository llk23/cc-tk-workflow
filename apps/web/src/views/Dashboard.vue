<template>
  <div class="dashboard">
    <h2>运营 Dashboard</h2>
    <div class="stats-grid">
      <div class="stat-card">
        <h3>今日抓取</h3>
        <p class="stat-number">0</p>
        <span class="stat-label">TK 视频</span>
      </div>
      <div class="stat-card">
        <h3>待分析</h3>
        <p class="stat-number">0</p>
        <span class="stat-label">个视频</span>
      </div>
      <div class="stat-card">
        <h3>生成任务</h3>
        <p class="stat-number">0</p>
        <span class="stat-label">进行中</span>
      </div>
      <div class="stat-card">
        <h3>成功率</h3>
        <p class="stat-number">--</p>
        <span class="stat-label">最近24h</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard h2 { margin-bottom: 20px; color: #1a1a2e; }
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.stat-card {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #e8e8e8;
  text-align: center;
}
.stat-card h3 { font-size: 13px; color: #888; margin-bottom: 8px; }
.stat-number { font-size: 32px; font-weight: 700; color: #1a1a2e; }
.stat-label { font-size: 12px; color: #aaa; }
</style>
