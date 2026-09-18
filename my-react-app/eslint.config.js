import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: { react },
    settings: { react: { version: 'detect' } },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // Dùng component chưa import thì Vite vẫn build ra bundle, chỉ nổ ReferenceError
      // lúc nhánh JSX đó được render — và 'no-undef' của ESLint core KHÔNG bắt được vì
      // nó không tạo reference cho JSX identifier. Đây là rule duy nhất chặn được.
      // (Đã mất một buổi vì <MdOutlineCreditCard/> thiếu import ở BusTickets.jsx.)
      'react/jsx-no-undef': 'error',
      // Component truyền qua prop (`<ModeIcon />`, `<PlaceIcon />`) chỉ được DÙNG trong
      // JSX, mà 'no-unused-vars' của ESLint core không đọc JSX nên báo nhầm là thừa.
      // Rule này chỉ đánh dấu "đã dùng", không bao giờ tự báo lỗi.
      'react/jsx-uses-vars': 'error',
    },
  },
])
