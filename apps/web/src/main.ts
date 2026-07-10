import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'

// Vue Flow 样式（必须引入，否则画布不显示）
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
