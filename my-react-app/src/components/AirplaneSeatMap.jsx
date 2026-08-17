import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { mixColor, THEME_EASE } from '../utils/sceneTheme';
import { useLanguage } from '../context/LanguageContext';

// ─── Hình học máy bay Top-Down (mũi hướng LÊN, tọa độ quanh tâm máy bay) ─────
// Nguồn chân lý duy nhất: wingtip, động cơ, đèn hàng không, contrail và hitbox
// đều tham chiếu từ đây — đối xứng 2 bên được bảo đảm tuyệt đối qua trục dọc.
const GEO = {
  fuselage: { halfW: 18, noseY: -150, tailY: 152 },
  // Cánh phải (bên trái = mirror): sweep ~29°, sải cánh lớn ~0.9 chiều dài,
  // thân cánh thon (root chord 62px) đẩy lên trên gần giữa thân
  wing: {
    rootLE: [16, -40], rootTE: [17, 22],
    kinkTE: [70, 32],                     // khủy cạnh sau kiểu airliner
    tipLE: [140, 28], tipTE: [141, 44],  // mũi cánh nhọn com
    tip: [141, 36],                       // wingtip = gốc contrail + vị trí đèn hàng không
  },
  // 1 động cơ/cánh: nacelle to, treo MẶT DƯỚI cánh (vẽ trước cánh để cánh che),
  // đầu lòi lên rõ trước cạnh trước cánh, đuôi chìm dưới cánh
  engine: { x: 58, y: -3, rx: 13, ry: 32 },
  // Cánh đuôi ngang
  stab: { rootLE: [9, 104], rootTE: [10, 136], tipLE: [56, 128], tipTE: [57, 138] },
  // Fin đuôi dọc (hình diều dọc trục, nhìn từ trên xuống)
  fin: { topY: 70, midX: 8, midY: 130, tipY: 148 },
};

