// 公開用の計測トークン。未設定・開発時・localhostでは読み込まない。
// CloudflareのAPIトークンやアカウント認証情報は設定しないこと。
const token = import.meta.env.VITE_CF_WEB_ANALYTICS_TOKEN?.trim()
export const analyticsEnabled = Boolean(
  import.meta.env.PROD &&
  token &&
  !['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname),
)

export function startAnalytics() {
  if (!analyticsEnabled || document.getElementById('site-analytics')) {
    return
  }
  const script = document.createElement('script')
  script.id = 'site-analytics'
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js'
  script.async = true
  script.dataset.cfBeacon = JSON.stringify({ token })
  document.body.append(script)
}
