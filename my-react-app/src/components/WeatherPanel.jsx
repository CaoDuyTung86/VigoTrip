// @ts-check
import React, { useEffect, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { fetchForecast, toIsoDate, describeWeather, formatTemperature } from "../utils/weather";
import { formatDateShort } from "../utils/datetime";

/**
 * Dự báo thời tiết tại điểm đến vào ngày khởi hành.
 *
 * <p>Đặt ở nơi khách đã có sẵn cả địa điểm lẫn ngày: bảng tóm tắt đơn khi chọn chỗ, và danh sách
 * vé sắp đi. Cố tình KHÔNG đặt trên dải tin chạy — dải tin là kênh một nội dung cho mọi người,
 * còn thời tiết chỉ có nghĩa khi gắn với một nơi và một ngày cụ thể của từng người.
 *
 * <p><b>Không có dự báo là chuyện thường.</b> Kho chuyến phủ 30 ngày còn dự báo chỉ đáng tin
 * trong vòng một tuần, nên phần lớn lượt đặt vé sẽ rơi vào cảnh này. Khi đó khối tự ẩn hẳn: không
 * ô trống, không vòng xoay chờ, và tuyệt đối không lấy trung bình khí hậu nhiều năm ra lấp chỗ rồi
 * trình bày như dự báo.
 *
 * <p><b>Chỉ mô tả, không suy diễn.</b> Có dòng ghi rõ đây là thời tiết chứ không phải dự đoán giờ
 * chạy. Chữ "mưa to" nằm cạnh nút thanh toán rất dễ bị đọc thành "chuyến này sẽ hoãn", và dự báo
 * sai thì thành khiếu nại về tiền.
 */
const WeatherPanel = ({ place, date, compact = false }) => {
  const { t, currentLanguage } = useLanguage();

  // Khoá gộp cả nơi đến lẫn ngày. Lưu kèm kết quả chứ không xoá state ở đầu effect: xoá kiểu đó
  // là một lần setState đồng bộ trong effect, kéo theo một vòng render thừa mỗi lần khách bấm
  // qua chuyến khác. So khoá thì dự báo của chuyến cũ tự hết hiệu lực mà không cần render thêm.
  const ngay = toIsoDate(date);
  const khoa = place && ngay ? `${place}|${ngay}` : "";
  const [ketQua, setKetQua] = useState({ khoa: "", data: null });

  useEffect(() => {
    if (!khoa) return undefined;

    // Cờ huỷ để một phản hồi về muộn của chuyến đã bỏ chọn không ghi đè lên chuyến đang xem.
    let daBo = false;
    const [noiDen, ngayDi] = khoa.split("|");
    fetchForecast(noiDen, ngayDi).then((data) => {
      if (!daBo) setKetQua({ khoa, data });
    });
    return () => {
      daBo = true;
    };
  }, [khoa]);

  const forecast = ketQua.khoa === khoa ? ketQua.data : null;
  if (!forecast) return null;

  const troi = describeWeather(forecast.weatherCode, t);
  if (!troi) return null;

  const tenNoiDen = currentLanguage?.code === "vi"
    ? forecast.cityNameVi || forecast.placeCode
    : forecast.cityNameEn || forecast.placeCode;

  const tieuDe = (t.wxForecastFor || "")
    .replace("{city}", tenNoiDen)
    // Nối "T00:00:00" để chuỗi ngày trần được đọc theo giờ địa phương. Không có nó thì
    // new Date("2026-09-14") ra nửa đêm UTC, và khách ở múi giờ âm sẽ thấy lùi một ngày.
    .replace("{date}", formatDateShort(`${forecast.date}T00:00:00`, currentLanguage?.code));

  return (
    <div
      style={{
        marginTop: 10,
        padding: compact ? "8px 10px" : "10px 12px",
        background: "var(--bg-soft, rgba(125, 175, 255, 0.10))",
        border: "1px solid var(--border-main)",
        borderRadius: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: compact ? 20 : 24, lineHeight: 1 }} aria-hidden="true">
          {troi.icon}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)" }}>
            {formatTemperature(forecast.temperatureMinC)} – {formatTemperature(forecast.temperatureMaxC)}
            <span style={{ fontWeight: 500, color: "var(--text-secondary)" }}> · {troi.label}</span>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{tieuDe}</div>
        </div>
      </div>

      {Number.isFinite(forecast.precipitationProbability) && (
        <div style={{ marginTop: 6, fontSize: 11.5, color: "var(--text-secondary)" }}>
          {(t.wxRainChance || "").replace("{percent}", forecast.precipitationProbability)}
        </div>
      )}

      {/* Dòng dưới đây không phải chú thích cho đẹp: nó là thứ tách "dự báo thời tiết" khỏi
          "dự đoán chuyến sẽ hoãn" trong đầu người đọc, ngay tại chỗ dễ nhầm nhất. */}
      <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
        {t.wxDisclaimer}
      </div>
      {/* Open-Meteo cấp dữ liệu theo giấy phép CC-BY-4.0, bắt buộc ghi nguồn. */}
      <div style={{ marginTop: 2, fontSize: 10.5, color: "var(--text-muted)" }}>
        {(t.wxSource || "").replace("{source}", forecast.source || "Open-Meteo")}
      </div>
    </div>
  );
};

export default WeatherPanel;