function drawTopDownAirplane(ctx, cx, cy, hover, t, tr) {
  ctx.save();
  ctx.translate(cx, cy);

  // Nghiêng nhẹ qua trái/phải tạo cảm giác đang bay sống động
  const wobble = Math.sin(t * 0.0012) * 0.012;
  ctx.rotate(wobble);

  // Hover glow
  if (hover) {
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 32;
  }

  // ─── 1. CONTRAIL 2 ĐẦU CÁNH (vẽ trước, nằm dưới máy bay) ───────────────────
  // Ruy băng liên tục thon dần đều — nối 22 đoạn ngắn với lineCap tròn thay vì
  // chuỗi hình tròn rời
  [1, -1].forEach(side => {
    const x0 = GEO.wing.tip[0] * side;
    const y0 = GEO.wing.tip[1];
    const SEG = 22;
    ctx.lineCap = 'round';
    let px = x0, py = y0;
    for (let i = 1; i <= SEG; i++) {
      const p = i / SEG; // 0 tại wingtip → 1 ở cuối vệt
      const y = y0 + p * 150;
      const x = x0 + Math.sin(t * 0.0022 + p * 5.2) * (p * 5) - side * p * 9;
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 * (1 - p) + 0.03})`;
      ctx.lineWidth = 5.5 * (1 - p) + 0.7;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.stroke();
      px = x; py = y;
    }
  });

  // ─── 2. CÁNH + ĐỘNG CƠ + CÁNH ĐUÔI NGANG (vẽ 1 bên rồi mirror) ─────────────
  const drawWingSide = () => {
    const { rootLE, rootTE, kinkTE, tipLE, tipTE } = GEO.wing;

    // Mặt cánh airliner: cạnh trước thẳng sweep về sau, cạnh sau có khủy, mũi cánh bo tròn
    const wingGrad = ctx.createLinearGradient(16, 0, 142, 0);
    wingGrad.addColorStop(0, '#ffffff');
    wingGrad.addColorStop(0.55, '#e2e8f0');
    wingGrad.addColorStop(1, '#94a3b8');
    ctx.fillStyle = wingGrad;
    ctx.beginPath();
    ctx.moveTo(rootLE[0], rootLE[1]);
    ctx.lineTo(tipLE[0], tipLE[1]);
    ctx.lineTo(148, 39); // mũi cánh nhọn com theo hướng sweep
    ctx.lineTo(tipTE[0], tipTE[1]);
    ctx.lineTo(kinkTE[0], kinkTE[1]);
    ctx.lineTo(rootTE[0], rootTE[1]);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Cạnh trước cánh bắt sáng
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(rootLE[0] + 1, rootLE[1] + 2);
    ctx.lineTo(tipLE[0] - 1, tipLE[1] + 1);
    ctx.stroke();

    // Rãnh flap / aileron
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.18)';
    ctx.lineWidth = 1;
    [[32, -26, 132, 28], [30, -6, 112, 30]].forEach(([x1, y1, x2, y2]) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });
  };

  const drawEngineSide = () => {
    const { x, y, rx, ry } = GEO.engine;

    // Nacelle hình viên nang: cạnh bên thẳng, hai đầu bo — không quá tròn cũng không vuông
    const nacGrad = ctx.createLinearGradient(x - rx, 0, x + rx, 0);
    nacGrad.addColorStop(0, '#94a3b8');
    nacGrad.addColorStop(0.3, '#f8fafc');
    nacGrad.addColorStop(0.7, '#e2e8f0');
    nacGrad.addColorStop(1, '#64748b');
    ctx.fillStyle = nacGrad;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - rx, y - ry, rx * 2, ry * 2, rx * 0.85);
    else ctx.rect(x - rx, y - ry, rx * 2, ry * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Viền miệng hút gió mảnh phía trước
    ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - rx + 1.5, y - ry + 1, rx * 2 - 3, 3, 1.5);
    else ctx.rect(x - rx + 1.5, y - ry + 1, rx * 2 - 3, 3);
    ctx.fill();

    // Heat haze sau động cơ (nhấp nháy nhẹ)
    const hazeOp = 0.16 + 0.07 * Math.sin(t * 0.01 + x);
    const hazeGrad = ctx.createRadialGradient(x, y + ry + 6, 0, x, y + ry + 6, 16);
    hazeGrad.addColorStop(0, `rgba(251, 146, 60, ${hazeOp})`);
    hazeGrad.addColorStop(0.6, `rgba(56, 189, 248, ${hazeOp * 0.35})`);
    hazeGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = hazeGrad;
    ctx.beginPath();
    ctx.ellipse(x, y + ry + 7, 6, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawStabSide = () => {
    const { rootLE, rootTE, tipLE, tipTE } = GEO.stab;
    const stabGrad = ctx.createLinearGradient(9, 0, 58, 0);
    stabGrad.addColorStop(0, '#f1f5f9');
    stabGrad.addColorStop(1, '#94a3b8');
    ctx.fillStyle = stabGrad;
    ctx.beginPath();
    ctx.moveTo(rootLE[0], rootLE[1]);
    ctx.lineTo(tipLE[0], tipLE[1]);
    ctx.quadraticCurveTo(59, 133, tipTE[0], tipTE[1]);
    ctx.lineTo(rootTE[0], rootTE[1]);
    ctx.closePath();
    ctx.fill();
  };

  // Vẽ bên phải rồi mirror sang bên trái — đối xứng tuyệt đối.
  // Động cơ vẽ TRƯỚC cánh → nacelle nằm mặt dưới cánh, chỉ đầu lòi trước LE
  [1, -1].forEach(side => {
    ctx.save();
    ctx.scale(side, 1);
    drawStabSide();
    drawEngineSide();
    drawWingSide();
    ctx.restore();
  });

  // ─── 3. THÂN MÁY BAY (Fuselage) ────────────────────────────────────────────
  const fuselagePath = () => {
    const { halfW, noseY, tailY } = GEO.fuselage;
    ctx.beginPath();
    ctx.moveTo(0, noseY);
    ctx.bezierCurveTo(15, noseY + 3, halfW, noseY + 26, halfW, -92);
    ctx.lineTo(halfW, 64);
    ctx.bezierCurveTo(halfW - 1, 114, 13, tailY - 16, 0, tailY);
    ctx.bezierCurveTo(-13, tailY - 16, -halfW + 1, 114, -halfW, 64);
    ctx.lineTo(-halfW, -92);
    ctx.bezierCurveTo(-halfW, noseY + 26, -15, noseY + 3, 0, noseY);
    ctx.closePath();
  };

  // Khối trụ: sống lưng giữa sáng, 2 hông đổ tối dần
  const fuseGrad = ctx.createLinearGradient(-18, 0, 18, 0);
  fuseGrad.addColorStop(0, '#94a3b8');
  fuseGrad.addColorStop(0.2, '#e2e8f0');
  fuseGrad.addColorStop(0.5, '#ffffff');
  fuseGrad.addColorStop(0.8, '#e2e8f0');
  fuseGrad.addColorStop(1, '#94a3b8');
  ctx.fillStyle = fuseGrad;
  fuselagePath();
  ctx.fill();

  // Kính buồng lái (kính đen bóng có vệt phản chiếu, khung sáng chia đôi)
  const cockGrad = ctx.createLinearGradient(0, -137, 0, -125);
  cockGrad.addColorStop(0, '#04060c');   // đen sâu
  cockGrad.addColorStop(0.55, '#0b1526');
  cockGrad.addColorStop(1, '#14243d');   // đáy hắt sáng xanh đêm
  ctx.fillStyle = cockGrad;
  ctx.beginPath();
  ctx.moveTo(-9, -135);
  ctx.quadraticCurveTo(0, -143, 9, -135);
  ctx.quadraticCurveTo(5, -131, 6, -126);
  ctx.lineTo(-6, -126);
  ctx.quadraticCurveTo(-5, -131, -9, -135);
  ctx.closePath();
  ctx.fill();

  // Vệt phản chiếu ánh sáng trên bề mặt kính
  ctx.fillStyle = 'rgba(148, 197, 255, 0.28)';
  ctx.beginPath();
  ctx.moveTo(-6, -134);
  ctx.quadraticCurveTo(0, -139, 5, -136);
  ctx.lineTo(4, -133);
  ctx.quadraticCurveTo(0, -136, -5, -131);
  ctx.closePath();
  ctx.fill();

  // Khung kính sáng + thanh giữa
  ctx.strokeStyle = 'rgba(203, 213, 225, 0.95)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-9, -135);
  ctx.quadraticCurveTo(0, -143, 9, -135);
  ctx.quadraticCurveTo(5, -131, 6, -126);
  ctx.lineTo(-6, -126);
  ctx.quadraticCurveTo(-5, -131, -9, -135);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -140);
  ctx.lineTo(0, -127);
  ctx.stroke();

  // Dãy cửa sổ hành khách 2 bên (mirror)
  [1, -1].forEach(side => {
    for (let i = 0; i < 14; i++) {
      const wy = -92 + i * 10.5;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(13 * side, wy, 1.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(186, 230, 253, 0.8)';
      ctx.beginPath();
      ctx.arc(13 * side - 0.6, wy - 0.7, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // 2 cửa ra vào (viền mảnh)
  [-90, 44].forEach(dy => {
    [1, -1].forEach(side => {
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(13 * side - (side > 0 ? 0 : 5), dy, 5, 11, 2);
      else ctx.rect(13 * side - (side > 0 ? 0 : 5), dy, 5, 11);
      ctx.stroke();
    });
  });

  // Tên hãng dọc thân
  ctx.save();
  ctx.translate(0, -8);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 9px "Segoe UI", Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('V I G O T R I P', 0, 3);
  ctx.restore();

  // ─── 4. FIN ĐUÔI DỌC (hình diều dọc trục, trắng bạc) ───────────────────────
  const finGrad = ctx.createLinearGradient(-GEO.fin.midX, 0, GEO.fin.midX, 0);
  finGrad.addColorStop(0, '#cbd5e1');
  finGrad.addColorStop(0.5, '#f8fafc');
  finGrad.addColorStop(1, '#cbd5e1');
  ctx.fillStyle = finGrad;
  ctx.beginPath();
  ctx.moveTo(0, GEO.fin.topY);
  ctx.quadraticCurveTo(GEO.fin.midX, 95, GEO.fin.midX, GEO.fin.midY);
  ctx.lineTo(0, GEO.fin.tipY);
  ctx.lineTo(-GEO.fin.midX, GEO.fin.midY);
  ctx.quadraticCurveTo(-GEO.fin.midX, 95, 0, GEO.fin.topY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.22)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, GEO.fin.topY + 6);
  ctx.lineTo(0, GEO.fin.tipY - 4);
  ctx.stroke();

  // Ống thoát APU
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.ellipse(0, GEO.fuselage.tailY - 2, 2.6, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tắt shadow trước khi vẽ đèn
  ctx.shadowBlur = 0;

  // ─── 5. HỆ THỐNG ĐÈN HÀNG KHÔNG ────────────────────────────────────────────
  // Đỏ đầu cánh trái, xanh lá đầu cánh phải (chuẩn hàng không: port đỏ / starboard xanh)
  if (Math.sin(t * 0.01) > 0.35) {
    ctx.fillStyle = '#ef4444';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(-GEO.wing.tip[0], GEO.wing.tip[1], 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  if (Math.sin(t * 0.01 + Math.PI) > 0.35) {
    ctx.fillStyle = '#22c55e';
    ctx.shadowColor = '#22c55e';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(GEO.wing.tip[0], GEO.wing.tip[1], 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Đèn Strobe trắng ở đuôi + 2 đầu cánh
  if (Math.sin(t * 0.016) > 0.82) {
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 22;
    [[0, GEO.fuselage.tailY - 4], [-GEO.wing.tip[0], GEO.wing.tip[1]], [GEO.wing.tip[0], GEO.wing.tip[1]]].forEach(([lx, ly]) => {
      ctx.beginPath();
      ctx.arc(lx, ly, 2.6, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Đèn rọi loge giữa thân
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(0, -120, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // ─── 6. TOOLTIP KHI HOVER (khử wobble để luôn thẳng đứng) ──────────────────
  if (hover) {
    ctx.rotate(-wobble);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    const tw = 195;
    const th = 36;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-tw / 2, -206, tw, th, 10);
    else ctx.rect(-tw / 2, -206, tw, th);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`✈  ${tr.smOpenSeatMapHint}`, 0, -183);

    // Mũi tên trỏ xuống
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.beginPath();
    ctx.moveTo(-8, -170);
    ctx.lineTo(8, -170);
    ctx.lineTo(0, -161);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}





// ─── Component ────────────────────────────────────────────────────────────────
const AirplaneSeatMap = ({
  seats = [],
  selectedSeatIds = [],
  onToggleSeat,
  isSeatLockedByOthers,
  user,
  isAuthenticated,
  canSelectSeats,
  isMaxReached,
  maxSeats,
  selectedSeatClass,
  setSelectedSeatClass,
}) => {
  const canvasRef  = useRef(null);
  const phaseRef   = useRef('exterior');
  const hoverRef   = useRef(false);
  const animRef    = useRef(null);

  const { t } = useLanguage();
  // Giữ bản dịch mới nhất cho RAF loop canvas — text vẽ lại theo ngôn ngữ hiện tại
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; }, [t]);

  const [phase, setPhaseRaw] = useState('exterior'); // 'exterior' | 'zooming' | 'interior'
  const [hoveredSeat, setHoveredSeat] = useState(null);
  const [rippleSeatId, setRippleSeatId] = useState(null);

  const setPhase = useCallback((p) => {
    phaseRef.current = p;
    setPhaseRaw(p);
  }, []);

  const CANVAS_H = 480; // Canvas cao rộng rãi: máy bay hùng vĩ giữa trời, contrail tuôn hết chiều dài xuống dưới

  // Theme ngày/đêm theo cài đặt user: 0 = đêm, 1 = ngày — ease mượt trong RAF
  const { isDark } = useTheme();
  const dayTargetRef = useRef(isDark ? 0 : 1);
  const dayMixRef = useRef(isDark ? 0 : 1);
  useEffect(() => { dayTargetRef.current = isDark ? 0 : 1; }, [isDark]);

  // ── Canvas loop (chạy liên tục, mây trôi, máy bay cố định trung tâm) ──────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width  = canvas.offsetWidth || 850;
      canvas.height = CANVAS_H;
    };
    resize();
    window.addEventListener('resize', resize);

    // Mây tích mềm: vẽ các túi tròn đặc chồng khít lên đế ellipse rồi làm mờ
    // toàn bộ bằng canvas filter blur — cho khối mây liền mạch, khóe tan dần,
    // không còn hiện tượng từng chấm/cục rời nhau
    const makeCloudSprite = (w, h, alpha) => {
      const pad = Math.ceil(h * 0.9);
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(w + pad * 2);
      cv.height = Math.ceil(h + pad * 2);
      const c2 = cv.getContext('2d');
      c2.filter = `blur(${Math.max(4, h * 0.16).toFixed(1)}px)`;

      // Đế mây dài liền mạch bên dưới
      c2.fillStyle = `rgba(255, 255, 255, ${(alpha * 0.55).toFixed(3)})`;
      c2.beginPath();
      c2.ellipse(pad + w / 2, pad + h * 0.6, w * 0.42, h * 0.3, 0, 0, Math.PI * 2);
      c2.fill();

      // Các vòm mây phồng chồng khít phía trên
      const n = Math.max(4, Math.round(w / (h * 0.5)));
      for (let i = 0; i < n; i++) {
        const px = pad + (w * (i + 0.5)) / n + (Math.random() - 0.5) * (w / n) * 0.35;
        const pr = h * (0.32 + Math.random() * 0.3);
        const py = pad + h * 0.5 - pr * 0.25 + Math.random() * pr * 0.3;
        c2.fillStyle = `rgba(255, 255, 255, ${(alpha * (0.6 + Math.random() * 0.3)).toFixed(3)})`;
        c2.beginPath();
        c2.arc(px, py, pr, 0, Math.PI * 2);
        c2.fill();
      }
      c2.filter = 'none';
      return { cv, w: cv.width, h: cv.height };
    };

    // 3 Lớp mây trôi dọc xuống dưới lặp vô tận (Parallax Clouds - máy bay lao lên trên)
    const mkLayer = (n, minW, maxW, spd, op) => Array.from({ length: n }, () => {
      const w = minW + Math.random() * (maxW - minW);
      const h = 26 + Math.random() * 30;
      return {
        x: Math.random() * ((canvas.width || 850) + 300) - 150,
        y: Math.random() * CANVAS_H * 0.9,
        sprite: makeCloudSprite(w, h, op + Math.random() * 0.15),
        speed: spd + Math.random() * 0.25,
      };
    });

    const cloudLayers = [
      mkLayer(6, 120, 240, 0.45, 0.16), // Lớp mây xa chậm mờ
      mkLayer(5, 180, 320, 0.95, 0.26), // Lớp mây trung
      mkLayer(4, 250, 460, 1.80, 0.38), // Lớp mây gần trôi nhanh
    ];

    // Bụi sao / Hạt sáng lấp lánh ban đêm
    const stars = Array.from({ length: 48 }, () => ({
      x: Math.random() * (canvas.width || 850),
      y: Math.random() * CANVAS_H * 0.65,
      r: 0.5 + Math.random() * 1.5,
      a: Math.random(),
      spd: 0.008 + Math.random() * 0.018,
    }));

    // Sao băng (shooting stars)
    let meteors = [];

    // Tương tác chuột kiểm tra trúng vùng máy bay ở giữa màn hình
    const onMove = (e) => {
      if (phaseRef.current !== 'exterior') {
        canvas.style.cursor = 'default';
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width / rect.width;
      const sy = canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * sx;
      const my = (e.clientY - rect.top) * sy;

      const cx = canvas.width / 2;
      const cy = CANVAS_H / 2;

      // Hộp bao quanh máy bay ở trung tâm (sải cánh ±160, mũi/đuôi theo trục dọc)
      const hit = mx >= cx - 160 && mx <= cx + 160 && my >= cy - 160 && my <= cy + 160;
      hoverRef.current = hit;
      canvas.style.cursor = hit ? 'pointer' : 'default';
    };

    const onClick = (e) => {
      if (phaseRef.current !== 'exterior') return;
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width / rect.width;
      const sy = canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * sx;
      const my = (e.clientY - rect.top) * sy;

      const cx = canvas.width / 2;
      const cy = CANVAS_H / 2;

      if (mx >= cx - 160 && mx <= cx + 160 && my >= cy - 160 && my <= cy + 160) {
        setPhase('zooming');
        setTimeout(() => setPhase('interior'), 450);
      }
    };

    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('click', onClick);

    const draw = () => {
      const W = canvas.width;
      const H = CANVAS_H;
      const t = Date.now();
      const isInt = phaseRef.current === 'interior';
      ctx.clearRect(0, 0, W, H);

      // Ease hệ số ngày/đêm về target → chuyển cảnh sáng/tối mượt
      dayMixRef.current += (dayTargetRef.current - dayMixRef.current) * THEME_EASE;
      const m = dayMixRef.current;

      // Bầu trời: đêm ngọc lung linh ↔ ngày xanh trong
      const sg = ctx.createLinearGradient(0, 0, 0, H);
      if (isInt) {
        sg.addColorStop(0, '#030712');
        sg.addColorStop(0.5, '#0c1a30');
        sg.addColorStop(1, '#1e3a8a');
      } else {
        sg.addColorStop(0, mixColor('#020617', '#38bdf8', m));
        sg.addColorStop(0.35, mixColor('#072b54', '#7dd3fc', m));
        sg.addColorStop(0.7, mixColor('#0284c7', '#bae6fd', m));
        sg.addColorStop(1, mixColor('#38bdf8', '#e0f2fe', m));
      }
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, W, H);

      // Ánh sáng chân trời & Hoàng hôn / Biển mây phản chiếu (chỉ đêm, mờ dần khi ngày)
      if (!isInt) {
        const horizonGlow = ctx.createRadialGradient(W / 2, H * 1.05, 0, W / 2, H * 1.05, W * 0.65);
        horizonGlow.addColorStop(0, `rgba(254, 240, 138, ${(0.35 * (1 - m)).toFixed(3)})`);
        horizonGlow.addColorStop(0.5, `rgba(56, 189, 248, ${(0.25 * (1 - m)).toFixed(3)})`);
        horizonGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = horizonGlow;
        ctx.fillRect(0, 0, W, H);

        // Sao / Hạt sáng (mờ dần khi chuyển ngày)
        stars.forEach(s => {
          s.a += s.spd;
          if (s.a > 1 || s.a < 0.1) s.spd = -s.spd;
          ctx.fillStyle = `rgba(255, 255, 255, ${(Math.max(0, Math.min(1, s.a)) * (1 - m)).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fill();
        });

        // (Chế độ ngày không cần mặt trời — chỉ trời xanh trong + mây)

        // ── Sao băng: sinh ngẫu nhiên (chỉ đêm), vệt gradient trượt xuống ──
        if (Math.random() < 0.014 * (1 - m) && meteors.length < 3) {
          meteors.push({
            x: W * (0.15 + Math.random() * 0.75),
            y: Math.random() * H * 0.25,
            vx: -(3 + Math.random() * 3),
            vy: 2 + Math.random() * 2,
            life: 44, maxLife: 44,
          });
        }
        meteors = meteors.filter(mm => mm.life > 0);
        meteors.forEach(mm => {
          mm.x += mm.vx;
          mm.y += mm.vy;
          mm.life--;
          const p = mm.life / mm.maxLife;
          const trail = 9;
          const g = ctx.createLinearGradient(mm.x, mm.y, mm.x - mm.vx * trail, mm.y - mm.vy * trail);
          g.addColorStop(0, `rgba(255, 255, 255, ${(0.95 * p * (1 - m)).toFixed(3)})`);
          g.addColorStop(0.4, `rgba(186, 230, 253, ${(0.5 * p * (1 - m)).toFixed(3)})`);
          g.addColorStop(1, 'rgba(186, 230, 253, 0)');
          ctx.strokeStyle = g;
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(mm.x, mm.y);
          ctx.lineTo(mm.x - mm.vx * trail, mm.y - mm.vy * trail);
          ctx.stroke();
          ctx.fillStyle = `rgba(255, 255, 255, ${(0.95 * p * (1 - m)).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(mm.x, mm.y, 1.6, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Mây trôi xuống dưới liên tục (Parallax Effect - Máy bay có cảm giác lao vút lên trên)
      if (isInt) ctx.globalAlpha = 0.4; // trong khoang: mây mờ đi làm nền
      cloudLayers.forEach((layer, lIdx) => {
        // Chỉ vẽ 2 lớp mây xa dưới máy bay
        if (lIdx < 2 || isInt) {
          layer.forEach(c => {
            c.y += c.speed;
            if (c.y > H) {
              c.y = -c.sprite.h - Math.random() * 80;
              c.x = Math.random() * (W + 200) - 200;
            }
            ctx.drawImage(c.sprite.cv, c.x, c.y);
          });
        }
      });
      ctx.globalAlpha = 1;

      // VẼ MÁY BAY TOP-DOWN CHÍNH GIỮA MÀN HÌNH (mũi hướng lên - Exterior mode)
      if (phaseRef.current !== 'interior') {
        const centerX = W / 2;
        // Bồng bềnh nhẹ nhàng theo hàm sin tạo cảm giác đang bay mượt
        const centerY = (H / 2) + Math.sin(t * 0.0018) * 4.5;
        drawTopDownAirplane(ctx, centerX, centerY, hoverRef.current, t, tRef.current);
      }

      // Vẽ lớp mây gần nhất (Trôi qua phía trước / trên đầu cánh tạo chiều sâu 3D)
      if (!isInt) {
        cloudLayers[2].forEach(c => {
          c.y += c.speed;
          if (c.y > H) {
            c.y = -c.sprite.h - Math.random() * 60;
            c.x = Math.random() * (W + 150) - 100;
          }
          ctx.drawImage(c.sprite.cv, c.x, c.y);
        });
      }

      // Interior ambient glow
      if (isInt) {
        const cg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.4);
        cg.addColorStop(0, 'rgba(56, 189, 248, 0.1)');
        cg.addColorStop(1, 'transparent');
        ctx.fillStyle = cg;
        ctx.fillRect(0, 0, W, H);
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animRef.current);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('click', onClick);
      window.removeEventListener('resize', resize);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Seat data ─────────────────────────────────────────────────────────────
  const classTypes = useMemo(() => [...new Set(seats.map(s => s.seatType || 'ECONOMY'))], [seats]);

  const { leftCols, rightCols, rows, smap } = useMemo(() => {
    const filtered = selectedSeatClass ? seats.filter(s => (s.seatType || 'ECONOMY') === selectedSeatClass) : seats;
    const parse = sn => { const m = String(sn || '').match(/^(\d+)([A-Za-z])$/); return m ? { row: +m[1], col: m[2].toUpperCase() } : null; };
    const items = filtered.map(s => { const p = parse(s.seatNumber); return p ? { ...s, ...p } : null; }).filter(Boolean);
    const cols = [...new Set(items.map(i => i.col))].sort();
    const rList = [...new Set(items.map(i => i.row))].sort((a, b) => a - b);
    const map = new Map(items.map(i => [`${i.row}${i.col}`, i]));
    const half = Math.ceil(cols.length / 2);
    return { leftCols: cols.slice(0, half), rightCols: cols.slice(half), rows: rList, smap: map };
  }, [seats, selectedSeatClass]);

  const handleSeatClick = (seat) => {
    setRippleSeatId(seat.id);
    setTimeout(() => setRippleSeatId(null), 500);
    onToggleSeat(seat);
  };

  // ── Seat button ───────────────────────────────────────────────────────────
  function renderSeatBtn(s) {
    const sel    = selectedSeatIds.includes(s.id);
    const locked = isSeatLockedByOthers(s, user);
    const isBiz  = ['BUSINESS', 'VIP'].includes(s.seatType);
    const rip    = rippleSeatId === s.id;

    let bg = 'linear-gradient(180deg,#10b981,#065f46)';
    let color = '#d1fae5';
    let border = '1.5px solid #34d399';
    let shadow = 'none';

    if (s.booked)  {
      bg = 'var(--bg-hover)';
      color = 'var(--text-muted)';
      border = '1px solid var(--border-main)';
    } else if (locked) {
      bg = 'linear-gradient(180deg,#7f1d1d,#450a0a)';
      color = '#fca5a5';
      border = '1.5px solid #dc2626';
      shadow = '0 0 10px rgba(220,38,38,0.45)';
    } else if (sel) {
      bg = 'linear-gradient(180deg,#f59e0b,#b45309)';
      color = '#fff';
      border = '1.5px solid #fbbf24';
      shadow = '0 0 14px rgba(245,158,11,0.6)';
    } else if (isBiz) {
      bg = 'linear-gradient(180deg,#6366f1,#3730a3)';
      color = '#e0e7ff';
      border = '1.5px solid #818cf8';
      shadow = '0 2px 8px rgba(99,102,241,0.25)';
    }

    return (
      <div key={s.id} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => handleSeatClick(s)}
          disabled={!canSelectSeats(isAuthenticated, user) || s.booked || locked || (!sel && isMaxReached)}
          onMouseEnter={() => setHoveredSeat(s)}
          onMouseLeave={() => setHoveredSeat(null)}
          style={{
            width: 46,
            height: isBiz ? 50 : 42,
            borderRadius: '10px 10px 5px 5px',
            border,
            background: bg,
            color,
            fontWeight: 800,
            fontSize: 12,
            cursor: s.booked || locked ? 'not-allowed' : 'pointer',
            boxShadow: shadow,
            position: 'relative',
            overflow: 'hidden',
            transition: 'transform 0.18s cubic-bezier(0.4,0,0.2,1), box-shadow 0.18s',
            transform: sel ? 'scale(1.08)' : rip ? 'scale(0.92)' : 'scale(1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
          }}
        >
          {rip && <span style={{ position: 'absolute', width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.4)', animation: 'rippleSeat 0.4s linear' }} />}
          <span style={{ lineHeight: 1 }}>{s.booked ? '✕' : locked ? '🔒' : s.seatNumber}</span>
          {isBiz && !s.booked && !locked && <span style={{ fontSize: 8, opacity: 0.85, fontWeight: 700 }}>BIZ</span>}
        </button>

        {/* Tooltip on hover */}
        {hoveredSeat?.id === s.id && !s.booked && !locked && (
          <div style={{
            position: 'absolute',
            bottom: '110%',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#0f172a',
            color: '#fff',
            padding: '5px 10px',
            borderRadius: 6,
            fontSize: 11,
            whiteSpace: 'nowrap',
            zIndex: 30,
            boxShadow: '0 4px 12px rgba(0,0,0,0.55)',
            border: '1px solid #334155',
            pointerEvents: 'none',
            lineHeight: 1.6,
          }}>
            <div style={{ fontWeight: 700 }}>{t.smSeatLabel.replace('{seat}', s.seatNumber)}</div>
            <div style={{ opacity: 0.75 }}>{isBiz ? `${t.smBizClass} (×2.5)` : t.smEcoClass}</div>
          </div>
        )}
      </div>
    );
  }

  // ─── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Keyframes injection */}
      <style>{`
        @keyframes rippleSeat { to { transform: scale(3.5); opacity: 0; } }
        @keyframes fadeZoom { 0%{opacity:0; transform:scale(1)} 50%{opacity:1; transform:scale(1.08)} 100%{opacity:1; transform:scale(1.15)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* ── Canvas section (luôn giữ canvas trong DOM, ẩn bằng CSS để không hủy loop vẽ) ── */}
      <div style={{
        display: phase === 'interior' ? 'none' : 'block',
        position: 'relative',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 10px 40px rgba(0,0,0,0.42)',
        border: '1px solid var(--border-main)',
      }}>
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: `${CANVAS_H}px` }} />

        {/* Zoom / transition overlay mượt mà */}
        {phase === 'zooming' && (
          <div style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            background: 'radial-gradient(circle at center, rgba(14, 165, 233, 0.45) 0%, rgba(2, 6, 23, 0.95) 80%)',
            animation: 'fadeZoom 0.45s cubic-bezier(0.4,0,0.2,1) forwards',
            pointerEvents: 'none',
          }} />
        )}
      </div>

      {/* Hint — đặt DƯỚI canvas, đồng bộ với tàu / xe khách */}
      {phase === 'exterior' && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
          <div style={{
            background: 'rgba(15,23,42,0.85)',
            backdropFilter: 'blur(10px)',
            color: '#f8fafc',
            fontSize: 12,
            fontWeight: 700,
            padding: '7px 22px',
            borderRadius: 24,
            border: '1px solid rgba(56,189,248,0.35)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span style={{ color: '#38bdf8' }}>✈</span> {t.smPlaneHint}
          </div>
        </div>
      )}

      {/* ── Sơ đồ ghế ngồi (Interior mode: chỉ hiển thị sơ đồ ghế + nút quay lại) ── */}
      {phase === 'interior' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'slideUp 0.35s ease-out' }}>

          {/* Header bar: Nút quay lại + Filter khoang + Bộ đếm ghế */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Nút quay lại góc nhìn bên ngoài ở góc trên bên trái */}
            <button
              type="button"
              onClick={() => setPhase('exterior')}
              style={{
                background: 'var(--bg-card)',
                color: 'var(--primary)',
                border: '1.5px solid var(--primary)',
                borderRadius: 20,
                padding: '6px 16px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                transition: 'all 0.2s',
              }}
            >
              <span>←</span> {t.smExteriorView}
            </button>

            <div style={{ width: 1, height: 24, background: 'var(--border-main)', margin: '0 4px' }} />

            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>{t.smCabinLabel}</span>
            <button
              type="button"
              onClick={() => setSelectedSeatClass('')}
              style={{
                padding: '6px 15px',
                borderRadius: 20,
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.2s',
                border: `1.5px solid ${!selectedSeatClass ? 'var(--primary)' : 'var(--border-input)'}`,
                background: !selectedSeatClass ? 'var(--primary)' : 'var(--bg-input)',
                color: !selectedSeatClass ? '#fff' : 'var(--text-secondary)',
              }}
            >
                  {t.seatClassAll}
            </button>
            {classTypes.map(cls => {
              const biz = ['BUSINESS', 'VIP'].includes(cls);
              const act = selectedSeatClass === cls;
              return (
                <button
                  key={cls}
                  type="button"
                  onClick={() => setSelectedSeatClass(cls)}
                  style={{
                    padding: '6px 15px',
                    borderRadius: 20,
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    border: `1.5px solid ${act ? (biz ? '#6366f1' : '#10b981') : 'var(--border-input)'}`,
                    background: act ? (biz ? '#4338ca' : '#059669') : 'var(--bg-input)',
                    color: act ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  {cls === 'BUSINESS' ? `🔵 ${t.seatClassBiz}` : cls === 'ECONOMY' ? `🟢 ${t.seatClassEco}` : cls}
                </button>
              );
            })}

            {/* Seat counter */}
            <div style={{
              marginLeft: 'auto',
              padding: '6px 16px',
              borderRadius: 20,
              fontWeight: 700,
              fontSize: 12,
              background: isMaxReached ? 'rgba(34,197,94,0.12)' : 'var(--bg-input)',
              border: `1.5px solid ${isMaxReached ? '#22c55e' : 'var(--border-input)'}`,
              color: isMaxReached ? '#22c55e' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              {t.smSelectedCount} <span style={{ color: isMaxReached ? '#22c55e' : 'var(--primary)', fontSize: 14 }}>{selectedSeatIds.length}/{maxSeats}</span> {t.smSeatsUnit}
            </div>
          </div>

          {/* Sơ đồ ghế ngồi theo kết cấu thân máy bay */}
          <div style={{
            background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-main) 100%)',
            borderRadius: 24,
            border: '2px solid var(--border-main)',
            padding: '28px 16px 36px',
            boxShadow: '0 12px 36px rgba(0,0,0,0.2)',
            overflowX: 'auto',
          }}>
            {/* Cockpit nose & Front Door (Thiết kế thanh lịch, gọn gàng, căn chính giữa trục lối đi) */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 22 }}>
              <div style={{
                width: 240,
                height: 64,
                background: 'linear-gradient(180deg, var(--bg-hover) 0%, var(--bg-card) 100%)',
                borderRadius: '120px 120px 12px 12px',
                border: '1.5px solid var(--border-main)',
                borderBottom: '2px solid var(--primary)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                overflow: 'hidden',
              }}>
                {/* Kính buồng lái cách điệu xanh Navy */}
                <div style={{
                  width: 96,
                  height: 18,
                  background: 'linear-gradient(180deg, #0f172a 0%, #1e3a8a 70%, #38bdf8 100%)',
                  borderRadius: '20px 20px 6px 6px',
                  border: '1px solid rgba(56,189,248,0.5)',
                  boxShadow: '0 0 10px rgba(56,189,248,0.25)',
                  marginBottom: 4,
                }} />

                {/* Nhãn Buồng lái & Cửa trước */}
                <div style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: 'var(--text-main)',
                  letterSpacing: '1px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  textTransform: 'uppercase',
                }}>
                  <span style={{ color: 'var(--primary)', fontSize: 13 }}>✈</span> {t.smCockpit} & {t.smFrontDoor}
                </div>
              </div>
            </div>

            {/* Column headers (sticky) */}
            <div style={{
              display: 'flex',
              gap: 8,
              marginBottom: 12,
              justifyContent: 'center',
              position: 'sticky',
              top: 0,
              zIndex: 5,
              background: 'var(--bg-card)',
              padding: '6px 14px',
              borderRadius: 12,
              border: '1px solid var(--border-light)',
              width: 'fit-content',
              margin: '0 auto 12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}>
              <div style={{ width: 36 }} />
              {leftCols.map(c => <div key={c} style={{ width: 46, textAlign: 'center', fontWeight: 800, color: 'var(--primary)', fontSize: 13 }}>{c}</div>)}
              <div style={{ width: 44, textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>{t.smAisle}</div>
              {rightCols.map(c => <div key={c} style={{ width: 46, textAlign: 'center', fontWeight: 800, color: 'var(--primary)', fontSize: 13 }}>{c}</div>)}
            </div>

            {/* Seat rows */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {rows.map(row => {
                const rowIsBiz = [...leftCols, ...rightCols].some(col => {
                  const s = smap.get(`${row}${col}`);
                  return s && ['BUSINESS', 'VIP'].includes(s.seatType);
                });
                return (
                  <div key={row} style={{
                    display: 'flex',
                    gap: 8,
                    marginBottom: rowIsBiz ? 10 : 6,
                    alignItems: 'center',
                    background: rowIsBiz ? 'rgba(99,102,241,0.05)' : 'transparent',
                    padding: rowIsBiz ? '4px 8px' : '2px 8px',
                    borderRadius: 12,
                    border: rowIsBiz ? '1px dashed rgba(99,102,241,0.2)' : 'none',
                  }}>
                    <div style={{ width: 36, textAlign: 'center', fontWeight: 700, color: rowIsBiz ? 'var(--primary)' : 'var(--text-secondary)', fontSize: 12 }}>{row}</div>
                    {leftCols.map(col => {
                      const s = smap.get(`${row}${col}`);
                      if (!s) return <div key={col} style={{ width: 46, height: 44 }} />;
                      return renderSeatBtn(s);
                    })}
                    {/* Aisle with ✈ icon */}
                    <div style={{
                      width: 44,
                      height: 42,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'repeating-linear-gradient(180deg,transparent,transparent 6px,rgba(148,163,184,0.1) 6px,rgba(148,163,184,0.1) 10px)',
                      borderRadius: 4,
                    }}>
                      <span style={{ fontSize: 15, lineHeight: 1, filter: 'opacity(0.22)' }}>✈</span>
                    </div>
                    {rightCols.map(col => {
                      const s = smap.get(`${row}${col}`);
                      if (!s) return <div key={col} style={{ width: 46, height: 44 }} />;
                      return renderSeatBtn(s);
                    })}
                  </div>
                );
              })}
            </div>

            {/* Tail & Rear Exit / WC (Thiết kế thanh lịch, gọn gàng căn chính giữa) */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 20 }}>
              <div style={{
                width: 220,
                height: 42,
                background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-hover) 100%)',
                borderRadius: '8px 8px 110px 110px',
                border: '1.5px solid var(--border-main)',
                borderTop: '2px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-secondary)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              }}>
                <span>🚻</span> {t.smWcEmergencyRear}
              </div>
            </div>

            {/* Legend — 5 states */}
            <div style={{
              display: 'flex',
              gap: 16,
              marginTop: 22,
              fontSize: 12,
              color: 'var(--text-secondary)',
              flexWrap: 'wrap',
              justifyContent: 'center',
              paddingTop: 16,
              borderTop: '1px solid var(--border-light)',
            }}>
              {[
                { label: t.seatClassEco, bg: 'linear-gradient(180deg,#10b981,#065f46)', bdr: '#059669' },
                { label: t.seatClassBiz, bg: 'linear-gradient(180deg,#6366f1,#3730a3)', bdr: '#4f46e5' },
                { label: t.smSelecting, bg: 'linear-gradient(180deg,#f59e0b,#d97706)', bdr: '#fbbf24', glow: 'rgba(245,158,11,0.6)' },
                { label: `${t.smHeld} (RT)`, bg: 'linear-gradient(180deg,#7f1d1d,#450a0a)', bdr: '#dc2626' },
                { label: t.smBooked, bg: 'var(--bg-hover)', bdr: 'var(--border-main)' },
              ].map(item => (
                <span key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 16, height: 16, borderRadius: 4, background: item.bg, border: `1px solid ${item.bdr}`, display: 'inline-block', boxShadow: item.glow ? `0 0 6px ${item.glow}` : 'none' }} />
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AirplaneSeatMap;
