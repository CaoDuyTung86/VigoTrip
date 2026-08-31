import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { FaEnvelopeOpenText } from 'react-icons/fa';

/**
 * Thông tin người liên hệ của cả đơn — nơi nhận vé điện tử và mọi thông báo chuyến đi.
 *
 * Một khối duy nhất cho cả đoàn, không phải một khối cho mỗi người lớn. Trước đây form
 * hỏi email + SĐT của TỪNG người lớn và bắt buộc điền, nhưng backend lại gửi mọi mail về
 * booking.user.email — nghĩa là khách bị chặn vì những ô mà hệ thống không hề dùng tới.
 * Giờ đơn có đúng một địa chỉ nhận, và đó chính là địa chỉ điền ở đây.
 *
 * Thông tin của từng hành khách (tên, giới tính, ngày sinh, quốc tịch, giấy tờ) vẫn nằm ở
 * PassengerInfoForm — đó là dữ liệu để soát vé, khác mục đích với chỗ này.
 */
const ContactInfoForm = ({ data, onChange, accountEmail }) => {
  const { t } = useLanguage();

  const set = (patch) => onChange({ ...data, ...patch });

  const usingAccountEmail =
    accountEmail && data.email && data.email.trim().toLowerCase() === accountEmail.trim().toLowerCase();

  return (
    <div style={{
      border: "1px solid var(--border-main)",
      borderRadius: "12px",
      marginBottom: "16px",
      background: "var(--bg-card)",
      overflow: "hidden"
    }}>
      <div style={{
        padding: "16px",
        background: "var(--bg-input)",
        borderBottom: "1px solid var(--border-light)",
        display: "flex",
        alignItems: "center",
        gap: "8px"
      }}>
        <FaEnvelopeOpenText style={{ color: "var(--primary)", fontSize: 16 }} />
        <span style={{ fontWeight: "700", fontSize: "16px", color: "var(--text-heading)" }}>
          {t.contactSectionTitle || "Thông tin người liên hệ"}
        </span>
      </div>

      <div style={{ padding: "20px" }}>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "0 0 16px 0", lineHeight: 1.6 }}>
          {t.contactSectionHint || "Vé điện tử và mọi thông báo về chuyến đi (đổi giờ, huỷ chuyến, nhắc khởi hành) sẽ được gửi tới đây. Chỉ cần một người đại diện cho cả đoàn."}
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>{t.contactNameLabel || "Họ và tên người liên hệ"} *</label>
            <input
              type="text"
              maxLength={50}
              value={data.name || ''}
              onChange={e => set({ name: e.target.value.replace(/[^a-zA-ZàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ\s]/g, '') })}
              placeholder={t.pifFullNamePlaceholder || "NHẬP HỌ VÀ TÊN"}
              style={{ ...inputStyle, textTransform: "uppercase" }}
            />
          </div>

          <div>
            <label style={labelStyle}>{t.emailField} *</label>
            <input
              type="email"
              maxLength={60}
              value={data.email || ''}
              onChange={e => set({ email: e.target.value.trim() })}
              placeholder="email@example.com"
              style={inputStyle}
            />
            {/* Vé đi tới đây chứ không mặc định về email tài khoản, nên khi hai địa chỉ
                khác nhau phải nói rõ — đây là lúc duy nhất khách còn sửa được. */}
            <div style={{ fontSize: "12px", color: usingAccountEmail ? "var(--text-muted)" : "#f97316", marginTop: "6px", lineHeight: 1.5 }}>
              {usingAccountEmail
                ? (t.contactEmailIsAccount || "Trùng với email tài khoản của bạn.")
                : (t.contactEmailNotAccount || "Vé sẽ được gửi tới địa chỉ này, không phải email tài khoản.")}
            </div>
          </div>

          <div>
            <label style={labelStyle}>{t.phoneNumber} *</label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input readOnly value="+84" style={{ width: "64px", padding: "10px 8px", borderRadius: "8px", border: "1px solid var(--border-input)", background: "var(--bg-hover)", textAlign: "center", color: "var(--text-secondary)" }} />
              <input
                type="text"
                maxLength={10}
                value={data.phone || ''}
                onChange={e => set({ phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                placeholder="0901234567"
                style={{ ...inputStyle, flex: 1 }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const labelStyle = { display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px", color: "var(--text-heading)" };
const inputStyle = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border-input)", fontSize: "14px", color: "var(--text-main)", background: "var(--bg-input)", transition: "border-color 0.2s" };

export default ContactInfoForm;
