package com.booking.api.service;

import com.booking.api.dto.UserResponse;
import com.booking.api.dto.VoucherPublicDTO;
import com.booking.api.exception.ResourceNotFoundException;
import com.booking.api.i18n.SupportedLocales;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.Ticker;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.Locale;
import java.util.Optional;

/**
 * Hành động có GHI dữ liệu mà trợ lý đề xuất trong lúc chat.
 *
 * <p><b>Model không bao giờ tự ghi.</b> Tool chỉ tạo một đề xuất ở đây và nhận về một mã ngẫu
 * nhiên; việc ghi thật chỉ xảy ra khi chính khách bấm nút xác nhận, qua một endpoint REST thường
 * nằm ngoài vòng function calling. Ba hệ quả, và cả ba là lý do chọn cách này:
 *
 * <ul>
 *   <li><b>Failover không ghi hai lần.</b> {@code LlmRouter.execute} chạy lại cả vòng function
 *       calling trên nhà cung cấp kế tiếp. Nếu tool tự ghi thì chạy lại là ghi lại; ở đây chạy lại
 *       chỉ tạo thêm một đề xuất, và bên gọi gộp các đề xuất trùng trong cùng một lượt.</li>
 *   <li><b>Prompt injection không ghi được gì.</b> Một câu độc trong lịch sử chat (client tự gửi
 *       lịch sử lên) hay trong nội dung model đọc được có thể dụ model gọi tool, nhưng kết quả chỉ
 *       là một nút mà người thật phải bấm.</li>
 *   <li><b>Model không bịa được hành động.</b> Nút xác nhận chỉ mang mã đề xuất; nội dung trên nút
 *       do giao diện dựng từ dữ liệu server trả về theo mã đó, không lấy từ chữ model viết. Mã do
 *       model tự nghĩ ra thì không tồn tại, mã của người khác thì không mở được.</li>
 * </ul>
 *
 * <p>Hai loại hành động, đều chỉ chạm tới tài khoản của chính người đang chat và đều đảo ngược
 * được: lưu một mã giảm giá ({@link #TYPE_SAVE_VOUCHER}) và đổi cài đặt thư — bật/tắt thư nhắc
 * khởi hành, ngôn ngữ nhận thư ({@link #TYPE_MAIL_PREFERENCES}).
 *
 * <p><b>Chỉ sống trong RAM của một instance.</b> Đúng với cách triển khai hiện tại (một instance);
 * chạy nhiều instance sau load balancer thì phải chuyển kho này sang CSDL hoặc Redis, nếu không
 * khách bấm xác nhận trúng instance khác sẽ nhận "đề xuất đã hết hạn".
 */
@Service
@Slf4j
public class ChatActionService {

    /** Đủ để khách đọc điều kiện rồi bấm, không đủ để một nút cũ nằm chờ trong lịch sử cả ngày. */
    static final Duration TTL = Duration.ofMinutes(10);

    /** Trần bộ nhớ. Đề xuất chỉ sinh ra trong lượt chat nên đã bị rate limit của chat chặn trước. */
    private static final long MAX_PENDING = 10_000;

    public static final String TYPE_SAVE_VOUCHER = "SAVE_VOUCHER";
    public static final String TYPE_MAIL_PREFERENCES = "MAIL_PREFERENCES";

    private static final String NOT_LOGGED_IN_MAIL = "Khách chưa đăng nhập nên chưa đổi được cài đặt thư. "
            + "Mời khách đăng nhập rồi hỏi lại. TUYỆT ĐỐI KHÔNG nói là đã đổi.";

    /**
     * Đề xuất đang chờ khách xác nhận. Chủ sở hữu là email lấy từ JWT lúc tạo, không phải từ model.
     *
     * @param voucherCode   chỉ dùng cho {@link #TYPE_SAVE_VOUCHER}
     * @param tripReminders chỉ dùng cho {@link #TYPE_MAIL_PREFERENCES}; null = không đổi
     * @param language      chỉ dùng cho {@link #TYPE_MAIL_PREFERENCES}; null = không đổi
     */
    record PendingAction(String type, String ownerEmail, String voucherCode, Boolean tripReminders,
                         String language) {
    }

