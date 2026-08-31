import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';

// Các context và router được thay bằng bản giả để test tập trung vào luồng
// đăng ký -> nhập mã xác thực, thứ quyết định form đặt vé bên dưới có bị mất hay không.
const mocks = vi.hoisted(() => ({
  loginSuccess: vi.fn(),
  showToast: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ loginSuccess: mocks.loginSuccess }),
}));
vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));
// t.<bất kỳ key nào> trả về chính tên key -> khỏi phụ thuộc câu chữ tiếng Việt
vi.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({ t: new Proxy({}, { get: (_, key) => String(key) }) }),
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@react-oauth/google', () => ({ GoogleLogin: () => null }));

const Auth = (await import('./Auth')).default;

const EMAIL = 'nguoi.dung@gmail.com';
const TOKEN = 'jwt-token-123';

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => (body === undefined ? '' : JSON.stringify(body)),
});

const gotoRegisterStep2 = async (container) => {
  fireEvent.click(screen.getByText('authXSwitchToRegister'));
  fireEvent.change(screen.getByPlaceholderText('emailPlaceholder'), { target: { value: EMAIL } });
  fireEvent.click(screen.getByText('authXContinueRegister'));

  fireEvent.change(container.querySelector('input[name="fullName"]'), { target: { value: 'Nguyen Van A' } });
  fireEvent.change(container.querySelector('input[name="phone"]'), { target: { value: '0912345678' } });
  fireEvent.change(container.querySelector('input[name="password"]'), { target: { value: 'MatKhau1@' } });
};

const submitRegister = async (container) => {
  await act(async () => {
    fireEvent.submit(container.querySelector('input[name="password"]').closest('form'));
  });
};

describe('Auth — đăng ký rồi xác thực ngay trong modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('đăng ký xong thì hiện bước nhập mã, không điều hướng đi đâu cả', async () => {
    // Điều hướng sang /verify-email là thứ làm unmount trang đặt vé -> mất sạch form
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(200, { token: null, email: EMAIL, fullName: 'Nguyen Van A', role: 'ROLE_USER' }),
    );
    const onClose = vi.fn();
    const { container } = render(<Auth isOpen onClose={onClose} />);

    await gotoRegisterStep2(container);
    await submitRegister(container);

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/auth/register', expect.objectContaining({ method: 'POST' }));
    await waitFor(() => expect(container.querySelector('input#verifyCode')).toBeInTheDocument());
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('nhập đúng mã thì đăng nhập và chỉ đóng modal, trang bên dưới giữ nguyên', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { token: null, email: EMAIL }))
      .mockResolvedValue(jsonResponse(200, { token: TOKEN, email: EMAIL, fullName: 'Nguyen Van A', role: 'ROLE_USER' }));
    const onClose = vi.fn();
    const { container } = render(<Auth isOpen onClose={onClose} />);

    await gotoRegisterStep2(container);
    await submitRegister(container);
    await waitFor(() => expect(container.querySelector('input#verifyCode')).toBeInTheDocument());

    fireEvent.change(container.querySelector('input#verifyCode'), { target: { value: '123456' } });
    await act(async () => {
      fireEvent.submit(container.querySelector('input#verifyCode').closest('form'));
    });

    const verifyCall = globalThis.fetch.mock.calls.find(([url]) => String(url).includes('/api/auth/verify-email'));
    expect(verifyCall[0]).toContain(`email=${encodeURIComponent(EMAIL)}`);
    expect(verifyCall[0]).toContain('code=123456');

    await waitFor(() => expect(mocks.loginSuccess).toHaveBeenCalledWith(expect.objectContaining({ token: TOKEN })));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('mã sai thì ở nguyên bước nhập mã, không đóng modal', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { token: null, email: EMAIL }))
      .mockResolvedValue(jsonResponse(400, { message: 'Mã xác thực không chính xác.' }));
    const onClose = vi.fn();
    const { container } = render(<Auth isOpen onClose={onClose} />);

    await gotoRegisterStep2(container);
    await submitRegister(container);
    await waitFor(() => expect(container.querySelector('input#verifyCode')).toBeInTheDocument());

    fireEvent.change(container.querySelector('input#verifyCode'), { target: { value: '000000' } });
    await act(async () => {
      fireEvent.submit(container.querySelector('input#verifyCode').closest('form'));
    });

    expect(mocks.loginSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(container.querySelector('input#verifyCode')).toBeInTheDocument();
  });

  it('chỉ nhận 6 chữ số, bỏ ký tự khác', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(200, { token: null, email: EMAIL }));
    const { container } = render(<Auth isOpen onClose={vi.fn()} />);

    await gotoRegisterStep2(container);
    await submitRegister(container);
    await waitFor(() => expect(container.querySelector('input#verifyCode')).toBeInTheDocument());

    const input = container.querySelector('input#verifyCode');
    fireEvent.change(input, { target: { value: '12a34b56789' } });
    expect(input.value).toBe('123456');
  });
});
