import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { FaUser, FaChild, FaBaby } from 'react-icons/fa';

const PassengerInfoForm = ({
  type,
  index,
  data,
  onChange,
  savedPassengers = [],
  onSelectSaved
}) => {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(true);

  // Type details
  const typeConfig = {
    ADULT: { icon: <FaUser style={{ color: "var(--primary)", fontSize: 16 }} />, label: t.adult || "Người lớn", desc: "> 12 tuổi", canSelectSaved: true },
    CHILD: { icon: <FaChild style={{ color: "var(--primary)", fontSize: 16 }} />, label: t.child || "Trẻ em", desc: "2 - 11 tuổi", canSelectSaved: true },
    INFANT: { icon: <FaBaby style={{ color: "var(--primary)", fontSize: 16 }} />, label: t.infant || "Em bé", desc: "< 2 tuổi", canSelectSaved: true }
  };

  const currentType = typeConfig[type] || typeConfig.ADULT;

  const handleChange = (e) => {
    const { name, value } = e.target;
    onChange(index, type, { ...data, [name]: value });
  };

  const handleSavedPassengerSelect = (e) => {
    const id = e.target.value;
    if (!id) return;
    const passenger = savedPassengers.find(p => p.id.toString() === id);
    if (passenger && onSelectSaved) {
      onSelectSaved(index, type, passenger);
    }
  };

  // Helper cho định dạng ngày sinh
  const formatDOB = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return digits.slice(0, 2) + '/' + digits.slice(2);
    return digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4);
  };

  const handleDobChange = (e) => {
    onChange(index, type, { ...data, dateOfBirth: formatDOB(e.target.value) });
  };

  // Lọc saved passengers cùng loại (hoặc không có type nếu guest)
  // Thực tế có thể cho phép chọn bất kỳ saved passenger nào vì ta có thể cast type hoặc user tự biết.
  // Tuy nhiên, tốt nhất nên show hết hoặc tự lọc theo type.
  const applicableSavedPassengers = savedPassengers; // .filter(p => !p.passengerType || p.passengerType === type)

  return (
    <div style={{
      border: "1px solid var(--border-main)",
      borderRadius: "12px",
      marginBottom: "16px",
      background: "var(--bg-card)",
      overflow: "hidden"
    }}>
      {/* Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: "16px",
          background: "var(--bg-input)",
          borderBottom: isExpanded ? "1px solid var(--border-light)" : "none",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {currentType.icon}
          <span style={{ fontWeight: "700", fontSize: "16px", color: "var(--text-heading)" }}>
            {currentType.label} {index + 1}
          </span>
          <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>({currentType.desc})</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {applicableSavedPassengers.length > 0 && isExpanded && (
            <select
              onChange={handleSavedPassengerSelect}
              value=""
              onClick={e => e.stopPropagation()}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid var(--border-input)",
                fontSize: "13px",
                background: "var(--bg-input)",
                color: "var(--primary)",
                fontWeight: "600",
                cursor: "pointer",
                outline: "none"
              }}
            >
              <option value="">+ Chọn hành khách đã lưu</option>
              {applicableSavedPassengers.map(sp => (
                <option key={sp.id} value={sp.id}>{sp.fullName} {sp.phone ? `(${sp.phone})` : ''}</option>
              ))}
            </select>
          )}
          <span style={{
            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.3s ease",
            color: "var(--text-muted)"
          }}>▼</span>
        </div>
      </div>

      {/* Body */}
      {isExpanded && (
        <div style={{ padding: "20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

            {/* Giới tính */}
            <div>
              <label style={labelStyle}>{t.gender || "Giới tính"} *</label>
              <select
                name="gender"
                value={data.gender || ''}
                onChange={handleChange}
                style={inputStyle}
              >
                <option value="">Chọn giới tính</option>
                <option value="Male">Nam</option>
                <option value="Female">Nữ</option>
                <option value="Other">Khác</option>
              </select>
            </div>

            {/* Họ và tên */}
            <div>
              <label style={labelStyle}>{t.fullName || "Họ và Tên"} (VD: NGUYEN VAN A) *</label>
              <input
                type="text"
                name="fullName"
                maxLength={50}
                value={data.fullName || ''}
                onChange={e => onChange(index, type, { ...data, fullName: e.target.value.replace(/[^a-zA-ZàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ\s]/g, '') })}
                placeholder="NHẬP HỌ VÀ TÊN"
                style={{ ...inputStyle, textTransform: "uppercase" }}
              />
            </div>

            {/* Ngày sinh */}
            <div>
              <label style={labelStyle}>{t.dob || "Ngày sinh"} *</label>
              <input
                type="text"
                name="dateOfBirth"
                value={data.dateOfBirth || ''}
                onChange={handleDobChange}
                placeholder="DD/MM/YYYY"
                maxLength={10}
                style={inputStyle}
              />
            </div>

            {/* Quốc tịch */}
            <div>
              <label style={labelStyle}>{t.nationality || "Quốc tịch"} *</label>
              <select
                name="nationality"
                value={data.nationality || 'Việt Nam'}
                onChange={handleChange}
                style={inputStyle}
              >
                <option value="Việt Nam">Việt Nam</option>
                <option value="Quốc tế">Quốc tế (Khác)</option>
              </select>
            </div>

            {/* Thông tin thêm chỉ cần cho người lớn / người đại diện */}
            {type === 'ADULT' && (
              <>
                {/* SĐT */}
                <div>
                  <label style={labelStyle}>{t.phoneNumber || "Số điện thoại"} *</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input readOnly value="+84" style={{ width: "64px", padding: "10px 8px", borderRadius: "8px", border: "1px solid var(--border-input)", background: "var(--bg-hover)", textAlign: "center", color: "var(--text-secondary)" }} />
                    <input
                      type="text"
                      name="phone"
                      maxLength={10}
                      value={data.phone || data.phoneDigits || ''}
                      onChange={e => onChange(index, type, { ...data, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                      placeholder="0901234567"
                      style={{ ...inputStyle, flex: 1 }}
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label style={labelStyle}>{t.emailField || "Email"} *</label>
                  <input
                    type="email"
                    name="email"
                    maxLength={60}
                    value={data.email || ''}
                    onChange={handleChange}
                    placeholder="email@example.com"
                    style={inputStyle}
                  />
                </div>

                {/* CCCD / Hộ chiếu */}
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>{t.idNumber || "CCCD / Hộ chiếu"} *</label>
                  <input
                    type="text"
                    name="idNumber"
                    maxLength={12}
                    value={data.idNumber || ''}
                    onChange={e => onChange(index, type, { ...data, idNumber: e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) })}
                    placeholder="Nhập số CCCD hoặc Mã Hộ chiếu (Tối đa 12 ký tự)"
                    style={inputStyle}
                  />
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
};

const labelStyle = { display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px", color: "var(--text-heading)" };
const inputStyle = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border-input)", fontSize: "14px", color: "var(--text-main)", background: "var(--bg-input)", transition: "border-color 0.2s" };

export default PassengerInfoForm;
