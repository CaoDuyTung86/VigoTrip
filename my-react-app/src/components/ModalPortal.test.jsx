// @ts-check
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ModalPortal from './ModalPortal';

const setup = (props = {}) => {
  const onClose = vi.fn();
  const utils = render(
    <div data-testid="trang" style={{ transform: 'translateY(0)' }}>
      <ModalPortal onClose={onClose} {...props}>
        <div data-testid="hop">Nội dung modal</div>
      </ModalPortal>
    </div>,
  );
  return { onClose, ...utils };
};

describe('ModalPortal', () => {
  it('render ra thẳng body, không nằm trong cây trang (nơi có ancestor transform)', () => {
    setup();
    const hop = screen.getByTestId('hop');
    expect(hop).toBeInTheDocument();
    // Đây mới là điều kiện để position:fixed bám theo màn hình thay vì bám theo trang.
    expect(screen.getByTestId('trang').contains(hop)).toBe(false);
    expect(hop.closest('[data-testid="trang"]')).toBeNull();
  });

  it('lớp phủ phủ kín màn hình bằng position fixed', () => {
    setup();
    const overlay = screen.getByTestId('hop').parentElement.parentElement;
    expect(overlay.style.position).toBe('fixed');
    expect(overlay.style.overflowY).toBe('auto');
  });

  it('bấm nền thì đóng, bấm vào trong hộp thì không', () => {
    const { onClose } = setup();
    const wrapper = screen.getByTestId('hop').parentElement;
    const overlay = wrapper.parentElement;

    fireEvent.mouseDown(screen.getByTestId('hop'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closeOnBackdrop=false thì bấm nền không đóng (tránh mất dữ liệu form)', () => {
    const { onClose } = setup({ closeOnBackdrop: false });
    const overlay = screen.getByTestId('hop').parentElement.parentElement;
    fireEvent.mouseDown(overlay);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('nhấn Esc thì đóng', () => {
    const { onClose } = setup();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('khóa cuộn nền lúc mở và trả lại nguyên trạng lúc đóng', () => {
    const { unmount } = setup();
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });
});
