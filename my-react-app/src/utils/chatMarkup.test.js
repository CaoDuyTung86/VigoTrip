// @ts-check
import { describe, it, expect, vi } from 'vitest';
import { parseChatMarkup, localizeLinkLabel, localizeButtonLabel } from './chatMarkup';

const t = {
  cbLinkOffers: 'View offers',
  cbLinkFlights: 'View flights',
  cbBtnFlight: 'Flights',
};

describe('parseChatMarkup', () => {
  it('rút liên kết ra thành nút và không để lại dấu câu treo', () => {
    // Nguyên văn câu trả lời thật: nút đã thành nút, còn chữ thì trơ lại "here: ."
    const { body, links } = parseChatMarkup(
      'Currently, your account has no applicable discount codes. You can check out new offers here: [LINK: Xem ưu đãi | /uu-dai].',
    );
    expect(body).toBe('Currently, your account has no applicable discount codes. You can check out new offers here.');
    expect(links).toEqual([{ text: 'Xem ưu đãi', url: '/uu-dai' }]);
  });

  it('không đụng vào dấu hai chấm bình thường trong câu', () => {
    const { body } = parseChatMarkup('Giá: 500.000 VND\n[LINK: Xem chuyến | /ve-may-bay?from=HAN]');
    expect(body).toBe('Giá: 500.000 VND');
  });

  it('chặn đường dẫn ra ngoài site, kể cả dạng //tên-miền', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { links } = parseChatMarkup(
      '[LINK: a | https://evil.example] [LINK: b | //evil.example] [LINK: c | /x?u=javascript:alert(1)]',
    );
    expect(links.map((l) => l.url)).toEqual(['/', '/', '/']);
    warn.mockRestore();
  });

  it('lấy mã đề xuất, bỏ trùng, và bỏ qua chuỗi không giống mã', () => {
    const token = 'AbCdEfGhIjKlMnOpQrStUv';
    const { body, actions } = parseChatMarkup(`Bấm nút để lưu mã.\n\n[ACTION: ${token}]\n\n[ACTION: ${token}] [ACTION: ngan]`);
    expect(actions).toEqual([token]);
    expect(body).toBe('Bấm nút để lưu mã.\n\n[ACTION: ngan]');
  });

  it('tách nút và voucher như trước', () => {
    const { body, buttons, vouchers } = parseChatMarkup('Chọn phương tiện [BTN: Vé máy bay] [BTN: Vé xe khách]\nMã: [VOUCHER: WELCOME20]');
    expect(buttons).toEqual(['Vé máy bay', 'Vé xe khách']);
    expect(vouchers).toEqual(['WELCOME20']);
    expect(body).toBe('Chọn phương tiện\nMã');
  });
});

describe('localizeLinkLabel / localizeButtonLabel', () => {
  it('trang đã biết thì lấy nhãn theo ngôn ngữ đang chọn, kể cả khi có tham số', () => {
    expect(localizeLinkLabel({ text: 'Xem ưu đãi', url: '/uu-dai' }, t, 'en')).toBe('View offers');
    expect(localizeLinkLabel({ text: 'Xem chuyến bay', url: '/ve-may-bay?from=HAN&to=DAD' }, t, 'ja')).toBe('View flights');
  });

  it('tiếng Việt giữ nhãn của model; trang lạ giữ nguyên nhãn', () => {
    expect(localizeLinkLabel({ text: 'Xem chuyến HAN - DAD', url: '/ve-may-bay' }, t, 'vi')).toBe('Xem chuyến HAN - DAD');
    expect(localizeLinkLabel({ text: 'Help', url: '/lien-he' }, t, 'en')).toBe('Help');
  });

  it('dịch ba nút chọn phương tiện', () => {
    expect(localizeButtonLabel('Vé máy bay', t, 'en')).toBe('Flights');
    expect(localizeButtonLabel('Vé máy bay', t, 'vi')).toBe('Vé máy bay');
  });
});
