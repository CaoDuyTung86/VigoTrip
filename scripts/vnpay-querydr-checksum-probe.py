#!/usr/bin/env python3
"""Dò công thức nối chuỗi ký của PHẢN HỒI querydr, hoàn toàn offline.

Vì sao cần: cảnh báo "Chữ ký phản hồi querydr không khớp" đang bắn ở mọi giao dịch
(docs/THANH_TOAN_VNPAY.md §5.3). Thứ tự 14 trường mà `VNPayQueryService` đang dùng sai ở
đâu đó, và đây là chỗ duy nhất trong lớp ấy không hồi quy được bằng unit test: phải có một
phản hồi thật từ cổng mới biết đúng sai. Script này thử hàng trăm cách nối trên MỘT phản hồi
đã bắt được, nên không cần thêm giao dịch thật nào nữa.

Lấy nguyên liệu ở đâu: khi checksum lệch, `logChecksumEvidence` in ra log Render ba thứ —
chuỗi ta dựng, **body JSON thô**, và hai chữ ký. Chỉ cần body thô là đủ, vì `vnp_SecureHash`
nằm sẵn trong đó. Bảng `nhat_ky_thanh_toan` KHÔNG dùng được: `redactSignatures` đã bôi chữ ký
trước khi ghi, có chủ đích.

    export VNP_HASH_SECRET='...'          # khoá đang hiệu lực LÚC phản hồi đó được ký
    python scripts/vnpay-querydr-checksum-probe.py phan-hoi.json

Khoá phải đúng thế hệ: một phản hồi bắt được TRƯỚC lần xoay khoá chỉ khớp với khoá cũ.
Bắt lộn thế hệ thì mọi ứng viên đều trượt và script không nói được gì.

Đọc `vnp_ResponseCode` trước khi kết luận. Khác "00" thì phản hồi vốn đã thiếu trường, và
checksum lệch chỉ là hệ quả — không phải lỗi thứ tự. Script sẽ tự cảnh báo chuyện này.
"""

import hashlib
import hmac
import itertools
import json
import os
import sys
import urllib.parse

# Thứ tự VNPayQueryService đang dùng, đã đối chiếu với một phản hồi sandbox thật ngày
# 11/09/2026. Giữ hai bản sao khớp nhau: ở đây và ở RESPONSE_HASH_FIELDS bên Java.
DOCUMENTED = [
    "vnp_ResponseId", "vnp_Command", "vnp_ResponseCode", "vnp_Message",
    "vnp_TmnCode", "vnp_TxnRef", "vnp_Amount", "vnp_BankCode", "vnp_PayDate",
    "vnp_TransactionNo", "vnp_TransactionType", "vnp_TransactionStatus",
    "vnp_OrderInfo", "vnp_PromotionCode", "vnp_PromotionAmount",
]

OPTIONAL = ["vnp_BankCode", "vnp_PromotionCode", "vnp_PromotionAmount"]


def hmac512(secret, data):
    return hmac.new(secret.encode(), data.encode(), hashlib.sha512).hexdigest()


def text(body, field):
    """Đọc một trường y như JsonNode.asText() phía Java: thiếu hoặc null thì là chuỗi rỗng."""
    value = body.get(field)
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def pipe(body, fields):
    return "|".join(text(body, f) for f in fields)


