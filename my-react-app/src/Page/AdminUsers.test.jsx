import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import AdminUsers from './AdminUsers';
import { LanguageProvider } from '../context/LanguageContext';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ token: 'fake-token', user: { email: 'admin@vigotrip.vn', role: 'ROLE_ADMIN' } }),
}));
vi.mock('../context/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

// Cố tình trả về đúng kiểu lộn xộn mà API đang trả: #4, #2, #6, #1
const USERS = [
  { id: 4, fullName: 'Dũng', email: 'dung@example.com', role: 'ROLE_USER', enabled: true, points: 50 },
  { id: 2, fullName: 'An', email: 'an@example.com', role: 'ROLE_PROVIDER', enabled: false, awaitingEmailVerification: true, points: 300 },
  { id: 6, fullName: 'Bảo', email: 'bao@example.com', role: 'ROLE_ADMIN', enabled: false, points: 10 },
  { id: 1, fullName: 'Cường', email: 'cuong@example.com', role: 'ROLE_USER', enabled: true, points: 120 },
];

const idsInOrder = () => {
  const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
  return rows.map((r) => r.querySelector('td').textContent.trim());
};

beforeEach(() => {
  globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(USERS) }));
});
afterEach(() => { vi.restoreAllMocks(); });

// AdminUsers lấy nhãn cột và nhãn sắp xếp qua useLanguage, nên phải render trong provider
// thật. Bọc ở đây thay vì nới useLanguage cho phép chạy ngoài provider: cái giá của việc
// nới là mọi component lắp sai chỗ trong ứng dụng đều âm thầm hiện tiếng Việt.
const renderPage = async () => {
  render(
    <LanguageProvider>
      <AdminUsers />
    </LanguageProvider>
  );
  await screen.findByText('#4');
};

describe('AdminUsers - sắp xếp danh sách', () => {
  it('mặc định xếp theo ID tăng dần dù API trả về lộn xộn', async () => {
    await renderPage();
    expect(idsInOrder()).toEqual(['#1', '#2', '#4', '#6']);
  });

  it('đổi tiêu chí bằng ô chọn: mới nhất trước', async () => {
    await renderPage();
    fireEvent.change(screen.getByTitle('Sắp xếp danh sách'), { target: { value: 'id_desc' } });
    expect(idsInOrder()).toEqual(['#6', '#4', '#2', '#1']);
  });

  it('bấm tiêu đề cột để xếp theo tên, bấm lần nữa thì đảo chiều', async () => {
    await renderPage();
    const th = screen.getByTitle('Sắp xếp theo Người dùng');
    fireEvent.click(th);
    expect(idsInOrder()).toEqual(['#2', '#6', '#1', '#4']); // An, Bảo, Cường, Dũng
    fireEvent.click(th);
    expect(idsInOrder()).toEqual(['#4', '#1', '#6', '#2']);
  });

  it('xếp theo điểm thưởng thì mặc định cao xuống thấp', async () => {
    await renderPage();
    fireEvent.click(screen.getByTitle('Sắp xếp theo Điểm thưởng / Hạng'));
    expect(idsInOrder()).toEqual(['#2', '#1', '#4', '#6']);
  });

  it('xếp theo trạng thái thì tài khoản bị khóa / chưa xác thực lên đầu', async () => {
    await renderPage();
    fireEvent.click(screen.getByTitle('Sắp xếp theo Trạng thái'));
    expect(idsInOrder()).toEqual(['#6', '#2', '#1', '#4']);
  });

  it('ô chọn luôn khớp với cột đang xếp, kể cả khi bấm tiêu đề cột', async () => {
    await renderPage();
    const th = screen.getByTitle('Sắp xếp theo Email & SĐT');
    fireEvent.click(th);
    fireEvent.click(th);
    const select = screen.getByTitle('Sắp xếp danh sách');
    expect(select.value).toBe('email_desc');
    expect(select.selectedOptions[0].textContent).toContain('Email Z → A');
  });

  it('lọc rồi vẫn giữ nguyên thứ tự đã chọn', async () => {
    await renderPage();
    fireEvent.change(screen.getByDisplayValue('Tất cả vai trò'), { target: { value: 'ROLE_USER' } });
    expect(idsInOrder()).toEqual(['#1', '#4']);
  });
});

describe('AdminUsers - hộp thoại', () => {
  it('modal phân quyền render ngoài cây trang để bám theo màn hình', async () => {
    await renderPage();
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    fireEvent.click(within(rows[1]).getByTitle('Phân quyền tài khoản'));

    const heading = screen.getByText('Đổi vai trò tài khoản');
    expect(heading).toBeInTheDocument();
    expect(heading.closest('table')).toBeNull();
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Đổi vai trò tài khoản')).toBeNull();
  });
});
