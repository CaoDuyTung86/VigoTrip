import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import AnnouncementTicker from './AnnouncementTicker';
import { buildAnnouncementText } from '../utils/announcements';
import { LanguageProvider } from '../context/LanguageContext';

vi.mock('axios');

const voucherItem = (overrides = {}) => ({
  id: 'voucher:1',
  kind: 'VOUCHER',
  params: { code: 'SUMMER', percent: '15', maxDiscount: '200000' },
  link: '/uu-dai?code=SUMMER',
  endsAt: '2026-12-31T23:59:00',
  ...overrides,
});

// Tin nhập tay (bảng thong_bao): nguyên văn hai thứ tiếng, không có params, và đường dẫn
// là tuỳ chọn — mặc định ở đây là không có, vì đó mới là trường hợp dễ làm sai.
const noticeItem = (overrides = {}) => ({
  id: 'notice:1',
  kind: 'MAINTENANCE',
  textVi: 'Bảo trì hệ thống 02:00 - 04:00 ngày 20/09',
  textEn: 'Maintenance 02:00 - 04:00 on 20 Sep',
  link: null,
  endsAt: '2026-09-20T04:00:00',
  ...overrides,
});

const renderTicker = () =>
  render(
    <MemoryRouter>
      <LanguageProvider>
        <AnnouncementTicker />
      </LanguageProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  document.documentElement.style.removeProperty('--ticker-height');
});

describe('AnnouncementTicker', () => {
  it('ghép câu từ params và trỏ về trang ưu đãi đúng mã', async () => {
    axios.get.mockResolvedValue({ data: [voucherItem()] });
    renderTicker();

    const links = await screen.findAllByRole('link', { name: /SUMMER/ });
    expect(links[0]).toHaveAttribute('href', '/uu-dai?code=SUMMER');
    expect(links[0]).toHaveTextContent('giảm 15%');
    expect(links[0]).toHaveTextContent('tối đa');
  });

  it('chừa chỗ cho dải tin bằng --ticker-height khi có tin', async () => {
    axios.get.mockResolvedValue({ data: [voucherItem()] });
    renderTicker();

    await screen.findAllByRole('link', { name: /SUMMER/ });
    expect(document.documentElement.style.getPropertyValue('--ticker-height')).not.toBe('');
  });

  it('không có tin thì không render gì và không chiếm chỗ', async () => {
    axios.get.mockResolvedValue({ data: [] });
    const { container } = renderTicker();

    await waitFor(() => expect(axios.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    expect(document.documentElement.style.getPropertyValue('--ticker-height')).toBe('');
  });

  it('backend lỗi thì im lặng, không làm vỡ trang', async () => {
    axios.get.mockRejectedValue(new Error('backend đang ngủ'));
    const { container } = renderTicker();

    await waitFor(() => expect(axios.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('bấm ẩn thì dải tin biến mất và được nhớ theo danh sách tin đang hiện', async () => {
    axios.get.mockResolvedValue({ data: [voucherItem()] });
    const { container } = renderTicker();

    const closeButton = await screen.findByRole('button');
    fireEvent.click(closeButton);

    expect(container).toBeEmptyDOMElement();
    expect(localStorage.getItem('vigotrip.ticker.dismissed')).toBe('voucher:1');
  });

  it('tin mới xuất hiện thì dải tin hiện lại dù trước đó đã bị ẩn', async () => {
    localStorage.setItem('vigotrip.ticker.dismissed', 'voucher:1');
    axios.get.mockResolvedValue({ data: [voucherItem(), voucherItem({ id: 'voucher:2', params: { code: 'TET', percent: '30' } })] });
    renderTicker();

    expect(await screen.findAllByRole('link', { name: /TET/ })).not.toHaveLength(0);
  });

  it('đúng tập tin đã ẩn thì không hiện lại', async () => {
    localStorage.setItem('vigotrip.ticker.dismissed', 'voucher:1');
    axios.get.mockResolvedValue({ data: [voucherItem()] });
    const { container } = renderTicker();

    await waitFor(() => expect(axios.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('tin nhập tay có đường dẫn thì bấm được và trỏ đúng chỗ', async () => {
    axios.get.mockResolvedValue({ data: [noticeItem({ link: '/ve-tau-hoa' })] });
    renderTicker();

    const links = await screen.findAllByRole('link', { name: /Bảo trì/ });
    expect(links[0]).toHaveAttribute('href', '/ve-tau-hoa');
  });

  it('tin nhập tay không có đường dẫn thì hiện chữ, không dựng liên kết giả về trang ưu đãi', async () => {
    axios.get.mockResolvedValue({ data: [noticeItem()] });
    renderTicker();

    expect(await screen.findAllByText(/Bảo trì/)).not.toHaveLength(0);
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('buildAnnouncementText', () => {
  const t = {
    annVoucher: 'Mã {code} — giảm {percent}%',
    vchMaxDiscount: 'tối đa {amount}',
    annVoucherMinOrder: 'đơn từ {amount}',
    annVoucherProvider: 'áp dụng cho {provider}',
    annVoucherUntil: 'đến hết {date}',
  };

  it('chỉ ghép những mảnh backend thật sự gửi', () => {
    const text = buildAnnouncementText(
      { kind: 'VOUCHER', params: { code: 'X', percent: '10' } },
      t,
      'vi',
    );
    expect(text).toBe('Mã X — giảm 10%');
  });

  it('tin nhập tay thiếu bản tiếng Anh thì hiện tiếng Việt chứ không ẩn tin', () => {
    const item = { kind: 'MAINTENANCE', textVi: 'Bảo trì 2h sáng', textEn: null };
    expect(buildAnnouncementText(item, t, 'en')).toBe('Bảo trì 2h sáng');
  });

  it('tiếng Nhật/Trung chưa dịch thì đi đường tiếng Anh trước', () => {
    const item = { kind: 'INFO', textVi: 'Tuyến mới', textEn: 'New route' };
    expect(buildAnnouncementText(item, t, 'ja')).toBe('New route');
  });
});
