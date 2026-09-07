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
  useLanguage: () => ({
    t: new Proxy({}, { get: (_, key) => String(key) }),
    // Form đăng ký gửi kèm ngôn ngữ đang xem để mail kích hoạt về đúng thứ tiếng.
    currentLanguage: { code: 'vi' },
  }),
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

// Toàn bộ form đăng ký nay nằm trên MỘT màn hình (bước "nhập email" riêng đã bỏ),
// nên helper chỉ còn việc điền rồi submit.
const fillRegisterForm = async (container) => {
  fireEvent.click(screen.getByText('authXSwitchToRegister'));
  fireEvent.change(screen.getByPlaceholderText('emailPlaceholder'), { target: { value: EMAIL } });
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

    await fillRegisterForm(container);
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

    await fillRegisterForm(container);
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

    await fillRegisterForm(container);
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

    await fillRegisterForm(container);
    await submitRegister(container);
    await waitFor(() => expect(container.querySelector('input#verifyCode')).toBeInTheDocument());

    const input = container.querySelector('input#verifyCode');
    fireEvent.change(input, { target: { value: '12a34b56789' } });
    expect(input.value).toBe('123456');
  });
  it('email đã tồn tại thì tự chuyển sang đăng nhập, không bắt điền lại từ đầu', async () => {
    // Đây là tình huống khó chịu nhất của luồng cũ: điền xong hết mới báo "email đã dùng"
    // rồi để nguyên form đăng ký đó, người dùng phải tự đi tìm nút chuyển chế độ.
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(409, { message: 'Email đã được sử dụng' }));
    const { container } = render(<Auth isOpen onClose={vi.fn()} />);

    await fillRegisterForm(container);
    await submitRegister(container);

    // Nút chuyển chế độ hiện chữ "sang đăng ký" => đang ở chế độ đăng nhập
    expect(screen.getByText('authXSwitchToRegister')).toBeInTheDocument();
    expect(container.querySelector('input[name="fullName"]')).toBeNull();
    expect(screen.getByPlaceholderText('emailPlaceholder').value).toBe(EMAIL);
  });

  it('tài khoản chưa kích hoạt thì có nút mở màn nhập mã kèm gửi lại mã', async () => {
    // Trước đây đây là ngõ cụt: đăng nhập báo lỗi, đăng ký lại báo trùng email,
    // màn nhập mã chỉ tới được bằng cách tự gõ tay /verify-email.
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(403, { code: 'EMAIL_NOT_VERIFIED', message: 'chưa kích hoạt' }))
      .mockResolvedValue(jsonResponse(204));
    const { container } = render(<Auth isOpen onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('emailPlaceholder'), { target: { value: EMAIL } });
    fireEvent.change(container.querySelector('input[name="password"]'), { target: { value: 'MatKhau1@' } });
    await act(async () => {
      fireEvent.submit(container.querySelector('input[name="password"]').closest('form'));
    });

    const goVerify = await screen.findByText('authXGoVerify');
    await act(async () => { fireEvent.click(goVerify); });

    expect(container.querySelector('input#verifyCode')).toBeInTheDocument();
    expect(
      globalThis.fetch.mock.calls.some(([url]) => String(url).includes('/api/auth/resend-verification')),
    ).toBe(true);
  });
  it('quên mật khẩu chạy trọn vẹn TRONG modal, không rời trang', async () => {
    // Đây là lý do phải kéo nó vào modal: điều hướng sang /forgot-password làm unmount
    // trang đặt vé, mất sạch chuyến/ghế/hành khách/mã giảm giá đang chọn dở.
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    const onClose = vi.fn();
    const { container } = render(<Auth isOpen onClose={onClose} />);

    fireEvent.click(screen.getByText('authXForgotPwd'));
    fireEvent.change(container.querySelector('input[name="email"]'), { target: { value: EMAIL } });
    await act(async () => {
      fireEvent.submit(container.querySelector('input[name="email"]').closest('form'));
    });

    await waitFor(() => expect(container.querySelector('input[name="otp"]')).toBeInTheDocument());
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.change(container.querySelector('input[name="otp"]'), { target: { value: '123456' } });
    fireEvent.change(container.querySelector('input[name="newPassword"]'), { target: { value: 'MatKhau1@' } });
    fireEvent.change(container.querySelector('input[name="confirmPassword"]'), { target: { value: 'MatKhau1@' } });
    await act(async () => {
      fireEvent.submit(container.querySelector('input[name="otp"]').closest('form'));
    });

    expect(globalThis.fetch.mock.calls.some(([url]) => String(url).includes('/api/auth/reset-password'))).toBe(true);
    // Về lại màn đăng nhập ngay trong modal
    await waitFor(() => expect(container.querySelector('input[name="password"]')).toBeInTheDocument());
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('nút hiện/ẩn đổi được kiểu của ô mật khẩu', () => {
    globalThis.fetch = vi.fn();
    const { container } = render(<Auth isOpen onClose={vi.fn()} />);
    const pwd = () => container.querySelector('input[name="password"]');

    expect(pwd().type).toBe('password');
    fireEvent.click(screen.getByLabelText('authXShowPwd'));
    expect(pwd().type).toBe('text');
    fireEvent.click(screen.getByLabelText('authXHidePwd'));
    expect(pwd().type).toBe('password');
  });
  it('tài khoản bị khóa KHÔNG được hiện nút xác thực (nếu không là tự mở khóa)', async () => {
    // ACCOUNT_LOCKED và EMAIL_NOT_VERIFIED cùng là 403 và cùng ứng với enabled = false.
    // Nếu giao diện gộp hai cái làm một, người bị admin khóa bấm "nhập mã xác thực" là
    // xin được mã mới rồi tự kích hoạt lại — chức năng khóa tài khoản thành vô nghĩa.
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(403, { code: 'ACCOUNT_LOCKED', message: 'đã bị khóa' }),
    );
    const { container } = render(<Auth isOpen onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('emailPlaceholder'), { target: { value: EMAIL } });
    fireEvent.change(container.querySelector('input[name="password"]'), { target: { value: 'MatKhau1@' } });
    await act(async () => {
      fireEvent.submit(container.querySelector('input[name="password"]').closest('form'));
    });

    expect(await screen.findByText('authXAccountLocked')).toBeInTheDocument();
    expect(screen.queryByText('authXGoVerify')).toBeNull();
  });

  it('đóng modal thì dọn sạch state, mở lại không còn dở dang của lần trước', async () => {
    globalThis.fetch = vi.fn();
    const onClose = vi.fn();
    const { container, rerender } = render(<Auth isOpen onClose={onClose} />);

    // Vào chế độ đăng ký và điền dở
    await fillRegisterForm(container);
    expect(container.querySelector('input[name="fullName"]').value).toBe('Nguyen Van A');

    // Đóng rồi mở lại
    rerender(<Auth isOpen={false} onClose={onClose} />);
    rerender(<Auth isOpen onClose={onClose} />);

    // Về lại chế độ đăng nhập, không còn ô họ tên/SĐT của lần trước
    expect(screen.getByText('authXSwitchToRegister')).toBeInTheDocument();
    expect(container.querySelector('input[name="fullName"]')).toBeNull();
    expect(container.querySelector('input[name="password"]').value).toBe('');
  });
});
