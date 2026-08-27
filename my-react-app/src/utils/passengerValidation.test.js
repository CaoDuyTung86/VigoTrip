import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseDobStrict, validatePassengerDob } from './passengerValidation';

describe('parseDobStrict', () => {
  it('chấp nhận ngày hợp lệ đúng định dạng DD/MM/YYYY', () => {
    const d = parseDobStrict('15/01/2024');
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(15);
  });

  it('loại ngày không tồn tại thật (JS tự cuộn sang tháng sau)', () => {
    expect(parseDobStrict('31/02/2024')).toBeNull();
    expect(parseDobStrict('30/02/2024')).toBeNull();
    expect(parseDobStrict('31/04/2024')).toBeNull();
  });

  it('29/02 hợp lệ ở năm nhuận, không hợp lệ ở năm thường', () => {
    expect(parseDobStrict('29/02/2024')).not.toBeNull();
    expect(parseDobStrict('29/02/2023')).toBeNull();
  });

  it('loại tháng và ngày ngoài khoảng', () => {
    expect(parseDobStrict('32/01/2024')).toBeNull();
    expect(parseDobStrict('01/13/2024')).toBeNull();
    expect(parseDobStrict('00/01/2024')).toBeNull();
  });

  it('loại định dạng sai', () => {
    expect(parseDobStrict('2024-01-15')).toBeNull();
    expect(parseDobStrict('1/1/2024')).toBeNull();
    expect(parseDobStrict('')).toBeNull();
    expect(parseDobStrict(undefined)).toBeNull();
  });
});

describe('validatePassengerDob', () => {
  const departure = new Date(2026, 5, 1); // 01/06/2026

  afterEach(() => {
    vi.useRealTimers();
  });

  it('báo required khi bỏ trống', () => {
    expect(validatePassengerDob('', 'ADULT', departure)).toBe('required');
  });

  it('báo invalid khi ngày không có thật', () => {
    expect(validatePassengerDob('31/02/2000', 'ADULT', departure)).toBe('invalid');
  });

  it('trả null khi tuổi khớp loại hành khách', () => {
    expect(validatePassengerDob('01/01/2000', 'ADULT', departure)).toBeNull();
    expect(validatePassengerDob('01/01/2018', 'CHILD', departure)).toBeNull();
    expect(validatePassengerDob('01/01/2026', 'INFANT', departure)).toBeNull();
  });

  it('bắt lỗi trẻ 5 tuổi khai là ADULT', () => {
    expect(validatePassengerDob('01/01/2021', 'ADULT', departure)).toBe('ageMismatch');
  });

  it('bắt lỗi người lớn khai là CHILD', () => {
    expect(validatePassengerDob('01/01/1990', 'CHILD', departure)).toBe('ageMismatch');
  });

  it('tính tuổi tại NGÀY KHỞI HÀNH, không phải hôm nay', () => {
    // Sinh 01/07/2014: tại 01/06/2026 mới 11 tuổi -> vẫn là CHILD.
    // Nếu code tính theo "hôm nay" thì kết quả sẽ trôi theo thời gian chạy test.
    expect(validatePassengerDob('01/07/2014', 'CHILD', departure)).toBeNull();
    // Cùng ngày sinh đó, khởi hành 01/08/2026 đã 12 tuổi -> không còn là CHILD
    expect(validatePassengerDob('01/07/2014', 'CHILD', new Date(2026, 7, 1))).toBe('ageMismatch');
  });

  it('xử lý đúng ranh giới sinh nhật rơi trúng ngày khởi hành', () => {
    // Tròn 12 tuổi đúng ngày khởi hành -> đã là ADULT, không còn CHILD
    expect(validatePassengerDob('01/06/2014', 'ADULT', departure)).toBeNull();
    expect(validatePassengerDob('01/06/2014', 'CHILD', departure)).toBe('ageMismatch');
  });

  it('báo future khi ngày sinh sau hôm nay', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15));
    expect(validatePassengerDob('01/01/2030', 'ADULT', departure)).toBe('future');
    // Đúng hôm nay thì không tính là tương lai
    expect(validatePassengerDob('15/01/2026', 'INFANT', departure)).toBeNull();
  });

  it('bỏ qua kiểm tra tuổi với loại hành khách lạ', () => {
    expect(validatePassengerDob('01/01/1990', 'PET', departure)).toBeNull();
  });
});
