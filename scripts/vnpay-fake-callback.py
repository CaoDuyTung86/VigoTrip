#!/usr/bin/env python3
"""Dựng một callback VNPay có chữ ký hợp lệ để thử luồng thanh toán trên máy local.

Vì sao cần: hai endpoint Return và IPN chỉ tin vào chữ ký HMAC-SHA512 tính bằng
hash-secret, nên chỉ cần biết hash-secret là gọi thẳng được, không phải mở trình duyệt,
không phải bấm qua trang của cổng, và không phải chờ cổng gọi ngược về máy local (điều
vốn không xảy ra được nếu không dựng tunnel).

Dùng để thử NHÁNH XỬ LÝ CALLBACK. Nó không thay thế được một lần đi thật qua sandbox:
chữ ký ở đây do chính script ký, nên nó không chứng minh được là mình đang ghép đúng
chuỗi hash với cổng thật.

Ví dụ:

    # IPN báo thanh toán thành công cho booking 1 (IPN trả JSON RspCode, dễ đọc kết quả)
    python scripts/vnpay-fake-callback.py --booking 1 --amount 250000

    # Khách bấm huỷ ở cổng
    python scripts/vnpay-fake-callback.py --booking 1 --amount 250000 --code 24

    # Thử nhánh Return (trả về redirect 302)
    python scripts/vnpay-fake-callback.py --booking 1 --amount 250000 --endpoint return

Hash-secret lấy theo thứ tự: --secret > biến môi trường VNP_HASH_SECRET > giá trị mặc
định của profile local trong application-local.yml.
"""

import argparse
import hashlib
import hmac
import os
import urllib.parse
import urllib.request
from datetime import datetime

LOCAL_PROFILE_SECRET = "local-dev-vnpay-key"


def build_query(params):
    """Ghép query string đúng cách VNPayUtil.buildQueryString làm.

    Ba chi tiết bắt buộc phải khớp, sai một cái là chữ ký không bao giờ hợp lệ:
    sắp xếp theo key, bỏ qua value rỗng, và encode khoảng trắng thành %20 chứ không phải '+'.
    """
    parts = []
    for key in sorted(params):
        value = params[key]
        if value is None or value == "":
            continue
        parts.append(
            urllib.parse.quote(str(key), safe="")
            + "="
            + urllib.parse.quote(str(value), safe="")
        )
    return "&".join(parts)


def sign(secret, data):
    return hmac.new(secret.encode(), data.encode(), hashlib.sha512).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--booking", required=True, help="ID booking cần báo kết quả")
    parser.add_argument("--amount", required=True, type=int, help="Số tiền đơn hàng, đơn vị VND")
    parser.add_argument("--code", default="00", help="vnp_ResponseCode (00 = thành công, 24 = khách huỷ)")
    parser.add_argument("--txn-ref", default=None, help="vnp_TxnRef; mặc định sinh theo thời gian")
    parser.add_argument("--endpoint", choices=["ipn", "return"], default="ipn")
    # 8099 = cong cua profile "local" (xem application-local.yml). Doi compose thi 8081.
    parser.add_argument("--base-url", default="http://localhost:8099")
    parser.add_argument("--secret", default=None)
    args = parser.parse_args()

    secret = args.secret or os.environ.get("VNP_HASH_SECRET") or LOCAL_PROFILE_SECRET
    now = datetime.now().strftime("%Y%m%d%H%M%S")
    txn_ref = args.txn_ref or ("LOCAL" + now)

    params = {
        "vnp_Amount": str(args.amount * 100),  # cổng không dùng phần thập phân, luôn nhân 100
        "vnp_BankCode": "NCB",
        "vnp_OrderInfo": "Thanh_toan_booking_" + str(args.booking),
        "vnp_PayDate": now,
        "vnp_ResponseCode": args.code,
        "vnp_TmnCode": os.environ.get("VNP_TMN_CODE", "LOCAL_DEV_TMN"),
        "vnp_TransactionNo": "14" + now[-8:],
        "vnp_TransactionStatus": "00" if args.code == "00" else "02",
        "vnp_TxnRef": txn_ref,
    }

    query = build_query(params)
    url = "{}/api/payment/vnpay-{}?{}&vnp_SecureHash={}".format(
        args.base_url.rstrip("/"), args.endpoint, query, sign(secret, query)
    )

    print("txnRef :", txn_ref)
    print("GET    :", url[:120] + ("..." if len(url) > 120 else ""))
    request = urllib.request.Request(url, method="GET")
    try:
        # Return trả 302; không tự đi theo redirect để nhìn thấy đúng URL cổng đẩy khách về.
        opener = urllib.request.build_opener(NoRedirect())
        with opener.open(request) as response:
            print("status :", response.status)
            print("body   :", response.read().decode("utf-8", "replace")[:400])
    except urllib.error.HTTPError as e:
        print("status :", e.code)
        if e.code == 302:
            print("location:", e.headers.get("Location"))
        else:
            print("body   :", e.read().decode("utf-8", "replace")[:400])


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


if __name__ == "__main__":
    main()
