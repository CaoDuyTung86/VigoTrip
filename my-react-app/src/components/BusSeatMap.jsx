import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../context/ThemeContext';
import { mixColor, withAlpha, THEME_EASE } from '../utils/sceneTheme';
import { useLanguage } from '../context/LanguageContext';

// ─── Component sơ đồ chỗ xe khách 2 tầng "sống động" ─────────────────────────
// Kiến trúc mirror AirplaneSeatMap / TrainSeatMap: 3 pha 'bus → zooming → interior',
// canvas cảnh ngày chạy RAF liên tục + DOM xe 2 tầng (click mở sơ đồ).
// Tầng suy ra client-side: SLEEPER/BUSINESS → Tầng 1 (giường nằm), ECONOMY → Tầng 2 (ghế).
const BusSeatMap = ({
  seats = [],
  selectedSeatIds = [],
  onToggleSeat,
  isSeatLockedByOthers,
  user,
  ownerToken,
  isAuthenticated,
  canSelectSeats,
  isMaxReached,
  maxSeats,
}) => {
  const { t } = useLanguage();

  const canvasRef = useRef(null);
  const wrapRef   = useRef(null);
  const busRef    = useRef(null);
  const animRef   = useRef(null);

  const [phase, setPhase] = useState('bus'); // 'bus' | 'zooming' | 'interior'
  const [floor, setFloor] = useState(1);     // 1 = giường nằm, 2 = ghế ngồi
  const [hoveredSeat, setHoveredSeat] = useState(null);
  const [hoveredBus, setHoveredBus] = useState(false);
  const [tooltipPos, setTooltipPos] = useState(null); // tooltip hover xe (portal, không bị cắt)
  const [rippleSeatId, setRippleSeatId] = useState(null);
  const [fitScale, setFitScale] = useState(1);

  const CANVAS_H = 400;

  // Theme ngày/đêm theo cài đặt user: 0 = đêm, 1 = ngày — ease mượt trong RAF
  const { isDark } = useTheme();
  const dayTargetRef = useRef(isDark ? 0 : 1);
  const dayMixRef = useRef(isDark ? 0 : 1);
  useEffect(() => { dayTargetRef.current = isDark ? 0 : 1; }, [isDark]);

  // ── Canvas cảnh ngày: trời xanh, mây trôi, cây/cột điện parallax, đường bộ ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width  = canvas.offsetWidth || 900;
      canvas.height = CANVAS_H;
    };
    resize();
    window.addEventListener('resize', resize);

    const H = CANVAS_H;
    const roadTop = H - 66;      // mép trên mặt đường
    const grassTop = H - 96;     // mép cỏ

    // Mây trắng mềm (sprite offscreen blur)
    const makeCloudSprite = (w, h, alpha) => {
      const pad = Math.ceil(h * 0.9);
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(w + pad * 2);
      cv.height = Math.ceil(h + pad * 2);
      const c2 = cv.getContext('2d');
      c2.filter = `blur(${Math.max(4, h * 0.16).toFixed(1)}px)`;
      c2.fillStyle = `rgba(255, 255, 255, ${(alpha * 0.6).toFixed(3)})`;
      c2.beginPath();
      c2.ellipse(pad + w / 2, pad + h * 0.6, w * 0.42, h * 0.3, 0, 0, Math.PI * 2);
      c2.fill();
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
    const clouds = Array.from({ length: 5 }, (_, i) => ({
      x: i * 260 + Math.random() * 80,
      y: 20 + Math.random() * H * 0.3,
      sprite: makeCloudSprite(90 + Math.random() * 110, 30 + Math.random() * 18, 0.9),
      speed: 0.35 + Math.random() * 0.3,
    }));

    // Lớp cây parallax — màu ngày/đêm trộn theo theme
    const mkTrees = (n, minH, maxH, spd, colNight, colDay, op) => Array.from({ length: n }, (_, i) => ({
      x: i * (1300 / n) + Math.random() * 70,
      h: minH + Math.random() * (maxH - minH),
      speed: spd,
      colNight,
      colDay,
      op,
    }));
    const farTrees  = mkTrees(10, 26, 48, 0.6, '#173227', '#15803d', 0.55);
    const nearTrees = mkTrees(7, 55, 95, 2.6, '#1a4731', '#166534', 0.95);

    // Cột điện
    const poles = Array.from({ length: 7 }, (_, i) => ({ x: i * 200 + Math.random() * 40 }));
    const POLE_SPAN = 7 * 200;

    // Sao đêm + sao băng (hiện khi chuyển sang dark mode)
    const stars = Array.from({ length: 26 }, () => ({
      x: Math.random() * 1200,
      y: Math.random() * H * 0.38,
      r: 0.5 + Math.random() * 1.1,
      a: 0.2 + Math.random() * 0.6,
      spd: 0.006 + Math.random() * 0.014,
    }));
    let meteors = [];

    let hillOff = 0;
    let dashOff = 0; // vạch kẻ đường trôi trái

    const drawTree = (tr, m, baseY) => {
      const { x, h, colNight, colDay, op } = tr;
      ctx.globalAlpha = op;
      ctx.fillStyle = mixColor('#0f2419', '#14532d', m);
      ctx.fillRect(x - 2, baseY - h * 0.35, 4, h * 0.35);
      ctx.fillStyle = mixColor(colNight, colDay, m);
      ctx.beginPath();
      ctx.moveTo(x, baseY - h);
      ctx.lineTo(x + h * 0.27, baseY - h * 0.26);
      ctx.lineTo(x - h * 0.27, baseY - h * 0.26);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    const draw = () => {
      const W = canvas.width;
      ctx.clearRect(0, 0, W, H);

      // Ease hệ số ngày/đêm về target → chuyển cảnh sáng/tối mượt
      dayMixRef.current += (dayTargetRef.current - dayMixRef.current) * THEME_EASE;
      const m = dayMixRef.current;

      // Trời: ngày (#87ceeb→#f0f9ff) ↔ đêm (#0f172a→#334155)
      const sky = ctx.createLinearGradient(0, 0, 0, grassTop + 30);
      sky.addColorStop(0, mixColor('#0f172a', '#87ceeb', m));
      sky.addColorStop(0.6, mixColor('#1e3a5f', '#dbeafe', m));
      sky.addColorStop(1, mixColor('#334155', '#f0f9ff', m));
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, grassTop + 30);

      // Mặt trời (ngày) / mờ dần khi tối
      const sunX = W * 0.82, sunY = H * 0.16;
      if (m > 0.02) {
        const halo = ctx.createRadialGradient(sunX, sunY, 6, sunX, sunY, 70);
        halo.addColorStop(0, `rgba(254, 240, 138, ${(0.95 * m).toFixed(3)})`);
        halo.addColorStop(0.35, `rgba(253, 224, 71, ${(0.35 * m).toFixed(3)})`);
        halo.addColorStop(1, 'rgba(253, 224, 71, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(sunX, sunY, 70, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(254, 252, 232, ${m.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(sunX, sunY, 15, 0, Math.PI * 2);
        ctx.fill();
      }

      // Mặt trăng (chế độ đêm) — hiện dần khi tối
      if (m < 0.98) {
        const nm = 1 - m;
        const moonX = W * 0.16, moonY = H * 0.15;
        const mHalo = ctx.createRadialGradient(moonX, moonY, 4, moonX, moonY, 46);
        mHalo.addColorStop(0, `rgba(226, 232, 240, ${(0.35 * nm).toFixed(3)})`);
        mHalo.addColorStop(1, 'rgba(226, 232, 240, 0)');
        ctx.fillStyle = mHalo;
        ctx.beginPath();
        ctx.arc(moonX, moonY, 46, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(226, 232, 240, ${(0.95 * nm).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(moonX, moonY, 13, 0, Math.PI * 2);
        ctx.fill();
        // Vài miệng hố mờ trên mặt trăng
        ctx.fillStyle = `rgba(148, 163, 184, ${(0.55 * nm).toFixed(3)})`;
        [[-4, -3, 3], [3, 4, 2], [5, -5, 1.6]].forEach(([dx, dy, r]) => {
          ctx.beginPath();
          ctx.arc(moonX + dx, moonY + dy, r, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Sao lấp lánh + sao băng (đêm) — mờ dần khi ngày
      stars.forEach(s => {
        s.a += s.spd;
        if (s.a > 0.95 || s.a < 0.15) s.spd = -s.spd;
        ctx.fillStyle = `rgba(255, 255, 255, ${(Math.max(0.15, Math.min(0.95, s.a)) * (1 - m)).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x % W, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });
      if (Math.random() < 0.014 * (1 - m) && meteors.length < 3) {
        meteors.push({
          x: W * (0.15 + Math.random() * 0.75),
          y: Math.random() * H * 0.22,
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

      // Mây trôi trái (đêm mờ bớt)
      clouds.forEach(c => {
        c.x -= c.speed;
        if (c.x + c.sprite.w < 0) c.x = W + 40 + Math.random() * 80;
        ctx.globalAlpha = 0.45 + 0.55 * m;
        ctx.drawImage(c.sprite.cv, c.x, c.y);
        ctx.globalAlpha = 1;
      });

      // Đồi cỏ xa
      hillOff += 0.15;
      ctx.fillStyle = withAlpha(mixColor('#0d1b2a', '#4ade80', m), 0.85 + (0.35 - 0.85) * m);
      ctx.beginPath();
      ctx.moveTo(0, grassTop);
      for (let x = 0; x <= W; x += 48) {
        const hx = (x + hillOff) * 0.008;
        ctx.lineTo(x, grassTop - 24 - Math.sin(hx) * 12 - Math.sin(hx * 2.3) * 7);
      }
      ctx.lineTo(W, grassTop);
      ctx.closePath();
      ctx.fill();

      // Cây xa
      farTrees.forEach(tr => {
        tr.x -= tr.speed;
        if (tr.x < -40) tr.x = W + 30 + Math.random() * 60;
        drawTree(tr, m, grassTop);
      });

      // Cột điện + dây
      poles.forEach(p => {
        p.x -= 1.4;
        if (p.x < -16) p.x += POLE_SPAN;
      });
      ctx.fillStyle = mixColor('#334155', '#64748b', m);
      poles.forEach(p => {
        ctx.fillRect(p.x, grassTop - 92, 4, 92);
        ctx.fillRect(p.x - 13, grassTop - 86, 30, 3);
      });
      ctx.strokeStyle = withAlpha(mixColor('#334155', '#94a3b8', m), 0.8);
      ctx.lineWidth = 1.2;
      [-82, -70].forEach(dy => {
        ctx.beginPath();
        poles.forEach((p, i) => {
          const px = p.x + 2;
          if (i === 0) ctx.moveTo(px, grassTop + dy);
          else ctx.quadraticCurveTo(px - 100, grassTop + dy + 6, px, grassTop + dy);
        });
        ctx.stroke();
      });

      // Dải cỏ ven đường
      const grass = ctx.createLinearGradient(0, grassTop, 0, roadTop);
      grass.addColorStop(0, mixColor('#166534', '#4ade80', m));
      grass.addColorStop(1, mixColor('#052e16', '#16a34a', m));
      ctx.fillStyle = grass;
      ctx.fillRect(0, grassTop, W, roadTop - grassTop);

      // Cây gần
      nearTrees.forEach(tr => {
        tr.x -= tr.speed;
        if (tr.x < -50) tr.x = W + 40 + Math.random() * 90;
        drawTree(tr, m, roadTop);
      });

      // Mặt đường nhựa
      ctx.fillStyle = mixColor('#1f2937', '#374151', m);
      ctx.fillRect(0, roadTop, W, H - roadTop);
      ctx.fillStyle = mixColor('#374151', '#4b5563', m);
      ctx.fillRect(0, roadTop, W, 3); // mép đường sáng

      // Vạch kẻ trắng đứt đoạn giữa đường — trôi nhanh nhất (xe lao phải)
      dashOff = (dashOff + 5) % 56;
      ctx.fillStyle = mixColor('#9ca3af', '#e5e7eb', m);
      for (let x = -dashOff; x < W + 56; x += 56) {
        ctx.fillRect(x, roadTop + (H - roadTop) / 2 - 2.5, 30, 5);
      }

      animRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // ── Tự scale xe vừa độ rộng khung ───────────────────────────────────────────
  useEffect(() => {
    const measure = () => {
      const wrap = wrapRef.current;
      const bus = busRef.current;
      if (!wrap || !bus) return;
      const avail = wrap.clientWidth - 24;
      const natural = bus.offsetWidth;
      if (natural > 0) setFitScale(Math.min(1, avail / natural));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [phase]);

  // ── Phân tầng: SLEEPER/BUSINESS → Tầng 1 (giường nằm), ECONOMY → Tầng 2 ────
  const floorOf = (s) => (['SLEEPER', 'BUSINESS'].includes(s.seatType) ? 1 : 2);

  // Thống kê nhanh cho tooltip hover xe
  const busStats = useMemo(() => {
    const avail = s => !s.booked && !isSeatLockedByOthers(s, ownerToken);
    const beds = seats.filter(s => ['SLEEPER', 'BUSINESS'].includes(s.seatType));
    const chairs = seats.filter(s => !['SLEEPER', 'BUSINESS'].includes(s.seatType));
    return {
      total: seats.length,
      available: seats.filter(avail).length,
      bedAvail: beds.filter(avail).length,
      bedTotal: beds.length,
      chairAvail: chairs.filter(avail).length,
      chairTotal: chairs.length,
    };
  }, [seats, isSeatLockedByOthers, ownerToken]);

  const floorSeats = useMemo(() => {
    const parse = sn => {
      const m = String(sn || '').match(/^(\d+)([A-Za-z])$/);
      return m ? { row: +m[1], col: m[2].toUpperCase() } : null;
    };
    const items = seats
      .map(s => { const p = parse(s.seatNumber); return p ? { ...s, ...p } : null; })
      .filter(Boolean);
    return items.filter(s => floorOf(s) === floor);
  }, [seats, floor]);

  const { leftCols, rightCols, rows, smap } = useMemo(() => {
    const filtered = floorSeats;
    const cols = [...new Set(filtered.map(s => s.col))].sort();
    const rowList = [...new Set(filtered.map(s => s.row))].sort((a, b) => a - b);
    const map = new Map(filtered.map(s => [`${s.row}${s.col}`, s]));
    const half = Math.ceil(cols.length / 2);
    return { leftCols: cols.slice(0, half), rightCols: cols.slice(half), rows: rowList, smap: map };
  }, [floorSeats]);

  const openBus = () => {
    setPhase('zooming');
    setTimeout(() => setPhase('interior'), 520);
  };

  const handleSeatClick = (seat) => {
    setRippleSeatId(seat.id);
    setTimeout(() => setRippleSeatId(null), 500);
    onToggleSeat(seat);
  };

  // ── Nút ghế ngồi / giường nằm ────────────────────────────────────────────────
  function renderSeatBtn(s) {
    const sel    = selectedSeatIds.includes(s.id);
    const locked = isSeatLockedByOthers(s, ownerToken);
    const isBed  = ['SLEEPER', 'BUSINESS'].includes(s.seatType);
    const rip    = rippleSeatId === s.id;

    let bg = 'linear-gradient(180deg,#10b981,#065f46)';
    let color = '#d1fae5';
    let border = '1.5px solid #34d399';
    let shadow = 'none';

    if (s.booked) {
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
    } else if (isBed) {
      bg = 'linear-gradient(180deg,#6366f1,#3730a3)';
      color = '#e0e7ff';
      border = '1.5px solid #818cf8';
      shadow = '0 2px 8px rgba(99,102,241,0.25)';
    }

    const berthUpper = s.row % 2 === 0; // hạng giường: hàng chẵn TRÊN / lẻ DƯỚI

    return (
      <div key={s.id} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => handleSeatClick(s)}
          disabled={!canSelectSeats(isAuthenticated, user) || s.booked || locked || (!sel && isMaxReached)}
          aria-label={`${t.smSpotLabel.replace('{seat}', s.seatNumber)}, ${isBed ? t.smSleeper : t.smSeatChair}, ${s.booked ? t.smBooked : locked ? t.smHeld : t.smVacant}`}
          onMouseEnter={() => setHoveredSeat(s)}
          onMouseLeave={() => setHoveredSeat(null)}
          className={`seat-btn${isBed ? " seat-btn-wide" : ""}`}
          style={{
            width: isBed ? 100 : 54,
            height: isBed ? 52 : 50,
            borderRadius: isBed ? 8 : '10px 10px 5px 5px',
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
            transform: sel ? 'scale(1.06)' : rip ? 'scale(0.92)' : 'scale(1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
          }}
        >
          {rip && <span style={{ position: 'absolute', width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.4)', animation: 'rippleSeat 0.4s linear' }} />}
          {isBed && <span style={{ position: 'absolute', top: 3, left: 3, fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 4, background: 'rgba(255,255,255,0.18)' }}>{berthUpper ? t.smUpper : t.smLower}</span>}
          <span style={{ lineHeight: 1 }}>{s.booked ? '✕' : locked ? '🔒' : isBed ? '🛏' : s.seatNumber}</span>
          {isBed && !s.booked && !locked && <span style={{ fontSize: 8, opacity: 0.85, fontWeight: 700 }}>{t.smBed}</span>}
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
            <div style={{ fontWeight: 700 }}>{isBed ? t.smBedLabel.replace('{seat}', s.seatNumber) : t.smSeatLabel.replace('{seat}', s.seatNumber)}</div>
            <div style={{ opacity: 0.75 }}>{isBed ? t.smSleeperBerth.replace('{berth}', berthUpper ? t.smBerthUpper : t.smBerthLower) : t.smSeatChair}</div>
          </div>
        )}
      </div>
    );
  }

  const wheel = (delay = 0) => (
    <span style={{
      width: 27, height: 27, borderRadius: '50%',
      background: 'conic-gradient(#0f172a 0 25%, #475569 0 50%, #0f172a 0 75%, #475569 0)',
      border: '3px solid #0b1220',
      boxShadow: '0 0 0 2px #334155',
      display: 'inline-block',
      animation: 'wheelSpin 0.7s linear infinite',
      animationDelay: `${delay}s`,
    }} />
  );

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Keyframes injection */}
      <style>{`
        @keyframes rippleSeat { to { transform: scale(3.5); opacity: 0; } }
        @keyframes fadeZoom { 
          0% { opacity: 0; backdrop-filter: blur(0px); } 
          40% { opacity: 0.6; backdrop-filter: blur(2px); }
          100% { opacity: 1; backdrop-filter: blur(6px); } 
        }
        @keyframes slideUp { 
          0% { opacity: 0; transform: translateY(22px) scale(0.98); } 
          100% { opacity: 1; transform: translateY(0) scale(1); } 
        }
        @keyframes busRock { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-1.5px) rotate(0.2deg); } }
        @keyframes wheelSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideFloorIn { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>

      {/* ── Cảnh xe khách (Exterior) — luôn mounted, ẩn bằng CSS khi trong xe ── */}
      <div style={{
        display: phase === 'interior' ? 'none' : 'block',
        position: 'relative',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 10px 40px rgba(0,0,0,0.35)',
        border: '1px solid var(--border-main)',
      }}>
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: `${CANVAS_H}px` }} />

        {/* Xe khách 2 tầng DOM trên đường — mũi bên phải hướng phải, tự scale vừa khung */}
        <div ref={wrapRef} style={{
          position: 'absolute',
          left: 0, right: 0,
          bottom: 40,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-end',
          overflow: 'hidden',
          pointerEvents: 'none',
        }}>
          <div
            ref={busRef}
            role="button"
            aria-label={t.smOpenBusMap}
            onClick={openBus}
            onMouseEnter={(e) => {
              setHoveredBus(true);
              const r = e.currentTarget.getBoundingClientRect();
              setTooltipPos({ x: r.left + r.width / 2, y: r.top });
            }}
            onMouseLeave={() => { setHoveredBus(false); setTooltipPos(null); }}
            style={{
              position: 'relative',
              width: 400, height: 146,
              flexShrink: 0,
              borderRadius: '14px 30px 30px 14px',
              background: 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 55%, #dbe3ec 100%)',
              border: `2px solid ${hoveredBus ? '#6366f1' : 'rgba(100,116,139,0.45)'}`,
              boxShadow: hoveredBus
                ? '0 0 28px rgba(99,102,241,0.55), 0 12px 26px rgba(0,0,0,0.4)'
                : '0 12px 26px rgba(0,0,0,0.4)',
              cursor: 'pointer',
              transition: 'border-color 0.2s, box-shadow 0.2s',
              transform: `scale(${fitScale})`,
              transformOrigin: 'bottom center',
              pointerEvents: 'auto',
            }}
          >
            {/* Lớp rung sway bên trong — element click giữ tĩnh để ổn định hit-target */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', animation: 'busRock 1.5s ease-in-out infinite' }}>

            {/* Nóc: viền nóc + 2 cụm máy lạnh */}
            <div style={{ position: 'absolute', top: 3, left: 14, right: 14, height: 3, background: 'rgba(148,163,184,0.55)', borderRadius: 2 }} />
            <div style={{ position: 'absolute', top: -6, left: 48, width: 50, height: 7, background: '#cbd5e1', borderRadius: '4px 4px 0 0' }} />
            <div style={{ position: 'absolute', top: -6, right: 96, width: 50, height: 7, background: '#cbd5e1', borderRadius: '4px 4px 0 0' }} />

            {/* Kính lái lớn ôm mũi phải */}
            <div style={{
              position: 'absolute', right: 12, top: 14, width: 56, height: 44,
              background: 'linear-gradient(180deg, #0b1220 0%, #1e3a8a 75%)',
              borderRadius: '10px 20px 16px 10px',
              border: '1.5px solid rgba(148,197,255,0.5)',
              boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.2)',
            }} />

            {/* Dải cửa sổ TẦNG 2 — 6 ô kính liền nan chia */}
            <div style={{
              position: 'absolute', left: 16, top: 17, width: 288, height: 26,
              borderRadius: 8,
              overflow: 'hidden',
              border: '1.5px solid rgba(15,23,42,0.3)',
              background: 'linear-gradient(180deg, #60a5fa 0%, #1e3a8a 70%)',
            }}>
              <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg, transparent 0 44px, rgba(241,245,249,0.9) 44px 48px)' }} />
              <div style={{ position: 'absolute', top: 1, left: 2, right: 2, height: 7, background: 'rgba(255,255,255,0.25)', borderRadius: 5 }} />
            </div>

            {/* Sọc đỏ livery ngang giữa 2 tầng + chỉ vàng */}
            <div style={{ position: 'absolute', left: 0, right: 8, top: 56, height: 11, background: 'linear-gradient(90deg, #b91c1c, #ef4444)' }} />
            <div style={{ position: 'absolute', left: 0, right: 8, top: 69, height: 3, background: '#fbbf24' }} />

            {/* Tên hãng giữa 2 tầng */}
            <div style={{ position: 'absolute', left: 22, top: 74, fontSize: 10, fontWeight: 800, color: '#475569', letterSpacing: 2.5 }}>VIGOTRIP</div>

            {/* Dải cửa sổ TẦNG 1 — 4 ô kính, bó trái né cửa */}
            <div style={{
              position: 'absolute', left: 16, top: 92, width: 196, height: 24,
              borderRadius: 8,
              overflow: 'hidden',
              border: '1.5px solid rgba(15,23,42,0.3)',
              background: 'linear-gradient(180deg, #60a5fa 0%, #1e3a8a 70%)',
            }}>
              <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg, transparent 0 44px, rgba(241,245,249,0.9) 44px 48px)' }} />
            </div>

            {/* Cửa lên xe tầng 1 — khung rõ + 2 ô kính */}
            <div style={{
              position: 'absolute', right: 86, top: 82, width: 22, height: 56,
              background: 'linear-gradient(180deg, #e8edf4, #c3cedb)',
              borderRadius: '4px 8px 2px 2px',
              boxShadow: 'inset 0 0 0 1.5px rgba(100,116,139,0.45)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 6,
            }}>
              <span style={{ width: 9, height: 20, background: '#1e3a8a', borderRadius: 3 }} />
              <span style={{ width: 9, height: 14, background: '#3b82f6', borderRadius: 3, opacity: 0.8 }} />
            </div>

            {/* Đèn pha cụm phải */}
            <div style={{ position: 'absolute', right: 5, top: 118, width: 11, height: 11, borderRadius: '50%', background: '#fde68a', border: '2px solid #92400e', boxShadow: '0 0 8px 2px rgba(253,224,71,0.7)' }} />

            {/* Gầm xe */}
            <div style={{ position: 'absolute', left: 4, right: 18, bottom: 3, height: 13, background: 'linear-gradient(180deg, #475569, #1e293b)', borderRadius: 3 }} />

            {/* 2 máng bánh (wheel arch) */}
            {[57, 297].map(x => (
              <div key={x} style={{ position: 'absolute', left: x, bottom: 4, width: 42, height: 20, background: '#0f172a', borderRadius: '21px 21px 0 0' }} />
            ))}

            {/* 2 BÁNH XE TO lăn trên mặt đường */}
            <div style={{ position: 'absolute', bottom: -12, left: 64 }}>{wheel(0)}</div>
            <div style={{ position: 'absolute', bottom: -12, left: 304 }}>{wheel(0.12)}</div>
            </div>{/* /lớp rung sway */}
          </div>
        </div>

        {/* Zoom / transition overlay */}
        {phase === 'zooming' && (
          <div style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            background: 'radial-gradient(circle at center, rgba(239,68,68,0.4) 0%, rgba(2,6,23,0.96) 75%)',
            animation: 'fadeZoom 0.52s cubic-bezier(0.22, 1, 0.36, 1) forwards',
            pointerEvents: 'none',
          }} />
        )}
      </div>

      {/* Hint — dưới canvas */}
      {phase === 'bus' && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
          <button
            type="button"
            onClick={openBus}
            style={{
              background: 'rgba(15,23,42,0.85)',
              backdropFilter: 'blur(10px)',
              color: '#f8fafc',
              fontSize: 12,
              fontWeight: 700,
              padding: '8px 24px',
              borderRadius: 24,
              border: '1px solid rgba(239,68,68,0.35)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#f87171';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(239,68,68,0.4)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.35)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.4)';
            }}
          >
            <span style={{ color: '#f87171' }}>🚌</span> {t.smBusHint}
          </button>
        </div>
      )}

      {/* Tooltip hover xe — portal ra body với position: fixed → không bị cắt */}
      {hoveredBus && tooltipPos && createPortal(
        <div style={{
          position: 'fixed',
          left: tooltipPos.x,
          top: tooltipPos.y - 10,
          transform: 'translate(-50%, -100%)',
          background: '#0f172a',
          color: '#fff',
          padding: '8px 14px',
          borderRadius: 8,
          fontSize: 11,
          whiteSpace: 'nowrap',
          zIndex: 9999,
          boxShadow: '0 6px 20px rgba(0,0,0,0.65)',
          border: '1px solid #334155',
          pointerEvents: 'none',
          lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 800 }}>🚌 {t.smBusBrand}</div>
          <div style={{ opacity: 0.85 }}>
            {t.smRemaining} <b style={{ color: busStats.available > 0 ? '#34d399' : '#f87171' }}>{busStats.available}</b>/{busStats.total} {t.smVacantSeats}
          </div>
          <div style={{ opacity: 0.75, fontSize: 10, marginTop: 2 }}>
            🛏 {t.smFloorN.replace('{index}', 1)}: {busStats.bedAvail}/{busStats.bedTotal} • 💺 {t.smFloorN.replace('{index}', 2)}: {busStats.chairAvail}/{busStats.chairTotal}
          </div>
        </div>,
        document.body
      )}

      {/* ── Sơ đồ chỗ trong xe (Interior) ── */}
      {phase === 'interior' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'slideUp 0.45s cubic-bezier(0.16, 1, 0.3, 1)' }}>

          {/* Header: quay lại + tab tầng + class filter + counter */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setPhase('bus')}
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
              <span>←</span> {t.smBackToBus}
            </button>

            <div style={{ width: 1, height: 24, background: 'var(--border-main)', margin: '0 4px' }} />

            {/* Tab tầng (spec: TẦNG 1 / TẦNG 2, active #6366f1) */}
            {[
              { f: 1, label: `🛏 ${t.smFloorN.replace('{index}', 1)} • ${t.smSleeper}` },
              { f: 2, label: `💺 ${t.smFloorN.replace('{index}', 2)} • ${t.smSeatChair}` },
            ].map(tab => (
              <button
                key={tab.f}
                type="button"
                onClick={() => setFloor(tab.f)}
                style={{
                  padding: '6px 15px',
                  borderRadius: 20,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  border: `1.5px solid ${floor === tab.f ? '#6366f1' : 'var(--border-input)'}`,
                  background: floor === tab.f ? '#4f46e5' : 'var(--bg-input)',
                  color: floor === tab.f ? '#fff' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {tab.label}
              </button>
            ))}

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
              {t.smSelectedCount} <span style={{ color: isMaxReached ? '#22c55e' : 'var(--primary)', fontSize: 14 }}>{selectedSeatIds.length}/{maxSeats}</span> {t.smSpotsUnit}
            </div>
          </div>

          {/* Khung sơ đồ chỗ của tầng đang chọn (slide khi đổi tầng) */}
          <div key={floor} style={{
            background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-main) 100%)',
            borderRadius: 24,
            border: '2px solid var(--border-main)',
            padding: '28px 16px 36px',
            boxShadow: '0 12px 36px rgba(0,0,0,0.2)',
            overflowX: 'auto',
            animation: 'slideFloorIn 0.35s ease-out',
          }} data-seat-scroll>
            {/* Đầu xe: tài xế & lối lên */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 22 }}>
              <div style={{
                width: 250,
                height: 60,
                background: 'linear-gradient(180deg, var(--bg-hover) 0%, var(--bg-card) 100%)',
                borderRadius: '120px 120px 12px 12px',
                border: '1.5px solid var(--border-main)',
                borderBottom: '2px solid var(--primary)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
              }}>
                <div style={{
                  width: 96, height: 16,
                  background: 'linear-gradient(180deg, #0f172a 0%, #1e3a8a 70%, #38bdf8 100%)',
                  borderRadius: '20px 20px 6px 6px',
                  border: '1px solid rgba(56,189,248,0.5)',
                  marginBottom: 4,
                }} />
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-main)', letterSpacing: '1px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: 'var(--primary)', fontSize: 13 }}>🚌</span> {t.smFloorN.replace('{index}', floor)} • {t.smDriverEntry}
                </div>
              </div>
            </div>

            {/* Column headers (sticky) */}
            <div className="seat-row seat-head" style={{
              display: 'flex',
              gap: 8,
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
              <div className="seat-rail" style={{ width: 36 }} />
              {leftCols.map(c => <div key={c} className={`seat-cell${floor === 1 ? " seat-cell-wide" : ""}`} style={{ width: floor === 1 ? 100 : 54, textAlign: 'center', fontWeight: 800, color: 'var(--primary)', fontSize: 13 }}>{c}</div>)}
              <div className="seat-aisle" style={{ width: 44, textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>{t.smAisle}</div>
              {rightCols.map(c => <div key={c} className={`seat-cell${floor === 1 ? " seat-cell-wide" : ""}`} style={{ width: floor === 1 ? 100 : 54, textAlign: 'center', fontWeight: 800, color: 'var(--primary)', fontSize: 13 }}>{c}</div>)}
            </div>

            {/* Hàng ghế / giường */}
            <div className="seat-rows" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {rows.map(row => {
                const rowIsBed = [...leftCols, ...rightCols].some(col => {
                  const s = smap.get(`${row}${col}`);
                  return s && ['SLEEPER', 'BUSINESS'].includes(s.seatType);
                });
                return (
                  <div key={row} className="seat-row" style={{
                    display: 'flex',
                    gap: 8,
                    marginBottom: rowIsBed ? 10 : 6,
                    alignItems: 'center',
                    background: rowIsBed ? 'rgba(99,102,241,0.05)' : 'transparent',
                    padding: rowIsBed ? '4px 8px' : '2px 8px',
                    borderRadius: 12,
                    border: rowIsBed ? '1px dashed rgba(99,102,241,0.2)' : 'none',
                  }}>
                    <div className="seat-rail" style={{ width: 36, textAlign: 'center', fontWeight: 700, color: rowIsBed ? 'var(--primary)' : 'var(--text-secondary)', fontSize: 12 }}>{row}</div>
                    {leftCols.map(col => {
                      const s = smap.get(`${row}${col}`);
                      if (!s) return <div key={col} className={`seat-cell${floor === 1 ? " seat-cell-wide" : ""}`} style={{ width: floor === 1 ? 100 : 54, height: 52 }} />;
                      return renderSeatBtn(s);
                    })}
                    {/* Lối đi giữa xe */}
                    <div className="seat-aisle" style={{
                      width: 44,
                      minHeight: 42,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'repeating-linear-gradient(180deg,transparent,transparent 6px,rgba(148,163,184,0.1) 6px,rgba(148,163,184,0.1) 10px)',
                      borderRadius: 4,
                    }}>
                      <span style={{ fontSize: 15, lineHeight: 1, filter: 'opacity(0.22)' }}>🚌</span>
                    </div>
                    {rightCols.map(col => {
                      const s = smap.get(`${row}${col}`);
                      if (!s) return <div key={col} className={`seat-cell${floor === 1 ? " seat-cell-wide" : ""}`} style={{ width: floor === 1 ? 100 : 54, height: 52 }} />;
                      return renderSeatBtn(s);
                    })}
                  </div>
                );
              })}
            </div>

            {/* Cuối xe: WC & cửa thoát hiểm */}
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
                <span>🚻</span> {t.smWcEmergency}
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
                { label: t.smSeatChair, bg: 'linear-gradient(180deg,#10b981,#065f46)', bdr: '#059669' },
                { label: t.smSleeper, bg: 'linear-gradient(180deg,#6366f1,#3730a3)', bdr: '#4f46e5' },
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

export default BusSeatMap;
