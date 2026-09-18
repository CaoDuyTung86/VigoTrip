// @ts-check
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ContactInfoForm from './ContactInfoForm';

// t.<bất kỳ key nào> trả về chính tên key -> khỏi phụ thuộc câu chữ tiếng Việt
vi.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({ t: new Proxy({}, { get: (_, key) => String(key) }) }),
}));

const setup = (data = {}, accountEmail = 'chu.tk@example.com') => {
  const onChange = vi.fn();
  render(
    <ContactInfoForm
      data={{ name: '', email: '', phone: '', ...data }}
      onChange={onChange}
      accountEmail={accountEmail}
    />,
  );
  return { onChange };
};

const field = (labelKey) => screen.getByText(labelKey, { exact: false }).parentElement.querySelector('input:not([readonly])');

describe('ContactInfoForm', () => {
  it('hiện đúng ba ô của người liên hệ, không hỏi thông tin từng hành khách', () => {
    setup();
    expect(screen.getByText('contactSectionTitle')).toBeTruthy();
    expect(screen.getByText('contactNameLabel', { exact: false })).toBeTruthy();
    expect(screen.getByText('emailField', { exact: false })).toBeTruthy();
    expect(screen.getByText('phoneNumber', { exact: false })).toBeTruthy();
  });

  // Vé đi tới địa chỉ này chứ không mặc định về email tài khoản. Khách phải được cảnh báo
  // đúng lúc còn sửa được, nếu không họ chỉ phát hiện khi không nhận được mail nào.
  it('cảnh báo khi email liên hệ khác email tài khoản', () => {
    setup({ email: 'nguoi.di@example.com' });
    expect(screen.getByText('contactEmailNotAccount')).toBeTruthy();
    expect(screen.queryByText('contactEmailIsAccount')).toBeNull();
  });

  it('báo trùng khi email liên hệ chính là email tài khoản, bỏ qua hoa thường và khoảng trắng', () => {
    setup({ email: '  Chu.TK@Example.com  ' });
    expect(screen.getByText('contactEmailIsAccount')).toBeTruthy();
  });

  it('SĐT chỉ nhận chữ số và tối đa 10 ký tự', () => {
    const { onChange } = setup();
    fireEvent.change(field('phoneNumber'), { target: { value: '090-123 4567890' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ phone: '0901234567' }));
  });

  it('tên liên hệ loại ký tự không phải chữ cái tiếng Việt', () => {
    const { onChange } = setup();
    fireEvent.change(field('contactNameLabel'), { target: { value: 'Nguyễn Văn An 123 <b>' } });
    // Chữ số và dấu bị loại, khoảng trắng giữ nguyên (giống bộ lọc tên ở PassengerInfoForm);
    // phần cắt gọn khoảng trắng thừa nằm ở bước gửi lên và ở BookingService.
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: 'Nguyễn Văn An  b' }));
  });
});
