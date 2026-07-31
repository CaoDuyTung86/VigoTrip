package com.booking.api.service;

import com.booking.api.dto.AuthResponse;
import com.booking.api.dto.ForgotPasswordRequest;
import com.booking.api.dto.GoogleLoginRequest;
import com.booking.api.dto.LoginRequest;
import com.booking.api.dto.RegisterRequest;
import com.booking.api.dto.ResetPasswordRequest;
import com.booking.api.entity.User;
import com.booking.api.exception.DuplicateResourceException;
import com.booking.api.repository.UserRepository;
import com.booking.api.security.GoogleTokenVerifier;
import com.booking.api.security.JwtService;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setPhone(request.getPhone());
        user.setRole("ROLE_USER");
        user.setEnabled(false); // Bắt buộc xác thực email

        // Tạo mã xác thực 6 số
        String verificationCode = String.format("%06d", secureRandom.nextInt(1000000));
        user.setVerificationCode(verificationCode);

        userRepository.save(user);

        // Gửi email xác thực
        emailService.sendVerificationEmail(user.getEmail(), verificationCode);

        return new AuthResponse(null, user.getEmail(), user.getFullName(), user.getRole()); // Không trả về token ngay
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new BadCredentialsException("Email hoặc mật khẩu không đúng"));

        if (!Boolean.TRUE.equals(user.getEnabled())) {
            throw new BadCredentialsException("Tài khoản chưa được kích hoạt. Vui lòng xác thực email của bạn.");
        }

        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            request.getEmail(),
                            request.getPassword()));
        } catch (Exception e) {
            throw new BadCredentialsException("Email hoặc mật khẩu không đúng");
        }

        return generateAuthResponse(user);
    }

    @Transactional
    public AuthResponse verifyEmail(String email, String code) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy người dùng với email: " + email));

        if (Boolean.TRUE.equals(user.getEnabled())) {
            throw new IllegalArgumentException("Tài khoản đã được kích hoạt trước đó.");
        }

        if (user.getVerificationCode() == null || !user.getVerificationCode().equals(code)) {
            throw new IllegalArgumentException("Mã xác thực không chính xác.");
        }

        user.setEnabled(true);
        user.setVerificationCode(null);
        userRepository.save(user);

        return generateAuthResponse(user);
    }

    @Transactional
    public void forgotPassword(ForgotPasswordRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy người dùng với email: " + request.getEmail()));
        
        // Tạo mã OTP 6 số
        String otpCode = String.format("%06d", secureRandom.nextInt(1000000));
        
        user.setResetToken(otpCode);
        user.setResetTokenExpiry(java.time.LocalDateTime.now().plusMinutes(15));
        userRepository.save(user);

        try {
            emailService.sendResetPasswordEmail(user.getEmail(), otpCode);
        } catch (Exception e) {
            log.error("Failed to send reset password email to {}", request.getEmail(), e);
            log.warn("SMTP email sending failed. Please check email server configuration.");
        }
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy người dùng với email: " + request.getEmail()));

        if (user.getResetToken() == null || !user.getResetToken().equals(request.getOtpCode())) {
            throw new IllegalArgumentException("Mã OTP không chính xác.");
        }

        if (user.getResetTokenExpiry() == null || user.getResetTokenExpiry().isBefore(java.time.LocalDateTime.now())) {
            throw new IllegalArgumentException("Mã OTP đã hết hạn.");
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

        // Bước 3: Tạo hoặc load user dựa trên email từ Google (đã được verify)
        User user = userRepository.findByEmail(email)
                .orElseGet(() -> {
                    User newUser = new User();
                    newUser.setEmail(email);
                    newUser.setFullName(fullName != null ? fullName : email.split("@")[0]);
                    newUser.setRole("ROLE_USER");
                    newUser.setEnabled(true); // Google đã verify email rồi
                    log.info("[GoogleLogin] Tạo tài khoản mới từ Google cho: {}", email);
                    return userRepository.save(newUser);
                });

        if (!Boolean.TRUE.equals(user.getEnabled())) {
            user.setEnabled(true);
            userRepository.save(user);
        }

        log.info("[GoogleLogin] Đăng nhập thành công: {}", email);
        return generateAuthResponse(user);
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