def candidates(body):
    """Sinh các cách nối đáng ngờ, kèm tên để in ra khi trúng.

    Ba họ ứng viên, theo đúng thứ tự khả năng xảy ra:
      1. Thứ tự tài liệu, có/không các trường tuỳ chọn — cổng có thể bỏ hẳn trường vắng
         thay vì ký một chuỗi rỗng.
      2. Thứ tự các khoá đúng như body trả về, và thứ tự chữ cái.
      3. Sai một vị trí: bỏ đúng một trường, hoặc đảo đúng một cặp kề nhau. Đây là kiểu
         lỗi mà §5.3 mô tả, nên đáng thử hết.
    """
    present = [k for k in body.keys() if k != "vnp_SecureHash"]

    yield "thứ tự tài liệu (đang dùng)", pipe(body, DOCUMENTED)
    yield "thứ tự tài liệu, bỏ trường vắng mặt", pipe(body, [f for f in DOCUMENTED if f in body])
    for r in range(1, len(OPTIONAL) + 1):
        for combo in itertools.combinations(OPTIONAL, r):
            fields = [f for f in DOCUMENTED if f not in combo]
            yield "thứ tự tài liệu, bỏ " + ", ".join(combo), pipe(body, fields)

    yield "thứ tự khoá trong body", pipe(body, present)
    yield "thứ tự chữ cái", pipe(body, sorted(present))

    for name, fields in (("body", present), ("chữ cái", sorted(present))):
        pairs = ["%s=%s" % (f, text(body, f)) for f in fields]
        yield "key=value nối bằng &, thứ tự " + name, "&".join(pairs)
        encoded = ["%s=%s" % (f, urllib.parse.quote_plus(text(body, f)).replace("+", "%20"))
                   for f in fields if text(body, f)]
        yield "key=value đã encode, bỏ giá trị rỗng, thứ tự " + name, "&".join(encoded)

    # Trường cổng trả về mà danh sách tài liệu không có. Đây là nghi can số một khi body
    # chứa thứ ta chưa từng ký: không biết nó nằm ở vị trí nào trong chuỗi ký, nên thử hết.
    # Giữ nguyên các trường tài liệu vắng mặt dưới dạng chuỗi rỗng, vì cổng vẫn ký chúng.
    for extra in [k for k in present if k not in DOCUMENTED]:
        for i in range(len(DOCUMENTED) + 1):
            fields = DOCUMENTED[:i] + [extra] + DOCUMENTED[i:]
            label = "trước " + DOCUMENTED[i] if i < len(DOCUMENTED) else "ở cuối"
            yield "thứ tự tài liệu, chèn %s %s" % (extra, label), pipe(body, fields)

    for i, field in enumerate(DOCUMENTED):
        yield "thứ tự tài liệu, bỏ " + field, pipe(body, DOCUMENTED[:i] + DOCUMENTED[i + 1:])
    for i in range(len(DOCUMENTED) - 1):
        swapped = list(DOCUMENTED)
        swapped[i], swapped[i + 1] = swapped[i + 1], swapped[i]
        yield "đảo %s <-> %s" % (DOCUMENTED[i], DOCUMENTED[i + 1]), pipe(body, swapped)


def main():
    if len(sys.argv) != 2:
        sys.exit("Dùng: python scripts/vnpay-querydr-checksum-probe.py <file-body.json>")

    secret = os.environ.get("VNP_HASH_SECRET", "").strip()
    if not secret:
        sys.exit("Thiếu VNP_HASH_SECRET. Phải là khoá đang hiệu lực lúc phản hồi này được ký.")

    with open(sys.argv[1], encoding="utf-8") as handle:
        body = json.load(handle)

    provided = body.get("vnp_SecureHash", "")
    if not provided:
        sys.exit("Body không có vnp_SecureHash — không có gì để đối chiếu. Lấy body THÔ từ log Render.")

    response_code = text(body, "vnp_ResponseCode")
    if response_code != "00":
        print("CẢNH BÁO: vnp_ResponseCode=%s (khác 00). Phản hồi này vốn đã thiếu trường, "
              "checksum lệch chỉ là hệ quả. Nên dò trên một phản hồi mã 00.\n" % response_code)

    print("Trường có trong body: %s" % ", ".join(k for k in body if k != "vnp_SecureHash"))
    print("Chữ ký cổng gửi:      %s\n" % provided)

    tried = 0
    for name, data in candidates(body):
        tried += 1
        if hmac512(secret, data).lower() == provided.lower():
            print("TRÚNG sau %d ứng viên: %s" % (tried, name))
            print("Chuỗi ký: [%s]" % data)
            return 0

    print("Trượt cả %d ứng viên." % tried)
    print("Ba khả năng, theo thứ tự nên kiểm tra:")
    print("  1. Sai thế hệ khoá — phản hồi bắt trước lần xoay khoá cần khoá cũ.")
    print("  2. Cổng ký một trường mà body không trả về, nên không dựng lại được từ đây.")
    print("  3. Sai từ hai vị trí trở lên, ngoài tầm của họ ứng viên 'sai một vị trí'.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
