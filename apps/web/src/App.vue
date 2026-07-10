<template>
  <div id="app-container">
    <nav class="nav-bar">
      <h1 class="logo">🎬 TK AI Video Pipeline</h1>
      <div class="nav-links">
        <router-link to="/">Dashboard</router-link>
        <router-link to="/workflow">工作流</router-link>
        <router-link to="/tasks">任务</router-link>
        <router-link to="/settings">设置</router-link>
      </div>
    </nav>
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }

#app-container {
  min-height: 100vh;
  background: #f5f5f5;
}

.nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.logo { font-size: 18px; color: #1a1a2e; }
.nav-links { display: flex; gap: 16px; }
.nav-links a { color: #555; text-decoration: none; font-size: 14px; }
.nav-links a:hover { color: #1a1a2e; }

.main-content { padding: 24px; }
</style>
