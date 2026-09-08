package com.booking.api.i18n;

import com.booking.api.entity.Booking;
import com.booking.api.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.ReloadableResourceBundleMessageSource;

import java.util.Locale;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Chuỗi dự phòng của chữ trong mail.
 *
 * <p>Kiểm ở đây vì đây là thứ không có cách nào nhìn thấy lúc chạy thật: sai thì lá thư vẫn
 * gửi đi bình thường, chỉ là sai thứ tiếng, và người phát hiện ra là khách chứ không phải
 * người viết code.
 */
class MailLocalizationTest {

    /** Dựng đúng cấu hình như application.yml khai báo, để test kiểm cùng một hành vi. */
    private static Messages messages() {
        ReloadableResourceBundleMessageSource source = new ReloadableResourceBundleMessageSource();
        source.setBasename("classpath:messages");
        source.setDefaultEncoding("UTF-8");
        source.setFallbackToSystemLocale(false);
        return new Messages(source);
    }

    @Test
    @DisplayName("Tiếng Việt lấy bản vi, tiếng Anh lấy bản mặc định")
    void resolvesViAndEn() {
        Messages messages = messages();

        assertEquals("Trân trọng,", messages.t(Locale.forLanguageTag("vi"), "mail.regards"));
        assertEquals("Best regards,", messages.t(Locale.forLanguageTag("en"), "mail.regards"));
    }

    @Test
    @DisplayName("Ngôn ngữ chưa dịch (ja/zh) rơi về tiếng Anh, không rơi về locale của máy chủ")
    void deferredLocalesFallBackToEnglish() {
        Messages messages = messages();

        assertEquals("Best regards,", messages.t(Locale.forLanguageTag("ja"), "mail.regards"));
        assertEquals("Best regards,", messages.t(Locale.forLanguageTag("zh"), "mail.regards"));
    }

    @Test
    @DisplayName("Khoá thiếu không làm hỏng việc gửi mail, chỉ trả về tên khoá")
    void missingKeyDoesNotThrow() {
        assertEquals("mail.khong.ton.tai",
                messages().t(Locale.forLanguageTag("vi"), "mail.khong.ton.tai"));
    }

    @Test
    @DisplayName("Tham số được chèn vào đúng chỗ và không bị định dạng thành số có dấu phân cách")
    void formatsArgumentsWithoutNumberGrouping() {
        String subject = messages().t(Locale.forLanguageTag("vi"), "mail.booking.subject", String.valueOf(1234L));

        assertTrue(subject.contains("#1234"), "Mã đơn phải giữ nguyên, không thành #1.234: " + subject);
    }

    /**
     * Số tiền trong mail phải viết theo quy ước của NGƯỜI NHẬN, không theo locale của máy chủ.
     *
     * <p>Bản cũ gọi {@code String.format("%,.0f đ", x)} — không truyền Locale nên dấu phân
     * nhóm lấy theo JVM (trên Render là en), và chữ "đ" thì viết cứng. Kết quả là lá mail
     * tiếng Anh hiện "1,500,000 đ", còn mail tiếng Việt cũng hiện "1,500,000 đ" thay vì
     * "1.500.000 đ". Test này khoá lại cả hai vế: dấu phân nhóm VÀ ký hiệu tiền tệ.
     */
    @Test
    @DisplayName("Số tiền theo quy ước của người nhận: dấu phân nhóm và ký hiệu tiền đều đổi")
    void formatsMoneyPerRecipientLocale() {
        Messages messages = messages();

        String vi = messages.t(Locale.forLanguageTag("vi"), "mail.currency",
                String.format(Locale.forLanguageTag("vi"), "%,.0f", 1_500_000d));
        String en = messages.t(Locale.ENGLISH, "mail.currency",
                String.format(Locale.ENGLISH, "%,.0f", 1_500_000d));

        assertEquals("1.500.000 đ", vi);
        assertEquals("1,500,000 VND", en);
    }

    @Test
    @DisplayName("Mã ngôn ngữ lạ hoặc rỗng đều quy về tiếng Việt")
    void unknownCodesFallBackToVietnamese() {
        assertEquals(SupportedLocales.DEFAULT, SupportedLocales.parse(null));
        assertEquals(SupportedLocales.DEFAULT, SupportedLocales.parse("klingon"));
        assertEquals("en", SupportedLocales.parse("en-US").getLanguage());
        assertEquals("vi", SupportedLocales.parse("VI").getLanguage());

        assertTrue(SupportedLocales.isSupported("ja"));
        assertFalse(SupportedLocales.isSupported("de"));
        assertNull(SupportedLocales.normalize("de"));
    }

    @Test
    @DisplayName("Đơn của khách vãng lai không có tài khoản thì mail vẫn ra tiếng Việt")
    void guestBookingUsesDefaultLocale() {
        Booking guestBooking = new Booking();

        assertEquals(SupportedLocales.DEFAULT, guestBooking.resolveNotificationLocale());
    }

    @Test
    @DisplayName("Đơn có tài khoản thì lấy ngôn ngữ của người đặt")
    void bookingUsesOwnerLanguage() {
        User owner = new User();
        owner.setLanguage("en");
        Booking booking = new Booking();
        booking.setUser(owner);

        assertEquals("en", booking.resolveNotificationLocale().getLanguage());
    }
}
