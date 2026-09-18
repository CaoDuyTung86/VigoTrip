// @ts-check
// Chạy trước mỗi file test (khai báo ở vite.config.js -> test.setupFiles).
// Thêm matcher DOM cho expect: toBeInTheDocument, toHaveTextContent, ...
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Gỡ DOM sau mỗi test để test này không nhìn thấy component của test trước
afterEach(() => {
  cleanup();
  localStorage.clear();
});