    /**
     * Cài đặt thư: giá trị đang có và giá trị sẽ đặt.
     *
     * @param tripReminders              null = phần này không đổi
     * @param language                   null = phần này không đổi
     * @param languageHasMailTranslation false khi thư ngôn ngữ đó chưa dịch và sẽ tới bằng tiếng Anh —
     *                                   khách phải biết TRƯỚC khi bấm, không phải lúc mở hòm thư
     */
    public record MailPreferences(boolean currentTripReminders, Boolean tripReminders,
                                  String currentLanguage, String language,
                                  boolean languageHasMailTranslation) {
    }

    /** Kết quả tạo đề xuất: có mã đề xuất, hoặc có lý do không đề xuất được (cho model đọc). */
    public record Proposal(String token, VoucherPublicDTO voucher, MailPreferences mailPreferences,
                           String refusal) {
        public boolean created() {
            return token != null;
        }
    }

    /** Thông tin để giao diện dựng nút xác nhận. Không có gì trong đây do model viết ra. */
    public record ActionView(String type, String status, VoucherPublicDTO voucher,
                             MailPreferences mailPreferences) {
    }

    public enum ConfirmResult { SAVED, NOT_FOUND, NO_LONGER_AVAILABLE }

    private final VoucherService voucherService;
    private final SavedVoucherService savedVoucherService;
    private final UserService userService;
    private final Cache<String, PendingAction> pending;
    private final SecureRandom random = new SecureRandom();

    @Autowired
    public ChatActionService(VoucherService voucherService, SavedVoucherService savedVoucherService,
                             UserService userService) {
        this(voucherService, savedVoucherService, userService, Ticker.systemTicker());
    }

    ChatActionService(VoucherService voucherService, SavedVoucherService savedVoucherService,
                      UserService userService, Ticker ticker) {
        this.voucherService = voucherService;
        this.savedVoucherService = savedVoucherService;
        this.userService = userService;
        this.pending = Caffeine.newBuilder()
                .expireAfterWrite(TTL)
                .maximumSize(MAX_PENDING)
                .ticker(ticker)
                .build();
    }

    /**
     * Đề xuất lưu một mã vào tài khoản. KHÔNG ghi gì cả.
     *
     * <p>Tra mã trong đúng danh sách công khai mà {@code check_voucher} và trang /uu-dai dùng, nên
     * tool này không mở thêm cách nào để dò xem một mã ẩn có tồn tại hay không.
     */
    public Proposal proposeSaveVoucher(String email, String rawCode) {
        if (email == null || email.isBlank()) {
            return refusal("Khách chưa đăng nhập nên chưa lưu mã vào tài khoản được. Mời khách đăng nhập "
                    + "rồi hỏi lại. TUYỆT ĐỐI KHÔNG nói là đã lưu.");
        }
        String code = rawCode == null ? "" : rawCode.trim();
        if (code.isEmpty() || "null".equals(code)) {
            return refusal("Cần biết khách muốn lưu mã giảm giá nào. Hãy hỏi lại khách tên mã.");
        }

        Optional<VoucherPublicDTO> found = findPublic(email, code);
        if (found.isEmpty()) {
            return refusal("Không có mã giảm giá \"" + code + "\" nên không lưu được. TUYỆT ĐỐI KHÔNG nói là "
                    + "đã lưu và không gợi ý mã khác thay thế nếu khách không hỏi.");
        }
        VoucherPublicDTO voucher = found.get();
        if (!isSaveable(voucher)) {
            return refusal("Mã \"" + voucher.getCode() + "\" hiện KHÔNG lưu được: " + voucher.getUnavailableReason()
                    + " Hãy nói rõ lý do với khách. TUYỆT ĐỐI KHÔNG nói là đã lưu.");
        }
        if (savedVoucherService.isSaved(email, voucher.getId())) {
            return refusal("Mã \"" + voucher.getCode() + "\" ĐÃ CÓ SẴN trong tài khoản của khách, không cần "
                    + "lưu lại. Hãy báo khách là mã đã được lưu từ trước.");
        }

        String token = newToken();
        pending.put(token, new PendingAction(TYPE_SAVE_VOUCHER, email, voucher.getCode(), null, null));
        log.info("[ChatAction] Đề xuất lưu mã {} cho một tài khoản (chờ xác nhận)", voucher.getCode());
        return new Proposal(token, voucher, null, null);
    }

