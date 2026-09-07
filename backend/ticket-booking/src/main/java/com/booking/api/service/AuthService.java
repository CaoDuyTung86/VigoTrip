package com.booking.api.service;

import com.booking.api.dto.AuthResponse;
import com.booking.api.dto.ForgotPasswordRequest;
import com.booking.api.dto.GoogleLoginRequest;
import com.booking.api.dto.LoginRequest;
import com.booking.api.dto.RegisterRequest;
import com.booking.api.dto.ResetPasswordRequest;
import com.booking.api.entity.User;
import com.booking.api.exception.DuplicateResourceException;
import com.booking.api.exception.AccountLockedException;
import com.booking.api.exception.EmailNotVerifiedException;
import com.booking.api.repository.UserRepository;
import com.booking.api.security.GoogleTokenVerifier;
import com.booking.api.security.JwtService;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.Collections;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final EmailService emailService;
    private final GoogleTokenVerifier googleTokenVerifier;
    private static final SecureRandom secureRandom = new SecureRandom();

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new DuplicateResourceException("Email đã được sử dụng: " + request.getEmail());
        }

        User user = new User();
        user.setFullName(request.getFullName());
        user.setEmail(normalizeEmail(request.getEmail()));
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setPhone(request.getPhone());
        user.setRole("ROLE_USER");
        user.setEnabled(false); // Bắt buộc xác thực email
        user.setLanguage(com.booking.api.i18n.SupportedLocales.normalize(request.getLanguage()));

        // Tạo mã xác thực 6 số
        String verificationCode = String.format("%06d", secureRandom.nextInt(1000000));
        user.setVerificationCode(verificationCode);

        try {
            userRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException e) {
            // Hai lần submit gần như đồng thời cùng vượt qua existsByEmail ở trên.
            throw new DuplicateResourceException("Email đã được sử dụng: " + request.getEmail());
        }

        // Gửi email xác thực
        emailService.sendVerificationEmail(user.getEmail(), verificationCode, user.resolveLocale());

        return new AuthResponse(null, user.getEmail(), user.getFullName(), user.getRole()); // Không trả về token ngay
    }

    /**
     * Thứ tự kiểm tra ở đây là có chủ đích, đừng đảo lại.
     *
     * Trước đây trạng thái "chưa kích hoạt" được kiểm TRƯỚC mật khẩu, nên bất kỳ ai gõ một
     * email bất kỳ kèm mật khẩu bừa cũng phân biệt được "email này có tồn tại (chưa kích hoạt)"
     * với "email này không có" — tức /login là một công cụ dò email miễn phí.
     *
     * Nay chỉ tiết lộ SAU khi người gọi đã chứng minh mình biết mật khẩu. Ai không biết
     * mật khẩu luôn nhận đúng một câu "Email hoặc mật khẩu không đúng", bất kể email có
     * tồn tại hay không; còn chủ tài khoản thật thì được dẫn thẳng tới màn nhập mã xác thực.
     */
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(normalizeEmail(request.getEmail()))
                .orElse(null);

        boolean passwordMatches = user != null
                && user.getPassword() != null
                && !user.getPassword().isEmpty()
                && passwordEncoder.matches(request.getPassword(), user.getPassword());

        if (!passwordMatches) {
            throw new BadCredentialsException("Email hoặc mật khẩu không đúng");
        }

        // Mật khẩu đã đúng -> giờ mới được phép nói ra trạng thái tài khoản.
        if (!Boolean.TRUE.equals(user.getEnabled())) {
            if (isAwaitingEmailVerification(user)) {
                throw new EmailNotVerifiedException("Tài khoản chưa được kích hoạt. Vui lòng xác thực email của bạn.");
            }
            throw new AccountLockedException("Tài khoản đã bị khóa. Vui lòng liên hệ bộ phận hỗ trợ.");
        }

        // Vẫn đi qua AuthenticationManager để giữ nguyên các kiểm tra khác của Spring Security
        // (khóa tài khoản, hết hạn...). Tự so mật khẩu ở trên chỉ để phân biệt được lý do lỗi:
        // DaoAuthenticationProvider ném DisabledException TRƯỚC khi so mật khẩu.
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            user.getEmail(),
                            request.getPassword()));
        } catch (Exception e) {
            throw new BadCredentialsException("Email hoặc mật khẩu không đúng");
        }

        return generateAuthResponse(user);
    }

    @Transactional
    public AuthResponse verifyEmail(String email, String code) {
        // Ba nhánh hỏng dưới đây (không có user / đã kích hoạt / sai mã) cố tình dùng CHUNG
        // một câu trả lời. Tách ra thì chỉ cần gửi một mã bừa là biết được email nào đã đăng ký
        // và email nào đã kích hoạt — đúng thứ mà /resend-verification đã cẩn thận giấu đi.
        String genericError = "Mã xác thực không chính xác hoặc đã hết hạn.";

        User user = userRepository.findByEmail(normalizeEmail(email))
                .orElseThrow(() -> new IllegalArgumentException(genericError));

        if (Boolean.TRUE.equals(user.getEnabled())) {
            throw new IllegalArgumentException(genericError);
        }

        if (user.getVerificationCode() == null || !user.getVerificationCode().equals(code)) {
            throw new IllegalArgumentException(genericError);
        }

        user.setEnabled(true);
        user.setVerificationCode(null);
        userRepository.save(user);

        return generateAuthResponse(user);
    }

    /**
     * Cấp lại mã xác thực cho tài khoản chưa kích hoạt.
     *
     * Trước đây không có đường này: ai không nhận được mail lúc đăng ký là kẹt vĩnh viễn,
     * vì email đã chiếm chỗ trong DB nên đăng ký lại cũng bị chặn bởi existsByEmail.
     *
     * Luôn trả về thành công dù email không tồn tại hay đã kích hoạt — nếu phân biệt,
     * endpoint này thành công cụ dò xem email nào đã đăng ký trên hệ thống.
     */
    @Transactional
    public void resendVerification(String email) {
        String normalizedEmail = normalizeEmail(email);
        userRepository.findByEmail(normalizedEmail).ifPresent(user -> {
            // Chỉ cấp mã cho tài khoản ĐANG CHỜ xác thực. Tài khoản bị admin khóa cũng có
            // enabled = false, nếu chỉ kiểm enabled thì người bị khóa xin được mã mới rồi
            // tự kích hoạt lại — mở khóa chính mình.
            if (!isAwaitingEmailVerification(user)) {
                return;
            }
            String verificationCode = String.format("%06d", secureRandom.nextInt(1000000));
            user.setVerificationCode(verificationCode);
            userRepository.save(user);
            emailService.sendVerificationEmail(user.getEmail(), verificationCode, user.resolveLocale());
        });
    }

    /**
     * Gửi mã đặt lại mật khẩu. LUÔN thành công, kể cả khi email không tồn tại.
     *
     * Trước đây chỗ này ném "Không tìm thấy người dùng với email: X" kèm 400 — nghĩa là
     * gõ một email bất kỳ vào form Quên mật khẩu là biết ngay email đó có trên hệ thống
     * hay không. Không cần mật khẩu, không cần gì cả: một công cụ dò email hoàn chỉnh,
     * và rò rỉ nặng hơn cả /register.
     *
     * Ở đây không phải đánh đổi gì: bản chất luồng này đã gửi thư đi rồi, nên sự thật
     * ("email này có tài khoản") vẫn tới được đúng người — qua hộp thư của họ, kênh mà
     * chỉ chủ email đọc được. Giống hệt cách resendVerification đang làm.
     */
    @Transactional
    public void forgotPassword(ForgotPasswordRequest request) {
        userRepository.findByEmail(normalizeEmail(request.getEmail())).ifPresent(user -> {
            // Tạo mã OTP 6 số
            String otpCode = String.format("%06d", secureRandom.nextInt(1000000));

            user.setResetToken(otpCode);
            user.setResetTokenExpiry(java.time.LocalDateTime.now().plusMinutes(15));
            userRepository.save(user);

            try {
                emailService.sendResetPasswordEmail(user.getEmail(), otpCode, user.resolveLocale());
            } catch (Exception e) {
                log.error("Failed to send reset password email to {}", user.getEmail(), e);
                log.warn("SMTP email sending failed. Please check email server configuration.");
            }
        });
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        // Cùng một câu cho "email không tồn tại", "sai mã" và "mã hết hạn": tách ra thì
        // chỉ cần gửi một mã bừa là dò được email nào có trên hệ thống — đúng lỗ hổng vừa
        // bịt ở forgotPassword ngay phía trên.
        String genericError = "Mã OTP không chính xác hoặc đã hết hạn.";

        User user = userRepository.findByEmail(normalizeEmail(request.getEmail()))
                .orElseThrow(() -> new IllegalArgumentException(genericError));

        if (user.getResetToken() == null || !user.getResetToken().equals(request.getOtpCode())) {
            throw new IllegalArgumentException(genericError);
        }

        if (user.getResetTokenExpiry() == null || user.getResetTokenExpiry().isBefore(java.time.LocalDateTime.now())) {
            throw new IllegalArgumentException(genericError);
        }

        if (user.getPassword() != null && !user.getPassword().isEmpty()
                && passwordEncoder.matches(request.getNewPassword(), user.getPassword())) {
            throw new IllegalArgumentException("Mật khẩu mới phải khác mật khẩu hiện tại.");
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        user.setResetToken(null);
        user.setResetTokenExpiry(null);
        userRepository.save(user);
    }

    @Transactional
    public AuthResponse googleLogin(GoogleLoginRequest request) {
        // Bước 1: Verify Google ID Token phía server — không tin tưởng bất kỳ data nào từ client
        GoogleIdToken.Payload payload = googleTokenVerifier.verify(request.getIdToken());
        if (payload == null) {
            throw new BadCredentialsException("Google ID Token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.");
        }

        // Bước 2: Lấy thông tin từ Google payload (KHÔNG từ client)
        String email = payload.getEmail();
        Boolean emailVerified = payload.getEmailVerified();
        String fullName = (String) payload.get("name");

        if (email == null || Boolean.FALSE.equals(emailVerified)) {
            throw new BadCredentialsException("Email Google chưa được xác thực.");
        }

        // Bước 3: Chuẩn hóa email về chữ thường. Google trả email đã chuẩn hóa, nhưng người
        // dùng có thể đã tự đăng ký trước đó bằng "Abc@Gmail.com" — nếu so sánh phân biệt
        // hoa/thường thì sẽ tạo ra tài khoản thứ hai cho cùng một người.
        final String normalizedEmail = normalizeEmail(email);

        // Bước 4: Tạo hoặc load user dựa trên email từ Google (đã được verify).
        // findByEmail + save KHÔNG phải thao tác nguyên tử: hai request Google Login chạy
        // song song (người dùng bấm lại khi backend Render đang "thức dậy", hoặc proxy
        // Vercel timeout rồi client retry trong khi backend vẫn đang xử lý request cũ)
        // đều thấy "chưa có user" và cùng insert → sinh 2 tài khoản trùng email.
        // Unique constraint trên cột email chặn được ca thứ hai, nên ở đây chỉ cần bắt
        // lỗi vi phạm ràng buộc rồi đọc lại bản ghi mà request kia vừa tạo.
        User user = userRepository.findByEmail(normalizedEmail)
                .orElseGet(() -> createGoogleUser(normalizedEmail, fullName));

        if (!Boolean.TRUE.equals(user.getEnabled())) {
            user.setEnabled(true);
            userRepository.save(user);
        }

        log.info("[GoogleLogin] Đăng nhập thành công: {}", normalizedEmail);
        return generateAuthResponse(user);
    }

    private User createGoogleUser(String email, String fullName) {
        User newUser = new User();
        newUser.setEmail(email);
        newUser.setFullName(fullName != null ? fullName : email.split("@")[0]);
        newUser.setRole("ROLE_USER");
        newUser.setEnabled(true); // Google đã verify email rồi
        try {
            User saved = userRepository.saveAndFlush(newUser);
            log.info("[GoogleLogin] Tạo tài khoản mới từ Google cho: {}", email);
            return saved;
        } catch (DataIntegrityViolationException e) {
            // Một request song song đã tạo tài khoản này trước ta trong tích tắc → dùng lại nó.
            log.warn("[GoogleLogin] Phát hiện tạo tài khoản đồng thời cho {} — dùng lại bản ghi đã có.", email);
            return userRepository.findByEmail(email)
                    .orElseThrow(() -> new BadCredentialsException(
                            "Không thể khởi tạo tài khoản Google. Vui lòng thử lại."));
        }
    }

    /** Email không phân biệt hoa/thường — chuẩn hóa để một người chỉ có duy nhất một tài khoản. */
    /**
     * Phân biệt hai trạng thái cùng mang enabled = false:
     *   - đang chờ xác thực email  -> verificationCode còn (do register/resend đặt vào)
     *   - bị quản trị viên khóa    -> verificationCode = null
     *
     * Bất biến này được AdminService.toggleUserStatus giữ: mọi thao tác khóa/mở khóa đều
     * xóa verificationCode, nên tài khoản bị khóa không bao giờ có mã treo sẵn.
     */
    private boolean isAwaitingEmailVerification(User user) {
        return !Boolean.TRUE.equals(user.getEnabled()) && user.getVerificationCode() != null;
    }

    private String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase(java.util.Locale.ROOT);
    }

    private AuthResponse generateAuthResponse(User user) {
        var userDetails = new org.springframework.security.core.userdetails.User(
                user.getEmail(),
                user.getPassword() != null ? user.getPassword() : "",
                Collections.singletonList(new SimpleGrantedAuthority(user.getRole())));
        
        java.util.Map<String, Object> extraClaims = new java.util.HashMap<>();
        extraClaims.put("role", user.getRole());
        String token = jwtService.generateToken(extraClaims, userDetails);

        return new AuthResponse(token, user.getEmail(), user.getFullName(), user.getRole());
    }
}
