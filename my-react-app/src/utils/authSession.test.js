import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Bộ chặn xác thực là thứ đứng giữa "access token sống 15 phút" và "người dùng bị văng ra
 * màn hình đăng nhập bốn lần một giờ". Nó chạy ngầm với mọi request nên khi hỏng thì hỏng
 * ở khắp nơi và không ở đâu cụ thể cả — vì vậy mấy luật bên dưới cần được ghim lại.
 *
 * Module chụp lại window.fetch ngay lúc nạp, nên mỗi test phải dựng bản giả TRƯỚC rồi mới
 * import (vi.resetModules + import động).
 */

const jsonResponse = (status, body) => ({
  ok: status < 400,
  status,
  json: async () => body,
});

const SESSION = { token: "token-moi", email: "a@b.c", fullName: "A", role: "ROLE_USER" };

/** Dựng môi trường: fetch giả + module nạp lại từ đầu. */
async function loadModule(handler) {
  const fetchMock = vi.fn(handler);
  window.fetch = fetchMock;
  vi.resetModules();
  const mod = await import("./authSession.js");
  return { mod, fetchMock };
}

describe("authSession — bộ chặn xác thực", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("gắn access token mới nhất vào request tới API nội bộ", async () => {
    const { mod, fetchMock } = await loadModule(async () => jsonResponse(200, { ok: true }));
    mod.setAccessToken("token-hien-tai");
    const uninstall = mod.installAuthInterceptors({ onRefreshed: () => {}, onSessionLost: () => {} });

    // Nơi gọi KHÔNG tự đặt header — đây là điều mà 68 chỗ gọi trong dự án không cần biết.
    await window.fetch("/api/bookings");

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer token-hien-tai");
    uninstall();
  });

  it("ghi đè header Authorization mà nơi gọi tự đặt bằng token mới nhất", async () => {
    // Đây là lớp bảo vệ cho một lỗi rất dễ mắc: component chụp token lúc render rồi ghép
    // vào header; sau một vòng làm mới, biến đó đã cũ nhưng request vẫn đang dùng nó.
    const { mod, fetchMock } = await loadModule(async () => jsonResponse(200, { ok: true }));
    mod.setAccessToken("token-moi-nhat");
    const uninstall = mod.installAuthInterceptors({ onRefreshed: () => {}, onSessionLost: () => {} });

    await window.fetch("/api/bookings", { headers: { Authorization: "Bearer token-cu-ky" } });

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer token-moi-nhat");
    uninstall();
  });

  it("gặp 401 thì tự làm mới rồi gửi lại đúng một lần, người dùng không thấy gì", async () => {
    const seen = [];
    const { mod, fetchMock } = await loadModule(async (input, init) => {
      const url = String(input);
      seen.push(url);
      if (url.includes("/api/auth/refresh")) return jsonResponse(200, SESSION);
      // Lần đầu 401, lần sau (đã có token mới) thì 200.
      if (init?.headers?.Authorization === `Bearer ${SESSION.token}`) return jsonResponse(200, { data: 1 });
      return jsonResponse(401, { message: "het han" });
    });

    mod.setAccessToken("token-het-han");
    const onRefreshed = vi.fn();
    const onSessionLost = vi.fn();
    const uninstall = mod.installAuthInterceptors({ onRefreshed, onSessionLost });

    const res = await window.fetch("/api/bookings");

    expect(res.status).toBe(200);
    expect(seen).toEqual(["/api/bookings", "/api/auth/refresh", "/api/bookings"]);
    expect(onRefreshed).toHaveBeenCalledWith(expect.objectContaining({ token: SESSION.token }));
    expect(onSessionLost).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    uninstall();
  });

  it("làm mới thất bại thì báo mất phiên đúng một lần, không thử lại vô tận", async () => {
    const { mod } = await loadModule(async (input) => {
      if (String(input).includes("/api/auth/refresh")) return jsonResponse(401, {});
      return jsonResponse(401, {});
    });

    mod.setAccessToken("token-da-bi-thu-hoi");
    const onSessionLost = vi.fn();
    const uninstall = mod.installAuthInterceptors({ onRefreshed: () => {}, onSessionLost });

    const res = await window.fetch("/api/bookings");

    expect(res.status).toBe(401);
    expect(onSessionLost).toHaveBeenCalledTimes(1);
    uninstall();
  });

  it("gộp các lần làm mới trùng nhau thành MỘT request", async () => {
    // Luật quan trọng nhất file này. Refresh token xoay vòng: ba lần gọi song song nghĩa là
    // hai lần sau cầm token đã chết, máy chủ coi là dấu hiệu bị đánh cắp và thu hồi cả phiên.
    // Người dùng bị đăng xuất chỉ vì mở ba tab.
    let refreshCalls = 0;
    const { mod } = await loadModule(async (input) => {
      if (String(input).includes("/api/auth/refresh")) {
        refreshCalls += 1;
        await new Promise((r) => setTimeout(r, 10));
        return jsonResponse(200, SESSION);
      }
      return jsonResponse(200, {});
    });

    const results = await Promise.all([
      mod.refreshAccessToken(),
      mod.refreshAccessToken(),
      mod.refreshAccessToken(),
    ]);

    expect(refreshCalls).toBe(1);
    results.forEach((r) => expect(r.token).toBe(SESSION.token));
    expect(mod.getAccessToken()).toBe(SESSION.token);
  });

  it("401 từ /api/auth/* KHÔNG kích hoạt vòng làm mới", async () => {
    // Sai mật khẩu cũng là 401. Coi nó là "phiên hỏng" thì mỗi lần gõ nhầm mật khẩu lại kéo
    // theo một lượt /refresh vô nghĩa — và nếu chính /refresh cũng nằm trong diện này thì
    // đó là đệ quy vô tận đúng vào lúc phiên đang hỏng.
    const seen = [];
    const { mod } = await loadModule(async (input) => {
      seen.push(String(input));
      return jsonResponse(401, { message: "sai mat khau" });
    });

    mod.setAccessToken("token-van-con-tot");
    const onSessionLost = vi.fn();
    const uninstall = mod.installAuthInterceptors({ onRefreshed: () => {}, onSessionLost });

    await window.fetch("/api/auth/login", { method: "POST" });

    expect(seen).toEqual(["/api/auth/login"]);
    expect(onSessionLost).not.toHaveBeenCalled();
    uninstall();
  });

  it("không đụng tới request ra ngoài hệ thống", async () => {
    const { mod, fetchMock } = await loadModule(async () => jsonResponse(200, {}));
    mod.setAccessToken("token-bi-mat");
    const uninstall = mod.installAuthInterceptors({ onRefreshed: () => {}, onSessionLost: () => {} });

    // Gắn token của hệ thống vào request tới bên thứ ba là rò rỉ thẳng bí mật ra ngoài.
    await window.fetch("https://accounts.google.com/o/oauth2/token");

    expect(fetchMock.mock.calls[0][1]).toBeUndefined();
    uninstall();
  });

  it("gỡ bộ chặn thì trả window.fetch về nguyên trạng", async () => {
    const { mod, fetchMock } = await loadModule(async () => jsonResponse(200, {}));
    const uninstall = mod.installAuthInterceptors({ onRefreshed: () => {}, onSessionLost: () => {} });
    expect(window.fetch).not.toBe(fetchMock);
    uninstall();
    expect(window.fetch).toBe(fetchMock);
  });

  it("đọc được hạn của access token để hẹn giờ làm mới trước", async () => {
    const { mod } = await loadModule(async () => jsonResponse(200, {}));
    const exp = Math.floor(Date.now() / 1000) + 900;
    const fakeJwt = `a.${btoa(JSON.stringify({ exp })).replace(/=+$/, "")}.c`;

    expect(mod.readTokenExpiryMs(fakeJwt)).toBe(exp * 1000);
    // Token rác không được làm vỡ luồng — chỉ mất phần hẹn giờ, vòng bắt 401 vẫn còn đó.
    expect(mod.readTokenExpiryMs("khong-phai-jwt")).toBeNull();
    expect(mod.readTokenExpiryMs(null)).toBeNull();
  });
});