    /**
     * Đề xuất đổi cài đặt thư của chính tài khoản đang chat. KHÔNG ghi gì cả.
     *
     * <p>Phần nào đã đúng như khách muốn thì bỏ khỏi đề xuất; mọi phần đều đã đúng thì không dựng
     * nút nào. Một nút "đổi" mà bấm vào không đổi gì chỉ dạy khách rằng nút xác nhận là thứ bấm cho
     * qua.
     *
     * @param tripReminders null = khách không nhắc tới thư nhắc
     * @param rawLanguage   null = khách không nhắc tới ngôn ngữ
     */
    public Proposal proposeMailPreferences(String email, Boolean tripReminders, String rawLanguage) {
        if (email == null || email.isBlank()) {
            return refusal(NOT_LOGGED_IN_MAIL);
        }
        String language = null;
        if (rawLanguage != null) {
            language = SupportedLocales.normalize(rawLanguage);
            if (language == null) {
                return refusal("Không có ngôn ngữ \"" + rawLanguage + "\". Tài khoản chỉ chọn được tiếng Việt (vi), "
                        + "tiếng Anh (en), tiếng Nhật (ja) và tiếng Trung (zh). Hãy báo khách. TUYỆT ĐỐI KHÔNG "
                        + "nói là đã đổi.");
            }
        }
        if (tripReminders == null && language == null) {
            return refusal("Cần biết khách muốn đổi gì: bật/tắt thư nhắc trước giờ khởi hành, hay đổi ngôn ngữ "
                    + "nhận thư. Hãy hỏi lại khách.");
        }

        Optional<UserResponse> profile = profileOf(email);
        if (profile.isEmpty()) {
            return refusal(NOT_LOGGED_IN_MAIL);
        }
        boolean currentReminders = Boolean.TRUE.equals(profile.get().getTripReminderOptIn());
        String currentLanguage = profile.get().getLanguage();

        Boolean reminderChange = tripReminders != null && !tripReminders.equals(currentReminders)
                ? tripReminders : null;
        String languageChange = language != null && !language.equals(currentLanguage) ? language : null;
        if (reminderChange == null && languageChange == null) {
            return refusal("Cài đặt ĐÃ ĐÚNG NHƯ KHÁCH MUỐN nên không cần đổi: thư nhắc trước giờ khởi hành đang "
                    + (currentReminders ? "BẬT" : "TẮT") + ", ngôn ngữ nhận thư đang là "
                    + languageName(currentLanguage) + ". Hãy báo khách như vậy.");
        }

        String token = newToken();
        pending.put(token, new PendingAction(TYPE_MAIL_PREFERENCES, email, null, reminderChange, languageChange));
        log.info("[ChatAction] Đề xuất đổi cài đặt thư cho một tài khoản (chờ xác nhận)");
        return new Proposal(token, null, mailPreferences(profile.get(), reminderChange, languageChange), null);
    }

    /** Thông tin của một đề xuất, CHỈ cho đúng chủ của nó. Người khác nhận empty y như mã không tồn tại. */
    public Optional<ActionView> describe(String token, String email) {
        PendingAction action = ownedBy(token, email);
        if (action == null) {
            return Optional.empty();
        }
        if (TYPE_MAIL_PREFERENCES.equals(action.type())) {
            // Giá trị "đang có" đọc lại lúc mở nút chứ không lấy lúc đề xuất: trong mười phút đó khách
            // có thể đã tự đổi ở trang tài khoản.
            return profileOf(email).map(profile -> new ActionView(action.type(), "PENDING", null,
                    mailPreferences(profile, action.tripReminders(), action.language())));
        }
        Optional<VoucherPublicDTO> voucher = findPublic(email, action.voucherCode());
        String status = voucher.isPresent() && isSaveable(voucher.get()) ? "PENDING" : "UNAVAILABLE";
        return Optional.of(new ActionView(action.type(), status, voucher.orElse(null), null));
    }

    /**
     * Thực hiện đề xuất. Dùng đúng một lần.
     *
     * <p>Mã đề xuất của người khác KHÔNG bị tiêu hao — nếu không, ai lấy được mã của nạn nhân (ví
     * dụ đọc trộm màn hình) cũng xoá được nút của họ.
     */
    public ConfirmResult confirm(String token, String email) {
        PendingAction action = ownedBy(token, email);
        if (action == null || !pending.asMap().remove(token, action)) {
            return ConfirmResult.NOT_FOUND;
        }
        return TYPE_MAIL_PREFERENCES.equals(action.type())
                ? confirmMailPreferences(action, email)
                : confirmSaveVoucher(action, email);
    }

