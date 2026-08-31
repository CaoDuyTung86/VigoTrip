import { describe, it, expect } from 'vitest';
import { ticketQrPayload, parseBookingId } from './ticketQr';

describe('ticketQrPayload', () => {
  it('sinh đúng dạng TICKET-<id>, không phải số trần', () => {
    expect(ticketQrPayload(48)).toBe('TICKET-48');
    expect(ticketQrPayload('48')).toBe('TICKET-48');
  });

  // Đây là bất biến quan trọng nhất của cả file: mã web sinh ra phải là mã máy soát vé
  // đọc được. Trước đây web sinh JSON còn mail sinh số trần, hai bên trôi khỏi nhau mà
  // không có gì bắt được.
  it('mã do web sinh ra luôn quay ngược lại đúng bookingId', () => {
    expect(parseBookingId(ticketQrPayload(48))).toBe('48');
    expect(parseBookingId(ticketQrPayload(1))).toBe('1');
    expect(parseBookingId(ticketQrPayload(1234567))).toBe('1234567');
  });
});

describe('parseBookingId', () => {
  it('đọc được các dạng QR cũ đang lưu hành', () => {
    // JSON mà MyBookings sinh ra trước đây
    expect(parseBookingId('{"bookingId":48,"type":"BUS","code":"TICKET-48-2026-09-08"}')).toBe('48');
    // Số trần mà mail xác nhận nhúng trước đây
    expect(parseBookingId('48')).toBe('48');
    // Dạng TICKET có hậu tố ngày
    expect(parseBookingId('TICKET-48-2026-09-08T09:00:00')).toBe('48');
  });

  it('chấp nhận object/array và bỏ qua khoảng trắng, dấu #', () => {
    expect(parseBookingId({ bookingId: 12 })).toBe('12');
    expect(parseBookingId({ id: 12 })).toBe('12');
    expect(parseBookingId({ code: 'TICKET-12' })).toBe('12');
    expect(parseBookingId([{ bookingId: 12 }])).toBe('12');
    expect(parseBookingId('  #12 ')).toBe('12');
  });

  it('không phân biệt hoa thường ở tiền tố', () => {
    expect(parseBookingId('ticket-9')).toBe('9');
  });

  it('từ chối nội dung không phải mã vé', () => {
    expect(parseBookingId(null)).toBeNull();
    expect(parseBookingId(undefined)).toBeNull();
    expect(parseBookingId('')).toBeNull();
    expect(parseBookingId('   ')).toBeNull();
    expect(parseBookingId('https://example.com')).toBeNull();
    expect(parseBookingId('TICKET-abc')).toBeNull();
    expect(parseBookingId('{"foo":1}')).toBeNull();
  });
});
