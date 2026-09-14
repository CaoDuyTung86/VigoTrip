import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import axios from 'axios';
import ChatActionCard from './ChatActionCard';
import { LanguageProvider } from '../context/LanguageContext';

vi.mock('axios');

const auth = vi.hoisted(() => ({ token: 'jwt-trong-bo-nho', isAuthenticated: true }));
vi.mock('../context/AuthContext', async (importOriginal) => ({
  ...(await importOriginal()),
  useAuth: () => auth,
}));

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUv';
const HEADERS = { headers: { Authorization: 'Bearer jwt-trong-bo-nho' } };

const pending = {
  data: {
    type: 'SAVE_VOUCHER',
    status: 'PENDING',
    voucher: { id: 11, code: 'AUTUMN2026', discountPercent: 12, maxDiscountAmount: 150000 },
  },
};

const mailPending = (mailPreferences) => ({
  data: { type: 'MAIL_PREFERENCES', status: 'PENDING', voucher: null, mailPreferences },
});

const renderCard = (onNavigate = vi.fn()) =>
  render(
    <LanguageProvider>
      <ChatActionCard token={TOKEN} onNavigate={onNavigate} />
    </LanguageProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  auth.token = 'jwt-trong-bo-nho';
  auth.isAuthenticated = true;
});

describe('ChatActionCard', () => {
  it('hiện mã theo dữ liệu server và chỉ ghi khi bấm xác nhận', async () => {
    axios.get.mockResolvedValue(pending);
    axios.post.mockResolvedValue({ data: { status: 'SAVED' } });
    renderCard();

    expect(await screen.findByText(/AUTUMN2026/)).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledWith(`/api/chat-actions/${TOKEN}`, HEADERS);
    expect(axios.post).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Lưu mã' }));

    expect(await screen.findByText(/Đã lưu mã AUTUMN2026/)).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledWith(`/api/chat-actions/${TOKEN}/confirm`, null, HEADERS);
  });

  it('đề xuất không còn (404) thì báo rõ và không có nút xác nhận', async () => {
    axios.get.mockRejectedValue({ response: { status: 404 } });
    renderCard();

    expect(await screen.findByText(/không còn hiệu lực/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lưu mã' })).toBeNull();
  });

  it('bỏ qua thì gọi DELETE và báo là chưa lưu', async () => {
    axios.get.mockResolvedValue(pending);
    axios.delete.mockResolvedValue({});
    renderCard();

    fireEvent.click(await screen.findByRole('button', { name: 'Bỏ qua' }));

    expect(await screen.findByText(/chưa được lưu/)).toBeInTheDocument();
    expect(axios.delete).toHaveBeenCalledWith(`/api/chat-actions/${TOKEN}`, HEADERS);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('mã bị tắt giữa chừng (409) thì báo không lưu được nữa', async () => {
    axios.get.mockResolvedValue(pending);
    axios.post.mockRejectedValue({ response: { status: 409 } });
    renderCard();

    fireEvent.click(await screen.findByRole('button', { name: 'Lưu mã' }));

    expect(await screen.findByText(/không lưu được nữa/)).toBeInTheDocument();
  });

  it('chưa đăng nhập thì mời đăng nhập và không gọi API nào', () => {
    auth.isAuthenticated = false;
    auth.token = null;
    renderCard();

    expect(screen.getByText(/Đăng nhập để thực hiện/)).toBeInTheDocument();
    expect(axios.get).not.toHaveBeenCalled();
  });

  describe('cài đặt thư', () => {
    it('hiện trước → sau theo dữ liệu server; xác nhận xong giao diện đổi sang ngôn ngữ mới', async () => {
      axios.get.mockResolvedValue(
        mailPending({
          currentTripReminders: true,
          tripReminders: false,
          currentLanguage: 'vi',
          language: 'en',
          languageHasMailTranslation: true,
        }),
      );
      axios.post.mockResolvedValue({ data: { status: 'SAVED' } });
      renderCard();

      expect(await screen.findByText('Thư nhắc trước giờ khởi hành: Bật → Tắt')).toBeInTheDocument();
      expect(screen.getByText('Ngôn ngữ tài khoản: Tiếng Việt → English')).toBeInTheDocument();
      expect(screen.getByText(/vẫn được gửi/)).toBeInTheDocument();
      expect(screen.getByText(/giao diện trang cũng đổi theo/)).toBeInTheDocument();
      expect(screen.queryByText(/chưa có bản dịch/)).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Đổi cài đặt' }));

      // Giao diện đã sang tiếng Anh nên câu báo cũng là tiếng Anh.
      expect(await screen.findByText('Email settings updated.')).toBeInTheDocument();
      expect(axios.post).toHaveBeenCalledWith(`/api/chat-actions/${TOKEN}/confirm`, null, HEADERS);
      expect(document.documentElement.lang).toBe('en');
      expect(localStorage.getItem('language')).toBe('en');
    });

    it('ngôn ngữ chưa dịch thư thì nói trước là thư tới bằng tiếng Anh', async () => {
      axios.get.mockResolvedValue(
        mailPending({
          currentTripReminders: true,
          tripReminders: null,
          currentLanguage: 'vi',
          language: 'ja',
          languageHasMailTranslation: false,
        }),
      );
      renderCard();

      expect(await screen.findByText(/日本語 chưa có bản dịch/)).toBeInTheDocument();
      expect(screen.queryByText(/Thư nhắc trước giờ khởi hành/)).toBeNull();
    });

    it('xác nhận hỏng thì KHÔNG đổi ngôn ngữ giao diện', async () => {
      axios.get.mockResolvedValue(
        mailPending({
          currentTripReminders: true,
          tripReminders: null,
          currentLanguage: 'vi',
          language: 'en',
          languageHasMailTranslation: true,
        }),
      );
      axios.post.mockRejectedValue({ response: { status: 500 } });
      renderCard();

      fireEvent.click(await screen.findByRole('button', { name: 'Đổi cài đặt' }));

      expect(await screen.findByText(/Chưa thực hiện được/)).toBeInTheDocument();
      expect(localStorage.getItem('language')).toBeNull();
      expect(document.documentElement.lang).toBe('vi');
    });
  });
});