    /** Khách bấm "không". Cũng chỉ chủ đề xuất mới huỷ được. */
    public boolean cancel(String token, String email) {
        PendingAction action = ownedBy(token, email);
        return action != null && pending.asMap().remove(token, action);
    }

    /**
     * Kiểm tra lại mã ngay lúc bấm chứ không tin kết quả lúc đề xuất: trong mười phút đó admin có
     * thể đã tắt mã, hoặc mã đã hết lượt.
     */
    private ConfirmResult confirmSaveVoucher(PendingAction action, String email) {
        Optional<VoucherPublicDTO> voucher = findPublic(email, action.voucherCode());
        if (voucher.isEmpty() || !isSaveable(voucher.get())) {
            return ConfirmResult.NO_LONGER_AVAILABLE;
        }
        savedVoucherService.saveVoucher(email, voucher.get().getId());
        log.info("[ChatAction] Khách đã xác nhận lưu mã {}", action.voucherCode());
        return ConfirmResult.SAVED;
    }

    /**
     * ĐẶT đúng giá trị đã đề xuất chứ không đảo trạng thái, nên dù khách vừa tự đổi ở trang tài
     * khoản thì kết quả vẫn là thứ ghi trên nút khách vừa bấm.
     */
    private ConfirmResult confirmMailPreferences(PendingAction action, String email) {
        try {
            userService.updateMailPreferences(email, action.tripReminders(), action.language());
        } catch (ResourceNotFoundException e) {
            return ConfirmResult.NOT_FOUND;
        }
        log.info("[ChatAction] Khách đã xác nhận đổi cài đặt thư");
        return ConfirmResult.SAVED;
    }

    private PendingAction ownedBy(String token, String email) {
        if (token == null || email == null) {
            return null;
        }
        PendingAction action = pending.getIfPresent(token);
        return action != null && action.ownerEmail().equalsIgnoreCase(email) ? action : null;
    }

    private Optional<VoucherPublicDTO> findPublic(String email, String code) {
        String wanted = code.toUpperCase(Locale.ROOT);
        return voucherService.getPublicVouchers(null, null, email).stream()
                .filter(v -> v.getCode() != null && v.getCode().toUpperCase(Locale.ROOT).equals(wanted))
                .findFirst();
    }

    /** Hồ sơ của chính người đang đăng nhập; tài khoản vừa bị xoá thì coi như không có. */
    private Optional<UserResponse> profileOf(String email) {
        try {
            return Optional.of(userService.getProfile(email));
        } catch (ResourceNotFoundException e) {
            return Optional.empty();
        }
    }

    private static MailPreferences mailPreferences(UserResponse profile, Boolean tripReminders, String language) {
        return new MailPreferences(Boolean.TRUE.equals(profile.getTripReminderOptIn()), tripReminders,
                profile.getLanguage(), language,
                language == null || SupportedLocales.hasMailTranslation(language));
    }

    /**
     * Mã chưa tới ngày áp dụng vẫn lưu được — lưu trước để dùng sau chính là lý do tồn tại của
     * nút lưu. Mã đã hết hạn, hết lượt hay khách đã dùng rồi thì lưu vào chỉ thêm rác.
     */
    private static boolean isSaveable(VoucherPublicDTO voucher) {
        return voucher.isAvailable() || "NOT_STARTED".equals(voucher.getUnavailableReasonCode());
    }

    /** Tên ngôn ngữ để model đọc lại cho khách; model tự nói lại bằng thứ tiếng đang trả lời. */
    static String languageName(String code) {
        return switch (code == null ? "" : code) {
            case "en" -> "tiếng Anh";
            case "ja" -> "tiếng Nhật";
            case "zh" -> "tiếng Trung";
            default -> "tiếng Việt";
        };
    }

    private Proposal refusal(String reason) {
        return new Proposal(null, null, null, reason);
    }

    /** 128 bit ngẫu nhiên: đoán mò không được, và không mang thông tin gì về người hay mã. */
    private String newToken() {
        byte[] bytes = new byte[16];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
