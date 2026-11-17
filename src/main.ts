import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import { startAnalytics } from './services/analytics'

createApp(App).mount('#root')
startAnalytics()
