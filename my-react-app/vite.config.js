import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
//
// Đích proxy đọc từ biến VITE_API_TARGET, mặc định vẫn là http://localhost:8081 y như cũ.
// Lý do: backend lúc chạy bằng Docker Compose (8081), lúc chạy thẳng bằng spring-boot:run ở
// một cổng khác; trước đây đổi chỗ là phải sửa tay file này. Xem .env.localapi và script
// `npm run dev:local-api`.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const apiTarget = env.VITE_API_TARGET || 'http://localhost:8081'

  return {
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vite.svg'],
      manifest: {
        name: 'VigoTrip - Hệ Thống Đặt Vé Đa Phương Tiện',
        short_name: 'VigoTrip',
        description: 'Ứng dụng đặt vé máy bay, tàu hỏa và xe khách chuyên nghiệp',
        // vite-plugin-pwa mặc định điền "standalone". Đặt lại thành "browser" để
        // biểu tượng trên màn hình chính mở bằng Safari đầy đủ thay vì cửa sổ
        // standalone — nghiệp vụ quét QR check-in cần camera, mà standalone trên
        // iOS dưới 14.3 không được cấp getUserMedia.
        // Đánh đổi: Chrome (Android & desktop) sẽ không còn mời "Cài đặt ứng dụng"
        // nữa, vì Chrome chỉ coi là cài được khi display là standalone/fullscreen/
        // minimal-ui. Service worker và bộ nhớ đệm offline KHÔNG bị ảnh hưởng.
        display: 'browser',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    open: env.VITE_OPEN !== 'false',
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/ws': {
        target: apiTarget,
        ws: true,
        changeOrigin: true,
      },
      // Dùng cho warm-up ping lúc mở trang (xem utils/apiClient.js).
      // Trên production, vercel.json rewrite đường dẫn này sang backend Render.
      '/actuator/health': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  // Vitest dùng lại đúng config này (plugin React, alias, env) nên test chạy
  // cùng pipeline transform với dev/build — không có chuyện chạy được ở dev
  // mà vỡ ở test. Chỉ ảnh hưởng `vitest`, không đụng tới `vite build`.
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: false,
    coverage: {
      provider: 'v8',
      // lcov là định dạng SonarQube đọc (xem sonar-project.properties)
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/main.jsx', 'src/test/**', 'src/**/*.test.{js,jsx}'],
    },
  },
  }
})


