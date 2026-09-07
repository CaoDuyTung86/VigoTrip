package com.booking.api.i18n;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.MessageSource;
import org.springframework.context.NoSuchMessageException;
import org.springframework.stereotype.Component;

import java.util.Locale;

/**
 * Lấy chữ đã dịch từ {@code src/main/resources/messages*.properties}.
 *
 * <p>Chỉ là một lớp mỏng bọc {@link MessageSource}, tồn tại vì hai lý do:
 *
 * <ul>
 *   <li>{@code EmailService} gọi hàm này hơn trăm lần; viết {@code t(locale, "mail.x")}
 *       gọn hơn hẳn {@code messageSource.getMessage("mail.x", null, locale)} lặp lại.</li>
 *   <li>Khoá thiếu thì {@link MessageSource} ném {@link NoSuchMessageException}. Ném ra
 *       giữa lúc soạn mail nghĩa là khách KHÔNG nhận được thư nào cả — hỏng nặng hơn
 *       nhiều so với việc một dòng chữ hiện sai ngôn ngữ. Ở đây ghi log lỗi rồi trả về
 *       chính tên khoá: mail vẫn đi, còn dòng log đủ để tìm ra chỗ thiếu.</li>
 * </ul>
 *
 * <p>Thứ tự dự phòng do Spring lo: {@code messages_vi.properties} (tiếng Việt) →
 * {@code messages.properties} (tiếng Anh, cũng là bản mặc định cho ja/zh chưa dịch).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class Messages {

    private final MessageSource messageSource;

    public String t(Locale locale, String key) {
        return t(locale, key, (Object[]) null);
    }

    public String t(Locale locale, String key, Object... args) {
        try {
            return messageSource.getMessage(key, args, locale == null ? SupportedLocales.DEFAULT : locale);
        } catch (NoSuchMessageException e) {
            log.error("Thiếu khoá dịch '{}' cho ngôn ngữ {} — mail vẫn gửi nhưng dòng này sẽ hiện tên khoá.",
                    key, locale);
            return key;
        }
    }
}
