import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminTrips from './AdminTrips';
import { LanguageProvider } from '../context/LanguageContext';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ token: 'fake-token', user: { email: 'admin@vigotrip.vn', role: 'ROLE_ADMIN' } }),
}));

const showToast = vi.fn();
vi.mock('../context/ToastContext', () => ({ useToast: () => ({ showToast }) }));

const ROUTES = [{ id: 1, origin: 'HAN', destination: 'SGN' }];
const VEHICLES = [
  { id: 2, vehicleType: 'PLANE', totalSeats: 180, provider: { id: 1, providerName: 'Vietnam Airlines' } },
];

/** Đúng thân JSON mà POST /api/admin/trips trả về: entity Trip kèm tuyến và phương tiện. */
const CREATED_TRIP = {
  id: 42254,
  route: ROUTES[0],
  vehicle: VEHICLES[0],
  departureTime: '2026-12-24T08:00:00',
  arrivalTime: '2026-12-24T10:15:00',
  price: 1500000,
  status: 'ACTIVE',
};

const emptyPage = { content: [], totalPages: 1 };

const jsonRes = (body) => ({
  ok: true,
  status: 200,
  headers: { get: () => 'application/json' },
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
});

let postBody;

beforeEach(() => {
  postBody = null;
  showToast.mockClear();
  globalThis.fetch = vi.fn((url, options) => {
    const href = String(url);
    if (options?.method === 'POST' && href.includes('/admin/trips')) {
      postBody = JSON.parse(options.body);
      return Promise.resolve(jsonRes(CREATED_TRIP));
    }
    if (href.includes('/admin/routes')) return Promise.resolve(jsonRes(ROUTES));
    if (href.includes('/admin/vehicles')) return Promise.resolve(jsonRes(VEHICLES));
    return Promise.resolve(jsonRes(emptyPage));
  });
});

afterEach(() => { vi.restoreAllMocks(); });

const renderPage = async () => {
  const view = render(
    <LanguageProvider>
      <AdminTrips />
    </LanguageProvider>
  );
  // Đợi dropdown tuyến/phương tiện nạp xong thì form mới điền được.
  await screen.findByText('Hà Nội (HAN) → TP. Hồ Chí Minh (SGN)');
  return view;
};

/** Điền đủ 6 ô bắt buộc của form "Tạo chuyến đi mới" rồi bấm nút tạo. */
const fillAndSubmit = (container) => {
  const selects = container.querySelectorAll('select');
  fireEvent.change(selects[0], { target: { value: '1' } });   // tuyến
  fireEvent.change(selects[1], { target: { value: '2' } });   // phương tiện
  fireEvent.change(container.querySelector('input[type="date"]'), {
    target: { value: '2026-12-24' },
  });
  const times = container.querySelectorAll('input[type="time"]');
  fireEvent.change(times[0], { target: { value: '08:00' } });
  fireEvent.change(times[1], { target: { value: '10:15' } });
  fireEvent.change(container.querySelector('input[type="number"]'), {
    target: { value: '1500000' },
  });
  fireEvent.click(screen.getByText('Tạo chuyến mới'));
};

describe('AdminTrips — phản hồi sau khi tạo chuyến', () => {
  it('báo thành công kèm mã chuyến, tuyến và giờ khởi hành', async () => {
    const { container } = await renderPage();
    fillAndSubmit(container);

    await waitFor(() => expect(showToast).toHaveBeenCalled());

    const [message, type] = showToast.mock.calls.at(-1);
    expect(type).toBe('success');
    // Ba mẩu tin mà admin cần để tự đối chiếu: danh sách chia trang nên chuyến vừa tạo
    // gần như không nằm ở trang đang mở, chỉ "thành công!" suông là chưa đủ.
    expect(message).toContain('42254');
    expect(message).toContain('Hà Nội (HAN) → TP. Hồ Chí Minh (SGN)');
    expect(message).toContain('08:00');
    expect(message).toContain('24/12/2026');
  });

  it('gửi đúng dữ liệu form lên server', async () => {
    const { container } = await renderPage();
    fillAndSubmit(container);

    await waitFor(() => expect(postBody).not.toBeNull());
    expect(postBody).toMatchObject({
      routeId: 1,
      vehicleId: 2,
      departureTime: '2026-12-24T08:00:00',
      arrivalTime: '2026-12-24T10:15:00',
      price: 1500000,
    });
  });

  it('không báo thành công khi server trả lỗi', async () => {
    globalThis.fetch = vi.fn((url, options) => {
      const href = String(url);
      if (options?.method === 'POST' && href.includes('/admin/trips')) {
        return Promise.resolve({
          ok: false,
          status: 500,
          headers: { get: () => 'application/json' },
          text: () => Promise.resolve('{"message":"Đã có lỗi xảy ra trên hệ thống."}'),
        });
      }
      if (href.includes('/admin/routes')) return Promise.resolve(jsonRes(ROUTES));
      if (href.includes('/admin/vehicles')) return Promise.resolve(jsonRes(VEHICLES));
      return Promise.resolve(jsonRes(emptyPage));
    });

    const { container } = await renderPage();
    fillAndSubmit(container);

    // Thông báo lỗi hiện ra ở dải đỏ, và không có toast thành công nào được bắn.
    await screen.findByText(/Đã có lỗi xảy ra trên hệ thống/);
    expect(showToast).not.toHaveBeenCalled();
  });
});
