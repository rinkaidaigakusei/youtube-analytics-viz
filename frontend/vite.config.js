import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pagesはリポジトリ名のサブパス(/youtube-analytics-viz/)で配信されるため、
// ビルド時のみbaseを切り替える(ローカル開発では '/' のまま)
// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/youtube-analytics-viz/' : '/',
  plugins: [react()],
}))
