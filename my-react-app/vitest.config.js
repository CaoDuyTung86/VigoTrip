import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.js',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'node_modules/',
        'src/**/*.test.{js,jsx}',
        'src/**/*.spec.{js,jsx}',
        'dist/',
        'coverage/'
      ],
      all: true,
      lines: 70,
      functions: 70,
      branches: 70,
      statements: 70,
      skipFull: false,
      checkCoverage: false
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})