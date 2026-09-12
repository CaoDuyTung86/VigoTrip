import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import AdminAnnouncements from './AdminAnnouncements';
import { LanguageProvider } from '../context/LanguageContext';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ token: 'fake-token', user: { email: 'admin@vigotrip.vn', role: 'ROLE_ADMIN' } }),
}));
vi.mock('../context/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

// Mốc hiệu lực tính lệch từ "bây giờ" chứ không viết cứng một ngày: viết cứng thì bài kiểm
// tra chỉ đúng cho tới khi ngày đó trôi qua, rồi hỏng mà chẳng ai đụng vào mã cả.
const offsetDays = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 19);

// Bốn trạng thái phải phân biệt được trên bảng, vì admin dựa vào đúng cột đó để biết vì sao
// một mẩu tin mình vừa đăng chưa thấy chạy trên dải tin.
const ITEMS = [
  {
    id: 1,
    contentVi: 'Mở bán tuyến Hà Nội - Sa Pa',
    contentEn: 'Hanoi - Sa Pa route on sale',
    link: '/xe-khach',
    kind: 'ROUTE',
    startsAt: null,
    endsAt: null,
    sortOrder: 0,
    active: true,
  },
  {
    id: 2,
    contentVi: 'Bảo trì hệ thống 02:00 - 04:00',
    contentEn: null,
    link: null,
    kind: 'MAINTENANCE',
    startsAt: offsetDays(7),
    endsAt: offsetDays(8),
    sortOrder: 1,
    active: true,
  },
  {
    id: 3,
    contentVi: 'Tin cũ đã tắt',
    contentEn: null,
    link: null,
    kind: 'INFO',
    startsAt: null,
    endsAt: null,
    sortOrder: 2,
    active: false,
  },
  {
    id: 4,
    contentVi: 'Khuyến mãi Tết đã qua',
    contentEn: null,
    link: null,
    kind: 'INFO',
    startsAt: offsetDays(-30),
    endsAt: offsetDays(-1),
    sortOrder: 3,
    active: true,
  },
];

const jsonOk = (data) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) });

beforeEach(() => {
  globalThis.fetch = vi.fn(() => jsonOk(ITEMS));
});
afterEach(() => {
  vi.restoreAllMocks();
});

const renderPage = async () => {
  render(
    <LanguageProvider>
      <AdminAnnouncements />
    </LanguageProvider>,
  );
  await screen.findByText('Mở bán tuyến Hà Nội - Sa Pa');
};

const rowOf = (text) => screen.getByText(text).closest('tr');

describe('AdminAnnouncements', () => {
  it('liệt kê cả tin đang chạy lẫn tin đã tắt — màn quản trị phải thấy thứ mình vừa tắt', async () => {
    await renderPage();

    expect(within(rowOf('Mở bán tuyến Hà Nội - Sa Pa')).getByText('Đang chạy')).toBeTruthy();
    expect(within(rowOf('Tin cũ đã tắt')).getByText('Đã tắt')).toBeTruthy();
  });

  it('phân biệt tin chờ tới ngày với tin đã hết hạn, dù cả hai đều đang bật', async () => {
    await renderPage();

    expect(within(rowOf('Bảo trì hệ thống 02:00 - 04:00')).getByText('Chờ tới ngày')).toBeTruthy();
    expect(within(rowOf('Khuyến mãi Tết đã qua')).getByText('Hết hạn')).toBeTruthy();
  });

  it('tin không khai đường dẫn được ghi rõ là không có, không bịa ra một đường dẫn', async () => {
    await renderPage();

    expect(within(rowOf('Bảo trì hệ thống 02:00 - 04:00')).getByText(/Đường dẫn: Không có/)).toBeTruthy();
  });

  it('thiếu nội dung tiếng Việt thì không gửi request nào lên máy chủ', async () => {
    await renderPage();
    globalThis.fetch.mockClear();

    fireEvent.click(screen.getByText('Đăng tin'));

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('đăng tin gửi đúng nội dung, loại tin và cờ đang bật', async () => {
    await renderPage();
    globalThis.fetch.mockClear();

    fireEvent.change(screen.getByPlaceholderText(/Mở bán tuyến/), {
      target: { value: 'Tuyến mới Vinh - Huế' },
    });
    fireEvent.click(screen.getByText('Đăng tin'));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    const [url, options] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('/api/admin/announcements');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toMatchObject({
      contentVi: 'Tuyến mới Vinh - Huế',
      kind: 'INFO',
      active: true,
    });
  });
});
