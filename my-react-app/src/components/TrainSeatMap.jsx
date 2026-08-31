import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../context/ThemeContext';
import { mixColor, withAlpha, THEME_EASE } from '../utils/sceneTheme';
import { useLanguage } from '../context/LanguageContext';

// ─── Component sơ đồ ghế tàu hỏa "sống động" ─────────────────────────────────
// Kiến trúc mirror AirplaneSeatMap: 3 pha 'train → zooming → interior',
// canvas cảnh nền chạy RAF liên tục + DOM thẻ toa (dễ hover/click).
const TrainSeatMap = ({
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
  const { t } = useLanguage();

  const canvasRef = useRef(null);
  const wrapRef   = useRef(null);
  const trainRef  = useRef(null);
  const animRef   = useRef(null);

  const [phase, setPhase]   = useState('train'); // 'train' | 'zooming' | 'interior'
  const [activeToa, setActiveToa] = useState(0);
  const [hoveredSeat, setHoveredSeat] = useState(null);
  const [hoveredToa, setHoveredToa]   = useState(null);
  const [tooltipPos, setTooltipPos] = useState(null); // vị trí fixed của tooltip (portal, không bao giờ bị cắt)
  const [rippleSeatId, setRippleSeatId] = useState(null);
  const [fitScale, setFitScale] = useState(1); // tự scale đoàn tàu vừa khung, không cần cuộn

  const CANVAS_H = 400; // canvas cao thoáng: tooltip toa không bị cắt, đoàn tàu rõ ràng

  // Theme ngày/đêm theo cài đặt user: 0 = đêm, 1 = ngày — ease mượt trong RAF
  const { isDark } = useTheme();
  const dayTargetRef = useRef(isDark ? 0 : 1);
  const dayMixRef = useRef(isDark ? 0 : 1);
  useEffect(() => { dayTargetRef.current = isDark ? 0 : 1; }, [isDark]);
  const NUM_TOAS = 4; // số toa mặc định (không tính đầu máy)

  // ── Canvas cảnh: trời chiều + parallax cây/cột điện + đường ray trôi trái ───
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
    const groundY = H - 52;      // mặt đất
    const railY1 = H - 34;       // thanh ray trên
    const railY2 = H - 26;       // thanh ray dưới

    // Sao đêm mờ (vùng trời tối phía trên)
    const stars = Array.from({ length: 26 }, () => ({
      x: Math.random() * 1200,
      y: Math.random() * H * 0.38,
      r: 0.5 + Math.random() * 1.1,
      a: 0.2 + Math.random() * 0.6,
      spd: 0.006 + Math.random() * 0.014,
    }));

    // Lớp cây parallax (xa chậm mờ / gần nhanh đậm) — màu ngày/đêm trộn theo theme
    const mkTrees = (n, minH, maxH, spd, colNight, colDay, op) => Array.from({ length: n }, (_, i) => ({
      x: i * (1300 / n) + Math.random() * 70,
      h: minH + Math.random() * (maxH - minH),
      speed: spd,
      colNight,
      colDay,
      op,
    }));
    const farTrees  = mkTrees(10, 28, 52, 1.5, '#173227', '#15803d', 0.55);
    const nearTrees = mkTrees(7, 55, 95, 6.5, '#1a4731', '#166534', 0.95);

    // Vệt tốc độ — tăng cảm giác tàu siêu tốc
    const streaks = Array.from({ length: 6 }, () => ({
      x: Math.random() * 1400,
      y: 40 + Math.random() * 240,
      len: 70 + Math.random() * 100,
      speed: 10 + Math.random() * 6,
      op: 0.08 + Math.random() * 0.1,
    }));

    // Cột điện dọc tuyến (7 cột / chu kỳ ~200px)
    const poles = Array.from({ length: 7 }, (_, i) => ({ x: i * 200 + Math.random() * 40 }));
    const POLE_SPAN = 7 * 200;

    // Sao băng (shooting stars)
    let meteors = [];

    let hillOff = 0;  // trôi đồi nền chậm
    let tieOff  = 0;  // offset thanh ngang đường ray (trôi nhanh nhất)

    const drawTree = (tr, m) => {
      const { x, h, colNight, colDay, op } = tr;
      ctx.globalAlpha = op;
      ctx.fillStyle = mixColor('#0f2419', '#14532d', m);
      ctx.fillRect(x - 2, groundY - h * 0.35, 4, h * 0.35);
      ctx.fillStyle = mixColor(colNight, colDay, m);
      ctx.beginPath();
      ctx.moveTo(x, groundY - h);
      ctx.lineTo(x + h * 0.27, groundY - h * 0.26);
      ctx.lineTo(x - h * 0.27, groundY - h * 0.26);
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

      // Trời: đêm (#0f172a→#4a7c9e) ↔ ngày (#87ceeb→#f0f9ff)
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, mixColor('#0f172a', '#87ceeb', m));
      sky.addColorStop(0.6, mixColor('#1e3a5f', '#dbeafe', m));
      sky.addColorStop(1, mixColor('#4a7c9e', '#f0f9ff', m));
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // Sao lấp lánh (mờ dần khi ngày)
      stars.forEach(s => {
        s.a += s.spd;
        if (s.a > 0.95 || s.a < 0.15) s.spd = -s.spd;
        ctx.fillStyle = `rgba(255, 255, 255, ${(Math.max(0.15, Math.min(0.95, s.a)) * (1 - m)).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x % W, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Mặt trời (chế độ ngày) — hiện dần khi sáng
      if (m > 0.02) {
        const sunX = W * 0.82, sunY = H * 0.16;
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

      // ── Sao băng (shooting stars): sinh ngẫu nhiên (chỉ đêm), vệt gradient trượt xuống ──
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
        // đầu sao sáng
        ctx.fillStyle = `rgba(255, 255, 255, ${(0.95 * p * (1 - m)).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(mm.x, mm.y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      });

      // Đồi nền xa trôi rất chậm
      hillOff += 0.4;
      ctx.fillStyle = withAlpha(mixColor('#0d1b2a', '#4ade80', m), 0.85 + (0.35 - 0.85) * m);
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      for (let x = 0; x <= W; x += 48) {
        const hx = (x + hillOff) * 0.008;
        ctx.lineTo(x, groundY - 30 - Math.sin(hx) * 14 - Math.sin(hx * 2.3) * 8);
      }
      ctx.lineTo(W, groundY);
      ctx.closePath();
      ctx.fill();

      // Vệt tốc độ trôi ngang — cảm giác siêu tốc
      streaks.forEach(st => {
        st.x -= st.speed;
        if (st.x + st.len < 0) {
          st.x = W + 80 + Math.random() * 140;
          st.y = 40 + Math.random() * 240;
        }
        ctx.strokeStyle = `rgba(255, 255, 255, ${(st.op * (1 - 0.45 * m)).toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(st.x, st.y);
        ctx.lineTo(st.x + st.len, st.y);
        ctx.stroke();
      });

      // Cây xa
      farTrees.forEach(tr => {
        tr.x -= tr.speed;
        if (tr.x < -40) tr.x = W + 30 + Math.random() * 60;
        drawTree(tr, m);
      });

      // Cột điện + dây (trôi nhanh — tàu siêu tốc)
      poles.forEach(p => {
        p.x -= 3.4;
        if (p.x < -16) p.x += POLE_SPAN;
      });
      ctx.fillStyle = mixColor('#334155', '#64748b', m);
      poles.forEach(p => {
        ctx.fillRect(p.x, groundY - 92, 4, 92);
        ctx.fillRect(p.x - 13, groundY - 86, 30, 3);
      });
      ctx.strokeStyle = withAlpha(mixColor('#334155', '#94a3b8', m), 0.9);
      ctx.lineWidth = 1.2;
      [-82, -70].forEach(dy => {
        ctx.beginPath();
        poles.forEach((p, i) => {
          const px = p.x + 2;
          if (i === 0) ctx.moveTo(px, groundY + dy);
          else ctx.quadraticCurveTo(px - 100, groundY + dy + 6, px, groundY + dy);
        });
        ctx.stroke();
      });

      // Mặt đất + lớp đá dăm
      ctx.fillStyle = mixColor('#1c2a42', '#6b7280', m);
      ctx.fillRect(0, groundY, W, H - groundY);
      ctx.fillStyle = mixColor('#26344e', '#9ca3af', m);
      ctx.fillRect(0, railY1 - 10, W, 26);

      // Cây gần (trôi nhanh, trước mặt đất)
      nearTrees.forEach(tr => {
        tr.x -= tr.speed;
        if (tr.x < -50) tr.x = W + 40 + Math.random() * 90;
        drawTree(tr, m);
      });

      // Thanh ngang đường ray — trôi nhanh nhất tạo cảm giác tàu lao như tên lửa
      tieOff = (tieOff + 9) % 30;
      ctx.fillStyle = mixColor('#3f4c63', '#6b7280', m);
      for (let x = -tieOff; x < W + 30; x += 30) {
        ctx.fillRect(x, railY1 - 6, 14, railY2 - railY1 + 12);
      }

      // 2 thanh ray thép sáng
      [railY1, railY2].forEach(ry => {
        const g = ctx.createLinearGradient(0, ry - 2, 0, ry + 2);
        g.addColorStop(0, '#94a3b8');
        g.addColorStop(0.5, '#e2e8f0');
        g.addColorStop(1, '#64748b');
        ctx.fillStyle = g;
        ctx.fillRect(0, ry - 1.5, W, 3);
      });

      animRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // ── Suy ra toa (carriage) client-side: chia đều 4 toa theo hàng ghế ─────────
  const { toas } = useMemo(() => {
    const parse = sn => {
      const m = String(sn || '').match(/^(\d+)([A-Za-z])$/);
      return m ? { row: +m[1], col: m[2].toUpperCase() } : null;
    };
    const items = seats
      .map(s => { const p = parse(s.seatNumber); return p ? { ...s, ...p } : null; })
      .filter(Boolean);
    const rowList = [...new Set(items.map(i => i.row))].sort((a, b) => a - b);
    if (rowList.length === 0) return { toas: [], classTypes: [] };

    const rowsPerToa = Math.max(1, Math.ceil(rowList.length / NUM_TOAS));
    const minRow = rowList[0];
    const groups = Array.from({ length: NUM_TOAS }, () => []);
    items.forEach(it => {
      const idx = Math.min(NUM_TOAS - 1, Math.floor((it.row - minRow) / rowsPerToa));
      groups[idx].push(it);
    });

    const toaList = groups
      .map((list, idx) => {
        const available = list.filter(s => !s.booked && !isSeatLockedByOthers(s, user)).length;
        const types = [...new Set(list.map(s => s.seatType || 'ECONOMY'))];
        const isBiz = types.length > 0 && types.every(t => ['BUSINESS', 'VIP', 'SLEEPER'].includes(t));
        const isMixed = types.length > 1;
        const hasSleeper = types.includes('SLEEPER');
        return { 
          idx, 
          seats: list, 
          total: list.length, 
          available, 
          types,
          isBiz, 
          isMixed,
          hasSleeper 
        };
      })
      .filter(t => t.total > 0);

    return { toas: toaList };
  }, [seats, isSeatLockedByOthers, user]);

  // ── Sơ đồ ghế của toa đang mở ───────────────────────────────────────────────
  const active = toas[activeToa] || null;

  const { leftCols, rightCols, toaRows, smap } = useMemo(() => {
    if (!active) return { leftCols: [], rightCols: [], toaRows: [], smap: new Map() };
    const filtered = selectedSeatClass
      ? active.seats.filter(s => (s.seatType || 'ECONOMY') === selectedSeatClass)
      : active.seats;
    const cols = [...new Set(filtered.map(s => s.col))].sort();
    const rows = [...new Set(filtered.map(s => s.row))].sort((a, b) => a - b);
    const map = new Map(filtered.map(s => [`${s.row}${s.col}`, s]));
    const half = Math.ceil(cols.length / 2);
    return { leftCols: cols.slice(0, half), rightCols: cols.slice(half), toaRows: rows, smap: map };
  }, [active, selectedSeatClass]);

  const openToa = (idx) => {
    setActiveToa(idx);
    setPhase('zooming');
    setTimeout(() => setPhase('interior'), 520);
  };

  const handleSeatClick = (seat) => {
    setRippleSeatId(seat.id);
    setTimeout(() => setRippleSeatId(null), 500);
    onToggleSeat(seat);
  };

  // Tự scale đoàn tàu vừa độ rộng khung — thay cho cuộn ngang
  useEffect(() => {
    const measure = () => {
      const wrap = wrapRef.current;
      const tr = trainRef.current;
      if (!wrap || !tr) return;
      const avail = wrap.clientWidth - 24;
      const natural = tr.offsetWidth; // transform không đổi metrics layout
      if (natural > 0) setFitScale(Math.min(1, avail / natural));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [toas.length, phase]);

  // ── Nút ghế / giường nằm trong toa ──────────────────────────────────────────
  function renderSeatBtn(s) {
    const sel    = selectedSeatIds.includes(s.id);
    const locked = isSeatLockedByOthers(s, user);
    const isBiz  = ['BUSINESS', 'VIP'].includes(s.seatType);
    const isSleeper = s.seatType === 'SLEEPER';
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
    } else if (isBiz || isSleeper) {
      bg = 'linear-gradient(180deg,#6366f1,#3730a3)';
      color = '#e0e7ff';
      border = '1.5px solid #818cf8';
      shadow = '0 2px 8px rgba(99,102,241,0.25)';
    }

    const berthUpper = s.row % 2 === 0; // suy tầng giường: hàng chẵn TRÊN / lẻ DƯỚI

    return (
      <div key={s.id} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => handleSeatClick(s)}
          disabled={!canSelectSeats(isAuthenticated, user) || s.booked || locked || (!sel && isMaxReached)}
          aria-label={`${t.smSeatLabel.replace('{seat}', s.seatNumber)}, ${isSleeper ? t.smSleeper : isBiz ? t.seatClassBiz : t.seatClassEco}, ${s.booked ? t.smBooked : locked ? t.smHeld : t.smVacant}`}
          onMouseEnter={() => setHoveredSeat(s)}
          onMouseLeave={() => setHoveredSeat(null)}
          style={{
            width: isSleeper ? 52 : 46,
            height: isSleeper ? 76 : (isBiz ? 50 : 42),
            borderRadius: isSleeper ? 8 : '10px 10px 5px 5px',
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
          {isSleeper && <span style={{ position: 'absolute', top: 3, left: 3, fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 4, background: 'rgba(255,255,255,0.18)' }}>{berthUpper ? t.smUpper : t.smLower}</span>}
          <span style={{ lineHeight: 1 }}>{s.booked ? '✕' : locked ? '🔒' : isSleeper ? '🛏' : s.seatNumber}</span>
          {(isBiz || isSleeper) && !s.booked && !locked && <span style={{ fontSize: 8, opacity: 0.85, fontWeight: 700 }}>{isSleeper ? t.smLie : 'VIP'}</span>}
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
            <div style={{ opacity: 0.75 }}>{isSleeper ? t.smSleeperBerth.replace('{berth}', berthUpper ? t.smBerthUpper : t.smBerthLower) : isBiz ? t.smBizClass : t.smEcoClass}</div>
          </div>
        )}
      </div>
    );
  }

  const wheel = (delay = 0) => (
    <span style={{
      width: 13, height: 13, borderRadius: '50%',
      background: 'conic-gradient(#0f172a 0 25%, #334155 0 50%, #0f172a 0 75%, #334155 0)',
      border: '2px solid #0b1220',
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
        @keyframes trainRock { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-2px) rotate(0.3deg); } }
        @keyframes wheelSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes headPulse { 0%,100% { opacity: 0.7; box-shadow: 0 0 8px 2px rgba(253,224,71,0.7); } 50% { opacity: 1; box-shadow: 0 0 16px 5px rgba(253,224,71,0.95); } }
      `}</style>

      {/* ── Cảnh đoàn tàu (Exterior) — giữ luôn mounted trong DOM, ẩn bằng CSS
           để không phá RAF loop vẽ canvas (fix bug quay lại không hiện cảnh) ── */}
      <div style={{
        display: phase === 'interior' ? 'none' : 'block',
        position: 'relative',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 10px 40px rgba(0,0,0,0.42)',
        border: '1px solid var(--border-main)',
      }}>
          <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: `${CANVAS_H}px` }} />

          {/* Đoàn tàu DOM trên ray — đầu máy BÊN PHẢI hướng phải, số toa đánh
              ngược từ đầu máy, tự scale vừa khung (không cuộn chuột) */}
          <div ref={wrapRef} style={{
            position: 'absolute',
            left: 0, right: 0,
            bottom: 24,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-end',
            overflow: 'hidden',
            pointerEvents: 'none',
          }}>
            <div ref={trainRef} style={{
              display: 'flex',
              alignItems: 'flex-end',
              transform: `scale(${fitScale})`,
              transformOrigin: 'bottom center',
              pointerEvents: 'auto',
            }}>

              {/* Các toa — phong cách Shinkansen: thân trắng, dải cửa sổ liền
                  mạch, sọc indigo + chỉ đỏ, gầm kín khí động học */}
              {[...toas].reverse().map(toa => (
                <div key={toa.idx} style={{ display: 'flex', alignItems: 'flex-end', flexShrink: 0 }}>

                  {/* Thân toa: sạch, KHÔNG nhãn — thông tin chỉ hiện khi hover */}
                  <div
                    role="button"
                    aria-label={t.smOpenCarriageMap.replace('{index}', toa.idx + 1)}
                    onClick={() => openToa(toas.indexOf(toa))}
                    onMouseEnter={(e) => {
                      setHoveredToa(toa.idx);
                      const r = e.currentTarget.getBoundingClientRect();
                      setTooltipPos({ x: r.left + r.width / 2, y: r.top });
                    }}
                    onMouseLeave={() => { setHoveredToa(null); setTooltipPos(null); }}
                    style={{
                      position: 'relative',
                      width: 170, height: 94,
                      flexShrink: 0,
                      borderRadius: '14px 14px 10px 10px',
                      background: 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 60%, #dbe3ec 100%)',
                      border: `2px solid ${hoveredToa === toa.idx ? '#6366f1' : 'rgba(100,116,139,0.4)'}`,
                      boxShadow: hoveredToa === toa.idx
                        ? '0 0 22px rgba(99,102,241,0.55)'
                        : '0 8px 18px rgba(0,0,0,0.45)',
                      cursor: 'pointer',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                    }}
                  >
                    {/* Lớp rung sway bên trong — element click giữ tĩnh để ổn định hit-target */}
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', animation: 'trainRock 1.7s ease-in-out infinite', animationDelay: `${toa.idx * 0.14}s` }}>
                    {/* Nóc mượt + 2 cụm máy lạnh phẳng */}
                    <div style={{ position: 'absolute', top: 3, left: 12, right: 12, height: 3, background: 'rgba(148,163,184,0.55)', borderRadius: 2 }} />
                    <div style={{ position: 'absolute', top: -5, left: 30, width: 34, height: 7, background: '#cbd5e1', borderRadius: '4px 4px 0 0' }} />
                    <div style={{ position: 'absolute', top: -5, right: 30, width: 34, height: 7, background: '#cbd5e1', borderRadius: '4px 4px 0 0' }} />

                    {/* Dải cửa sổ liền mạch có nan chia (né 2 cửa đầu toa) */}
                    <div style={{
                      position: 'absolute', left: 26, right: 28, top: 24, height: 17,
                      borderRadius: 8,
                      overflow: 'hidden',
                      border: '1.5px solid rgba(15,23,42,0.35)',
                      background: toa.available > 0
                        ? 'linear-gradient(180deg, #3b82f6 0%, #1e3a8a 70%)'
                        : 'linear-gradient(180deg, #64748b 0%, #334155 70%)',
                    }}>
                      <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg, transparent 0 22px, rgba(241,245,249,0.9) 22px 25px)' }} />
                      <div style={{ position: 'absolute', top: 1, left: 2, right: 2, height: 5, background: 'rgba(255,255,255,0.25)', borderRadius: 4 }} />
                    </div>

                    {/* Sọc indigo dọc thân + chỉ đỏ nhấn (livery Shinkansen) */}
                    <div style={{ position: 'absolute', left: 0, right: 0, top: 46, height: 9, background: 'linear-gradient(90deg, #3730a3, #4f46e5 55%, #3730a3)' }} />
                    <div style={{ position: 'absolute', left: 0, right: 0, top: 57, height: 3, background: '#dc2626' }} />

                    {/* Cửa 2 đầu toa */}
                    {[8, 146].map((x, ci) => (
                      <div key={ci} style={{
                        position: 'absolute', left: x, top: 24, width: 14, height: 42,
                        background: 'linear-gradient(180deg, #e2e8f0, #cbd5e1)',
                        borderRadius: '4px 4px 2px 2px',
                        boxShadow: 'inset 0 0 0 1px rgba(100,116,139,0.4)',
                      }}>
                        <span style={{ display: 'block', width: 6, height: 18, background: '#1e3a8a', borderRadius: 2, margin: '6px auto 0' }} />
                      </div>
                    ))}

                    {/* Tên hãng trên chỗ trống thân toa */}
                    <div style={{ position: 'absolute', left: 0, right: 0, top: 62, textAlign: 'center', fontSize: 9, fontWeight: 800, color: '#475569', letterSpacing: 1.5 }}>
                      VIGOTRIP
                    </div>

                    {/* Gầm kín khí động học + bánh xe */}
                    <div style={{ position: 'absolute', left: 3, right: 3, bottom: 3, height: 14, background: 'linear-gradient(180deg, #475569, #1e293b)', borderRadius: '3px 3px 6px 6px' }} />
                    <div style={{ position: 'absolute', bottom: -11, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', padding: '0 26px' }}>
                      {wheel(toa.idx * 0.1)}{wheel(toa.idx * 0.1 + 0.05)}
                    </div>
                    </div>{/* /lớp rung sway */}
                  </div>

                  {/* Lan can nối liền mạch giữa các toa (kiểu gangway Shinkansen) */}
                  <div style={{
                    width: 10, height: 64, marginBottom: 12, flexShrink: 0,
                    background: 'repeating-linear-gradient(90deg, #334155 0 2px, #1e293b 2px 4px)',
                    borderRadius: 2,
                  }} />
                </div>
              ))}

              {/* Đầu tàu Shinkansen bên PHẢI — mũi nhọn dài khí động học hướng phải */}
              <div style={{
                position: 'relative',
                width: 235, height: 96,
                flexShrink: 0,
                borderRadius: '14px 105px 105px 14px',
                background: 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 55%, #dce4ee 100%)',
                border: '2px solid rgba(100,116,139,0.4)',
                boxShadow: '0 10px 24px rgba(0,0,0,0.5)',
                cursor: 'default',
              }}>
                <div style={{ position: 'absolute', inset: 0, animation: 'trainRock 1.7s ease-in-out infinite', pointerEvents: 'none' }}>
                {/* Giàn pantograph trên nóc (chi tiết đặc trưng Shinkansen) */}
                <div style={{ position: 'absolute', top: -14, left: 58, width: 2, height: 14, background: '#475569', transform: 'rotate(18deg)' }} />
                <div style={{ position: 'absolute', top: -14, left: 72, width: 2, height: 14, background: '#475569', transform: 'rotate(-18deg)' }} />
                <div style={{ position: 'absolute', top: -15, left: 56, width: 22, height: 2.5, background: '#334155', borderRadius: 1 }} />

                {/* Nóc mượt + cụm máy lạnh */}
                <div style={{ position: 'absolute', top: 3, left: 14, width: 100, height: 3, background: 'rgba(148,163,184,0.55)', borderRadius: 2 }} />
                <div style={{ position: 'absolute', top: -5, left: 110, width: 36, height: 7, background: '#cbd5e1', borderRadius: '4px 4px 0 0' }} />

                {/* Dải cửa sổ liền khối (lùi sau cửa tài xế, không đè lên cửa) + kính Cabin xếp theo sống mũi */}
                <div style={{
                  position: 'absolute', left: 44, top: 24, width: 74, height: 17,
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: '1.5px solid rgba(15,23,42,0.35)',
                  background: 'linear-gradient(180deg, #3b82f6 0%, #1e3a8a 70%)',
                }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg, transparent 0 22px, rgba(241,245,249,0.9) 22px 25px)' }} />
                </div>
                {/* Kính lái ôm sống mũi */}
                <div style={{
                  position: 'absolute', left: 122, top: 26, width: 38, height: 15,
                  background: 'linear-gradient(180deg, #0b1220 0%, #1e3a8a 75%)',
                  borderRadius: '4px 10px 10px 2px',
                  border: '1.5px solid rgba(148,197,255,0.5)',
                  transform: 'skewX(-24deg)',
                }} />

                {/* Sọc indigo dài suốt thân + chỉ đỏ nhấn */}
                <div style={{ position: 'absolute', left: 0, right: 58, top: 46, height: 9, background: 'linear-gradient(90deg, #3730a3, #4f46e5 55%, #3730a3)' }} />
                <div style={{ position: 'absolute', left: 0, right: 52, top: 57, height: 3, background: '#dc2626' }} />

                {/* Dải đèn LED pha mảnh sát mũi + chùm sáng */}
                <div style={{ position: 'absolute', right: 26, top: 40, width: 20, height: 5, borderRadius: 3, background: '#fde68a', boxShadow: '0 0 10px 3px rgba(253,230,138,0.75)', animation: 'headPulse 1.4s ease-in-out infinite' }} />
                <div style={{ position: 'absolute', right: -30, top: 32, width: 30, height: 24, background: 'linear-gradient(90deg, rgba(253,230,138,0.4), transparent)', clipPath: 'polygon(0 32%, 100% 0, 100% 100%, 0 68%)', pointerEvents: 'none' }} />

                {/* Cửa tài xế */}
                <div style={{
                  position: 'absolute', left: 24, top: 26, width: 13, height: 38,
                  background: 'linear-gradient(180deg, #e8edf4, #c3cedb)',
                  borderRadius: '6px 6px 2px 2px',
                  boxShadow: 'inset 0 0 0 1.5px rgba(100,116,139,0.4)',
                }}>
                  <span style={{ display: 'block', width: 5, height: 22, background: '#1e3a8a', borderRadius: 2, margin: '7px auto 0' }} />
                </div>

                {/* Tên hãng trên chỗ trống thân đầu tàu */}
                <div style={{ position: 'absolute', left: 0, width: 118, top: 64, textAlign: 'center', fontSize: 10, fontWeight: 800, color: '#475569', letterSpacing: 2 }}>
                  VIGOTRIP
                </div>

                {/* Gầm kín khí động học + bánh xe */}
                <div style={{ position: 'absolute', left: 4, right: 44, bottom: 3, height: 14, background: 'linear-gradient(180deg, #475569, #1e293b)', borderRadius: '3px 3px 6px 6px' }} />
                <div style={{ position: 'absolute', bottom: -11, left: 0, right: 0, display: 'flex', justifyContent: 'flex-start', padding: '0 0 0 18px', gap: 46 }}>
                  {wheel(0)}{wheel(0.08)}{wheel(0.16)}
                </div>
                </div>{/* /lớp rung sway */}
              </div>
            </div>
          </div>

          {/* Zoom / transition overlay */}
          {phase === 'zooming' && (
            <div style={{
              position: 'absolute',
              inset: 0,
              zIndex: 10,
              background: 'radial-gradient(circle at center, rgba(99,102,241,0.4) 0%, rgba(2,6,23,0.96) 75%)',
              animation: 'fadeZoom 0.52s cubic-bezier(0.22, 1, 0.36, 1) forwards',
              pointerEvents: 'none',
            }} />
          )}
      </div>

      {/* Hint — đặt DƯỚI canvas để không che đoàn tàu */}
      {phase === 'train' && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
          <button
            type="button"
            onClick={() => openToa(0)}
            style={{
              background: 'rgba(15,23,42,0.85)',
              backdropFilter: 'blur(10px)',
              color: '#f8fafc',
              fontSize: 12,
              fontWeight: 700,
              padding: '8px 24px',
              borderRadius: 24,
              border: '1px solid rgba(99,102,241,0.35)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#818cf8';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(99,102,241,0.4)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.4)';
            }}
          >
            <span style={{ color: '#818cf8' }}>🚄</span> {t.smTrainHint}
          </button>
        </div>
      )}

      {/* Tooltip toa — portal ra body với position: fixed → KHÔNG BAO GIỜ bị
          canvas/scene/scale cắt */}
      {hoveredToa !== null && tooltipPos && (() => {
        const toa = toas.find(x => x.idx === hoveredToa);
        if (!toa) return null;
        const classLabel = toa.isMixed 
          ? (t.smMixedClass || 'Nhiều hạng')
          : toa.hasSleeper 
            ? t.smSleeper 
            : toa.isBiz 
              ? t.smBizClass 
              : t.smEcoClass;

        return createPortal(
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
            <div style={{ fontWeight: 800 }}>{t.smCarriage.replace('{index}', toa.idx + 1)} • {classLabel}</div>
            <div style={{ opacity: 0.85 }}>
              {t.smRemaining} <b style={{ color: toa.available > 0 ? '#34d399' : '#f87171' }}>{toa.available}</b>/{toa.total} {t.smVacantSeats}
            </div>
            {toa.isMixed && (
              <div style={{ opacity: 0.75, fontSize: 10, marginTop: 2, display: 'flex', gap: 6 }}>
                {toa.types.map(tp => (
                  <span key={tp} style={{ 
                    background: 'rgba(255,255,255,0.1)', 
                    padding: '1px 6px', 
                    borderRadius: 4,
                    color: tp === 'BUSINESS' ? '#818cf8' : tp === 'SLEEPER' ? '#a78bfa' : '#34d399'
                  }}>
                    {tp === 'BUSINESS' ? t.smBizClass : tp === 'SLEEPER' ? t.smSleeper : t.smEcoClass}
                  </span>
                ))}
              </div>
            )}
          </div>,
          document.body
        );
      })()}

      {/* ── Sơ đồ ghế trong toa (Interior) ── */}
      {phase === 'interior' && active && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'slideUp 0.45s cubic-bezier(0.16, 1, 0.3, 1)' }}>

          {/* Header: quay lại + filter + counter */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setPhase('train')}
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
              <span>←</span> {t.smBackToTrain}
            </button>

            <div style={{ width: 1, height: 24, background: 'var(--border-main)', margin: '0 4px' }} />

            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
              {t.smCarriage.replace('{index}', active.idx + 1)} — {t.smClassLabel}
            </span>
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
            {(() => {
              // Chip filter lấy theo hạng có thật trong toa đang mở
              const toaClassTypes = [...new Set(active.seats.map(s => s.seatType || 'ECONOMY'))];
              return toaClassTypes.map(cls => {
                const biz = ['BUSINESS', 'VIP', 'SLEEPER'].includes(cls);
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
                    {cls === 'SLEEPER' ? `🛏 ${t.smSleeper}` : cls === 'BUSINESS' || cls === 'VIP' ? `🔵 ${t.seatClassBiz}` : cls === 'ECONOMY' ? `🟢 ${t.seatClassEco}` : cls}
                  </button>
                );
              });
            })()}

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

          {/* Khung sơ đồ ghế theo kết cấu toa tàu */}
          <div style={{
            background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-main) 100%)',
            borderRadius: 24,
            border: '2px solid var(--border-main)',
            padding: '28px 16px 36px',
            boxShadow: '0 12px 36px rgba(0,0,0,0.2)',
            overflowX: 'auto',
          }}>
            {/* Đầu toa & cửa trước */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 22 }}>
              <div style={{
                width: 240,
                height: 64,
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
                  width: 96,
                  height: 18,
                  background: 'linear-gradient(180deg, #0f172a 0%, #1e3a8a 70%, #38bdf8 100%)',
                  borderRadius: '20px 20px 6px 6px',
                  border: '1px solid rgba(56,189,248,0.5)',
                  boxShadow: '0 0 10px rgba(56,189,248,0.25)',
                  marginBottom: 4,
                }} />
                <div style={{
                  fontSize: 11, fontWeight: 800, color: 'var(--text-main)',
                  letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: 6,
                  textTransform: 'uppercase',
                }}>
                  <span style={{ color: 'var(--primary)', fontSize: 13 }}>🚄</span> {t.smCarriage.replace('{index}', active.idx + 1)} • {t.smFrontDoor}
                </div>
              </div>
            </div>

            {/* Column headers (sticky) */}
            <div style={{
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
              <div style={{ width: 36 }} />
              {leftCols.map(c => <div key={c} style={{ width: 46, textAlign: 'center', fontWeight: 800, color: 'var(--primary)', fontSize: 13 }}>{c}</div>)}
              <div style={{ width: 44, textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>{t.smAisle}</div>
              {rightCols.map(c => <div key={c} style={{ width: 46, textAlign: 'center', fontWeight: 800, color: 'var(--primary)', fontSize: 13 }}>{c}</div>)}
            </div>

            {/* Seat rows */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {toaRows.map(row => {
                const rowIsBiz = [...leftCols, ...rightCols].some(col => {
                  const s = smap.get(`${row}${col}`);
                  return s && ['BUSINESS', 'VIP', 'SLEEPER'].includes(s.seatType);
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
                    {/* Lối đi giữa toa */}
                    <div style={{
                      width: 44,
                      minHeight: 42,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'repeating-linear-gradient(180deg,transparent,transparent 6px,rgba(148,163,184,0.1) 6px,rgba(148,163,184,0.1) 10px)',
                      borderRadius: 4,
                    }}>
                      <span style={{ fontSize: 15, lineHeight: 1, filter: 'opacity(0.22)' }}>🚄</span>
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

            {/* Cuối toa: WC & cửa kết nối */}
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
                <span>🚻</span> {t.smWcConnector}
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
                { label: `${t.seatClassBiz} / ${t.smSleeper}`, bg: 'linear-gradient(180deg,#6366f1,#3730a3)', bdr: '#4f46e5' },
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

export default TrainSeatMap;
