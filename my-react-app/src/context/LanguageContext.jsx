/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useContext, useEffect } from 'react';

const translations = {
  vi: {
    // Header
    app: "Ứng dụng",
    heroTitle: "Khám phá thế giới cùng VigoTrip",
    heroTagline: "Đặt vé máy bay, tàu hỏa, xe khách & tour du lịch với giá tốt nhất",
    search: "Tìm kiếm",
    support: "CSKH",
    login: "Đăng nhập/Đăng ký",
    checkInQR: "Quét vé (Check-in)",

    // Auth Modal
    authTitle: "Đăng nhập / Đăng ký",
    emailPlaceholder: "Vui lòng nhập địa chỉ email",
    continueWithEmail: "Tiếp tục với email",
    or: "Hoặc",
    loginWithGoogle: "Đăng nhập bằng Google",
    loginWithFacebook: "Đăng nhập với Facebook",
    loginWithApple: "Đăng nhập với Apple",
    qrText: "Sử dụng ứng dụng để",
    qrHighlight: "đăng nhập bằng mã QR",

    // Password Step
    createAccount: "Tạo Tài Khoản",
    setPassword: "Đặt mật khẩu cho tài khoản mới của bạn:",
    password: "Mật khẩu",
    passwordRequirement: "Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ cái, chữ số và ký hiệu",
    registerAndLogin: "Đăng ký và Đăng nhập",
    notYou: "Không phải bạn?",
    termsPrefix: "Bằng việc đăng nhập hoặc đăng ký, bạn được xem như đã đồng ý với",
    termsAndConditions: "Điều Kiện Và Điều Khoản",
    privacyPolicy: "Tuyên Bố Quyền Riêng Tự",
    of: "của",

    // Language
    selectLanguage: "Chọn ngôn ngữ",
    language: "Ngôn ngữ",

    // Errors
    emailRequired: "Vui lòng nhập địa chỉ email",
    emailInvalid: "Email phải là Gmail (có đuôi @gmail.com)",
    passwordRequired: "Vui lòng nhập mật khẩu",
    passwordInvalid: "Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ cái, chữ số và ký hiệu",
    registerSuccess: "Đăng ký tài khoản {email} thành công!",

    // Booking Tabs & Sidebar
    flight: "Vé máy bay",
    train: "Vé tàu hỏa",
    bus: "Xe khách",
    package: "Đặt theo gói",
    bookingContent: "Nội dung đặt vé cho:",

    // Flight Search
    roundTrip: "Khứ hồi",
    oneWay: "Một chiều",
    multiCity: "Nhiều thành phố",
    directFlight: "Bay thẳng",
    from: "Từ",
    to: "Đến",
    selectDeparture: "Chọn điểm đi",
    selectDestination: "Chọn điểm đến",
    departureDate: "Ngày đi",
    returnDate: "Ngày về",
    passengers: "Hành khách",
    adult: "Người lớn",
    child: "Trẻ em",
    infant: "Em bé",
    adultAge: "Người lớn (≥12 tuổi)",
    childAge: "Trẻ em (2-11 tuổi)",
    infantAge: "Em bé (<2 tuổi)",
    class: "Hạng vé",
    economy: "Phổ thông",
    premium: "Phổ thông đặc biệt",
    business: "Thương gia",
    first: "Hạng nhất",
    apply: "Áp dụng",
    anywhere: "Mọi nơi",
    addFlight: "Thêm chuyến bay khác",

    // Train Search
    departureStation: "Ga khởi hành",
    arrivalStation: "Ga đến",
    departureTime: "Thời gian khởi hành",
    returnTime: "Giờ về",
    addReturn: "Thêm chuyến về",
    onlyHighSpeed: "Chỉ tàu cao tốc",
    exploreHotel: "Khám phá khách sạn",
    all: "Tất cả",
    vip: "VIP",

    // City Selector - Tabs
    vietnam: "Việt Nam",
    taiwan: "Đài Loan",
    japan: "Nhật Bản",
    uk: "Anh",
    searchCity: "Tìm thành phố...",

    // Vietnam Cities
    hanoi: "Hà Nội",
    hcmc: "TP. Hồ Chí Minh",
    danang: "Đà Nẵng",

    // Taiwan Cities
    taipei: "Đài Bắc",
    kaohsiung: "Cao Hùng",
    taichung: "Đài Trung",

    // Japan Cities
    tokyo: "Tokyo",
    osaka: "Osaka",
    nagoya: "Nagoya",
    sapporo: "Sapporo",
    fukuoka: "Fukuoka",

    // UK Cities
    london: "Luân Đôn",
    manchester: "Manchester",
    edinburgh: "Edinburgh",
    birmingham: "Birmingham",

    // Footer
    contactUs: "Liên Hệ Với Chúng Tôi",
    customerCare: "Chăm Sóc Khách Hàng",
    serviceGuarantee: "Bảo Đảm Dịch Vụ",
    moreServiceInfo: "Xem thêm thông tin dịch vụ",
    aboutTrip: "Về VigoTrip",
    news: "Tin Tức",
    careers: "Tuyển dụng",
    termsConditions: "Điều Khoản & Điều Kiện",
    aboutGroup: "Giới Thiệu Về Tập Đoàn VigoTrip",
    otherServices: "Các Dịch Vụ Khác",
    investorRelations: "Quan Hệ Đầu Tư",
    tripRewards: "Phần Thưởng VigoTrip",
    affiliateProgram: "Chương trình đối tác liên kết",
    listProperty: "Đăng Cơ Sở Lưu Trú",
    security: "Bảo Mật",
    paymentMethods: "Phương thức thanh toán",
    ourPartners: "Đối Tác Của Chúng Tôi",
    copyright: "Bản quyền © 2025 VigoTrip Travel VietNam Pte. Ltd. Bảo lưu mọi quyền. Nhà điều hành trang: VigoTrip Travel VietNam Pte. Ltd.",


    // PACKAGE SEARCH (Uses shared keys: roundTrip, oneWay, from, to, search, apply, departureDate, returnDate)
    hotel: "Khách sạn",
    hotelDestination: "Điểm đến",
    checkin: "Nhận phòng",
    checkout: "Trả phòng",
    nights: "đêm",
    rooms: " Số phòng",

    // Search Forms
    selectAirport: "Chọn sân bay",
    selectBusStation: "Chọn bến xe",
    selectTrainStation: "Chọn ga tàu",
    swapDestinations: "Đổi điểm đi/đến",
    searching: "Đang tìm...",
    searchFlight: "Tìm chuyến bay",
    searchBus: "Tìm chuyến xe",
    searchTrain: "Tìm chuyến tàu",
    viewCheapCalendar: "Xem lịch giá rẻ",
    loadingCalendar: "Đang tải...",
    calendar30Days: "Lịch giá 30 ngày tới",
    noCheapFlights: "Hiện chưa có chuyến đi phù hợp trong khoảng ngày này. Bạn có thể bỏ chọn \"tìm vé rẻ nhất\" và dùng tìm kiếm thường, hoặc đổi điểm đi/điểm đến/ngày khác.",

    // Booking Steps
    step1Title: "Chọn ghế",
    step2Title: "Hành khách",
    step3Title: "Dịch vụ",
    step4Title: "Thanh toán",
    step1: "Bước 1: Chọn hạng vé & ghế ngồi",
    step2: "Bước 2: Thông tin hành khách",
    step3: "Bước 3: Dịch vụ bổ sung",
    step4: "Bước 4: Xác nhận & Thanh toán",
    seatClassAll: "Tất cả",
    seatClassEco: "Phổ thông",
    seatClassBiz: "Thương gia",
    bookingSummary: "Thông tin đặt chỗ",
    totalCost: "Tổng chi phí",
    paymentDetails: "Chi tiết thanh toán",
    paymentVNPAY: "Thanh toán qua VNPay",
    bookTicketNow: "Đặt vé ngay",
    goBack: "Quay lại",
    nextStep: "Tiếp theo",
    reviewAndPay: "Xem lại & Thanh toán",
    successBooking: "Đặt vé thành công!",
    promoCodeLabel: "Mã khuyến mãi / phiếu quà tặng",
    applyPromo: "Xác nhận",
    promoInstruction: "Nhập mã nếu có để được giảm giá.",
    passengerLastName: "Họ *",
    passengerFirstName: "Tên & tên đệm *",
    dob: "Ngày sinh *",
    nationality: "Quốc tịch",
    phoneNumber: "Số điện thoại *",
    emailField: "Email *",
    memberCode: "Mã hội viên (nếu có)",
    receivePromo: "Nhận thông tin khuyến mãi",
    rememberInfo: "Lưu thông tin cho lần sau",
    selectSeatInstruction: "Chọn hạng sau đó bấm vào ghế muốn ngồi.",
    passengerInstruction: "Nhập thông tin cá nhân của hành khách. Các ô có dấu * là bắt buộc.",
    extrasInstruction: "Tùy chọn thêm các dịch vụ để chuyến đi thoải mái hơn.",
    reviewInstruction: "Kiểm tra lại mọi thông tin trước khi hoàn tất.",
    baggage: "Hành lý",
    meal: "Suất ăn",
    insurance: "Bảo hiểm",
    airportTransfer: "Xe đưa đón",
    free: "Miễn phí",
    processing: "Đang xử lý...",

    // Extra Strings
    adminTrips: "Admin Trips",
    adminReviews: "Quản lý đánh giá",
    providerReviews: "Đánh giá",
    revenue: "Doanh thu",
    refunds: "Hoàn tiền",
    account: "Tài khoản",
    bookingHistory: "Lịch sử đặt vé",
    logout: "Đăng xuất",

    // My Bookings
    yourBookings: "Lịch sử đặt vé của bạn",
    noBookings: "Bạn chưa có chuyến đi nào. Hãy đặt vé ngay nhé!",
    status: "Trạng thái",
    paid: "Đã thanh toán",
    confirmed: "Đã xác nhận",
    completed: "Đã hoàn thành",
    cancelled: "Đã hủy",
    pendingPayment: "Chờ thanh toán",
    ticketCode: "Mã vé",
    bookedAt: "Đặt lúc",
    passengerList: "Danh sách hành khách",
    seat: "Ghế",
    passengerNameText: "Hành khách",
    ticketPrice: "Giá vé",
    cancelTicket: "Hủy vé",
    cancelTicketConfirmTitle: "Xác nhận hủy vé",
    cancelTicketConfirmDesc: "Bạn có chắc muốn hủy vé này? Giá vé sẽ được trừ khỏi tổng đơn hàng.",
    confirmComplete: "Bạn xác nhận chuyến đi này đã hoàn thành?",
    completeBookingBtn: "Hoàn thành",
    payNowBtn: "Thanh toán ngay",
    requestRefundBtn: "Yêu cầu hoàn tiền",
    submitReviewBtn: "Gửi Đánh Giá ⭐️",
    refundedAmount: "Được hoàn",
    noName: "Chưa có tên",

    // Refunds
    refundManagement: "Quản lý Yêu cầu Hoàn tiền",
    allFilter: "Tất cả",
    pendingFilter: "Chờ duyệt",
    approvedFilter: "Đã duyệt",
    rejectedFilter: "Từ chối",
    noRefunds: "Không có yêu cầu hoàn tiền nào.",
    refundRequest: "Yêu cầu hoàn tiền",
    refundReason: "Lý do yêu cầu",
    notePrefix: "Lưu ý",
    refundNote: "Yêu cầu hoàn tiền sẽ được nhà cung cấp xem xét và phản hồi. Bạn sẽ nhận được thông báo khi có kết quả.",
    cancelBtn: "Hủy",
    sendRefundRequest: "Gửi yêu cầu hoàn tiền",
    approveRefund: "✓ Duyệt",
    rejectRefund: "✕ Từ chối",
    providerNoteText: "Ghi chú",
    sentAt: "Gửi lúc",
    processedAt: "Xử lý lúc",
    rejectTitle: "Từ chối yêu cầu hoàn tiền",
    rejectReasonLabel: "Lý do từ chối (tùy chọn)",
    rejectConfirmBtn: "Xác nhận Từ chối",
    refundReasonLabel: "Lý do yêu cầu hoàn tiền",

    // Reviews
    rating: "Số sao",
    commentText: "Bình luận",
    searchPlaceholder: "Tìm kiếm theo hành trình, hãng, hoặc nội dung...",
    userCol: "Người dùng",
    providerCol: "Nhà cung cấp",
    journeyCol: "Hành trình",
    noReviews: "Không tìm thấy đánh giá.",
    selectRating: "Chọn số sao",
    reviewCommentOption: "Nhận xét (tùy chọn)",

    // Revenue
    revenueTitle: "Thống kê Doanh thu",
    totalRevenue: "Tổng Doanh thu",
    totalBookings: "Tổng số vé/booking",
    revenueByMonth: "Doanh thu theo Tháng",
    revenueByService: "Tỷ lệ Doanh thu theo Dịch vụ",
    revenueByDate: "Chi tiết Doanh thu theo Ngày",
    dateCol: "Ngày",
    revenueCol: "Doanh thu",
    aiInsights: "Nhận định & Dự báo AI",
    aiAnalyzing: "AI đang phân tích dữ liệu...",
    getAIInsights: "Phân tích AI",

    // Package
    favoriteTours: "Tour Yêu thích",



  },



  en: {
    // Header
    app: "App",
    heroTitle: "Explore the world with VigoTrip",
    heroTagline: "Book flights, trains, buses & tours at the best prices",
    search: "Search",
    support: "Support",
    login: "Login/Register",
    checkInQR: "Scan Ticket (Check-in)",

    // Auth Modal
    authTitle: "Login / Register",
    emailPlaceholder: "Please enter your email",
    continueWithEmail: "Continue with email",
    or: "Or",
    loginWithGoogle: "Login with Google",
    loginWithFacebook: "Login with Facebook",
    loginWithApple: "Login with Apple",
    qrText: "Use app to",
    qrHighlight: "login with QR code",

    // Password Step
    createAccount: "Create Account",
    setPassword: "Set password for your new account:",
    password: "Password",
    passwordRequirement: "Password must be at least 8 characters, including letters, numbers and symbols",
    registerAndLogin: "Register & Login",
    notYou: "Not you?",
    termsPrefix: "By logging in or registering, you agree to the",
    termsAndConditions: "Terms & Conditions",
    privacyPolicy: "Privacy Policy",
    of: "of",

    // Language
    selectLanguage: "Select language",
    language: "Language",

    // Errors
    emailRequired: "Please enter your email",
    emailInvalid: "Email must be Gmail (with @gmail.com)",
    passwordRequired: "Please enter password",
    passwordInvalid: "Password must be at least 8 characters, including letters, numbers and symbols",
    registerSuccess: "Account {email} registered successfully!",

    // Booking Tabs & Sidebar
    flight: "Flight Tickets",
    train: "Train Tickets",
    bus: "Bus Tickets",
    package: "Package Booking",
    bookingContent: "Booking content for:",

    // Flight Search
    roundTrip: "Round trip",
    oneWay: "One way",
    multiCity: "Multi-city",
    directFlight: "Direct flights only",
    from: "From",
    to: "To",
    selectDeparture: "Select departure",
    selectDestination: "Select destination",
    departureDate: "Departure",
    returnDate: "Return",
    passengers: "Passengers",
    adult: "Adult",
    child: "Child",
    infant: "Infant",
    adultAge: "Adults (≥12 years)",
    childAge: "Children (2-11 years)",
    infantAge: "Infants (<2 years)",
    class: "Class",
    economy: "Economy",
    premium: "Premium economy",
    business: "Business",
    first: "First class",
    apply: "Apply",
    flightHotel: "Flight + Hotel",
    anywhere: "Anywhere",
    addFlight: "Add another flight",

    // Train Search
    departureStation: "Departure station",
    arrivalStation: "Arrival station",
    departureTime: "Departure time",
    returnTime: "Return time",
    addReturn: "Add return",
    onlyHighSpeed: "High speed only",
    exploreHotel: "Explore hotels",
    all: "All",
    vip: "VIP",

    // City Selector - Tabs
    vietnam: "Vietnam",
    taiwan: "Taiwan",
    japan: "Japan",
    uk: "United Kingdom",
    searchCity: "Search city...",

    // Vietnam Cities
    hanoi: "Hanoi",
    hcmc: "Ho Chi Minh City",
    danang: "Da Nang",

    // Taiwan Cities
    taipei: "Taipei",
    kaohsiung: "Kaohsiung",
    taichung: "Taichung",

    // Japan Cities
    tokyo: "Tokyo",
    osaka: "Osaka",
    nagoya: "Nagoya",
    sapporo: "Sapporo",
    fukuoka: "Fukuoka",

    // UK Cities
    london: "London",
    manchester: "Manchester",
    edinburgh: "Edinburgh",
    birmingham: "Birmingham",

    // Footer
    contactUs: "Contact Us",
    customerCare: "Customer Care",
    serviceGuarantee: "Service Guarantee",
    moreServiceInfo: "More service information",
    aboutUs: "About VigoTrip",
    news: "News",
    careers: "Careers",
    termsConditions: "Terms & Conditions",
    aboutGroup: "About VigoTrip Group",
    otherServices: "Other Services",
    investorRelations: "Investor Relations",
    rewards: "VigoTrip Rewards",
    affiliateProgram: "Affiliate Program",
    listProperty: "List Your Property",
    security: "Security",
    paymentMethods: "Payment Methods",
    ourPartners: "Our Partners",
    copyright: "Copyright © 2025 VigoTrip Travel VietNam Pte. Ltd. All rights reserved. Operator: VigoTrip Travel VietNam Pte. Ltd.",

    // Package Search (Uses shared keys: search, apply, package, roundTrip, oneWay, from, to, departureDate, returnDate)
    hotel: "Hotel",
    hotelDestination: "Destination",
    checkin: "Check-in",
    checkout: "Check-out",
    nights: "nights",
    rooms: "rooms",

    // Search Forms
    selectAirport: "Select airport",
    selectBusStation: "Select bus station",
    selectTrainStation: "Select train station",
    swapDestinations: "Swap destinations",
    searching: "Searching...",
    searchFlight: "Find flights",
    searchBus: "Find buses",
    searchTrain: "Find trains",
    viewCheapCalendar: "View cheap calendar",
    loadingCalendar: "Loading...",
    calendar30Days: "30-day price calendar",
    noCheapFlights: "There are currently no suitable trips within these dates. You can uncheck \"find cheapest\" and use normal search, or change your origin/destination/dates.",

    // Booking Steps
    step1Title: "Select Seat",
    step2Title: "Passenger",
    step3Title: "Extras",
    step4Title: "Payment",
    step1: "Step 1: Select class & seats",
    step2: "Step 2: Passenger information",
    step3: "Step 3: Additional services",
    step4: "Step 4: Review & Payment",
    seatClassAll: "All",
    seatClassEco: "Economy",
    seatClassBiz: "Business",
    bookingSummary: "Booking Summary",
    totalCost: "Total Cost",
    paymentDetails: "Payment Details",
    paymentVNPAY: "Pay via VNPay",
    bookTicketNow: "Book Ticket",
    goBack: "Go Back",
    nextStep: "Next",
    reviewAndPay: "Review & Pay",
    successBooking: "Booking Successful!",
    promoCodeLabel: "Promo Code / Gift Voucher",
    applyPromo: "Apply",
    promoInstruction: "Enter a code if you have one.",
    passengerLastName: "Last Name *",
    passengerFirstName: "First & Middle Name *",
    dob: "Date of Birth *",
    nationality: "Nationality",
    phoneNumber: "Phone Number *",
    emailField: "Email *",
    memberCode: "Member Code (Optional)",
    receivePromo: "Receive promotional offers",
    rememberInfo: "Remember info for next time",
    selectSeatInstruction: "Select class and click on your desired seat.",
    passengerInstruction: "Enter passenger details. Fields with * are required.",
    extrasInstruction: "Add optional services for a more comfortable trip.",
    reviewInstruction: "Please review all details before completing payment.",
    baggage: "Baggage",
    meal: "Meals",
    insurance: "Insurance",
    airportTransfer: "Transfer",
    free: "Free",
    processing: "Processing...",

    // Extra Strings
    adminTrips: "Admin Trips",
    adminReviews: "Admin Reviews",
    providerReviews: "Provider Reviews",
    revenue: "Revenue",
    refunds: "Refunds",
    account: "Account",
    bookingHistory: "Booking History",
    logout: "Logout",

    // My Bookings
    yourBookings: "Your Bookings",
    noBookings: "You have no trips yet. Book a ticket now!",
    status: "Status",
    paid: "Paid",
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
    pendingPayment: "Pending Payment",
    ticketCode: "Ticket Code",
    bookedAt: "Booked At",
    passengerList: "Passenger List",
    seat: "Seat",
    passengerNameText: "Passenger",
    ticketPrice: "Ticket Price",
    cancelTicket: "Cancel Ticket",
    cancelTicketConfirmTitle: "Confirm Cancellation",
    cancelTicketConfirmDesc: "Are you sure you want to cancel this ticket? The ticket price will be deducted from the total order.",
    confirmComplete: "Do you confirm this trip is completed?",
    completeBookingBtn: "Complete",
    payNowBtn: "Pay Now",
    requestRefundBtn: "Request Refund",
    submitReviewBtn: "Submit Review ⭐️",
    refundedAmount: "Refunded",
    noName: "No Name",

    // Refunds
    refundManagement: "Refund Requests Management",
    allFilter: "All",
    pendingFilter: "Pending",
    approvedFilter: "Approved",
    rejectedFilter: "Rejected",
    noRefunds: "No refund requests found.",
    refundRequest: "Refund Request",
    refundReason: "Reason for request",
    notePrefix: "Note",
    refundNote: "Your refund request will be reviewed by the provider. You will be notified of the result.",
    cancelBtn: "Cancel",
    sendRefundRequest: "Send Refund Request",
    approveRefund: "✓ Approve",
    rejectRefund: "✕ Reject",
    providerNoteText: "Provider Note",
    sentAt: "Sent At",
    processedAt: "Processed At",
    rejectTitle: "Reject Refund Request",
    rejectReasonLabel: "Reject reason (optional)",
    rejectConfirmBtn: "Confirm Reject",
    refundReasonLabel: "Reason for refund request",

    // Reviews
    rating: "Rating",
    commentText: "Comment",
    searchPlaceholder: "Search by journey, provider, or content...",
    userCol: "User",
    providerCol: "Provider",
    journeyCol: "Journey",
    noReviews: "No reviews found.",
    selectRating: "Select rating",
    reviewCommentOption: "Comment (optional)",

    // Revenue
    revenueTitle: "Revenue Statistics",
    totalRevenue: "Total Revenue",
    totalBookings: "Total Bookings",
    revenueByMonth: "Revenue by Month",
    revenueByService: "Revenue by Service",
    revenueByDate: "Revenue Details by Date",
    dateCol: "Date",
    revenueCol: "Revenue",
    aiInsights: "AI Insights & Forecasting",
    aiAnalyzing: "AI is analyzing data...",
    getAIInsights: "AI Analysis",

    // Package
    favoriteTours: "Favorite Tours",


  },




  ja: {
    // Header
    app: "アプリ",
    heroTitle: "Datxe.comで世界を探索しよう",
    heroTagline: "航空券、列車、バス、ツアーを最安値で予約",
    search: "検索",
    support: "サポート",
    login: "ログイン/登録",
    checkInQR: "チケットスキャン",

    // Auth Modal
    authTitle: "ログイン / 登録",
    emailPlaceholder: "メールアドレスを入力してください",
    continueWithEmail: "メールで続ける",
    or: "または",
    loginWithGoogle: "Googleでログイン",
    loginWithFacebook: "Facebookでログイン",
    loginWithApple: "Appleでログイン",
    qrText: "アプリを使用して",
    qrHighlight: "QRコードでログイン",

    // Password Step
    createAccount: "アカウント作成",
    setPassword: "新しいアカウントのパスワードを設定:",
    password: "パスワード",
    passwordRequirement: "パスワードは8文字以上で、文字、数字、記号を含む必要があります",
    registerAndLogin: "登録してログイン",
    notYou: "違う方ですか？",
    termsPrefix: "ログインまたは登録により、",
    termsAndConditions: "利用規約",
    privacyPolicy: "プライバシーポリシー",
    of: "に同意したものとみなされます",

    // Language
    selectLanguage: "言語を選択",
    language: "言語",

    // Errors
    emailRequired: "メールアドレスを入力してください",
    emailInvalid: "メールはGmail（@gmail.com）である必要があります",
    passwordRequired: "パスワードを入力してください",
    passwordInvalid: "パスワードは8文字以上で、文字、数字、記号を含む必要があります",
    registerSuccess: "アカウント {email} が正常に登録されました",

    // Booking Tabs & Sidebar
    flight: "航空券",
    train: "鉄道チケット",
    bus: "バスチケット",
    package: "パッケージ予約",
    bookingContent: "予約内容:",

    // Flight Search
    roundTrip: "往復",
    oneWay: "片道",
    multiCity: "複数の都市",
    directFlight: "直行便のみ",
    from: "出発",
    to: "到着",
    selectDeparture: "出発地を選択",
    selectDestination: "到着地を選択",
    departureDate: "出発日",
    returnDate: "帰国日",
    passengers: "乗客",
    adult: "大人",
    child: "子供",
    infant: "幼児",
    adultAge: "大人 (12歳以上)",
    childAge: "子供 (2-11歳)",
    infantAge: "幼児 (2歳未満)",
    class: "クラス",
    economy: "エコノミー",
    premium: "プレミアムエコノミー",
    business: "ビジネス",
    first: "ファースト",
    apply: "適用",
    flightHotel: "飛行機 + ホテル",
    anywhere: "どこでも",
    addFlight: "別のフライトを追加",

    // Train Search
    departureStation: "出発駅",
    arrivalStation: "到着駅",
    departureTime: "出発時間",
    returnTime: "帰着時間",
    addReturn: "帰りを追加",
    onlyHighSpeed: "高速のみ",
    exploreHotel: "ホテルを探す",
    all: "すべて",
    vip: "VIP",

    // City Selector - Tabs
    vietnam: "ベトナム",
    taiwan: "台湾",
    japan: "日本",
    uk: "イギリス",
    searchCity: "都市を検索...",

    // Vietnam Cities
    hanoi: "ハノイ",
    hcmc: "ホーチミン",
    danang: "ダナン",

    // Taiwan Cities
    taipei: "台北",
    kaohsiung: "高雄",
    taichung: "台中",

    // Japan Cities
    tokyo: "東京",
    osaka: "大阪",
    nagoya: "名古屋",
    sapporo: "札幌",
    fukuoka: "福岡",

    // UK Cities
    london: "ロンドン",
    manchester: "マンチェスター",
    edinburgh: "エディンバラ",
    birmingham: "バーミンガム",

    // Footer
    contactUs: "お問い合わせ",
    customerCare: "カスタマーケア",
    serviceGuarantee: "サービス保証",
    moreServiceInfo: "サービス詳細",
    aboutUs: "Datxe.comについて",
    news: "ニュース",
    careers: "採用情報",
    termsConditions: "利用規約",
    aboutGroup: "Datxe.comグループについて",
    otherServices: "その他のサービス",
    investorRelations: "投資家情報",
    rewards: "Datxe.com特典",
    affiliateProgram: "アフィリエイトプログラム",
    listProperty: "宿泊施設を登録",
    security: "セキュリティ",
    paymentMethods: "お支払い方法",
    ourPartners: "パートナー",
    copyright: "著作権 © 2025 Datxe.com Travel VietNam Pte. Ltd. 全著作権所有。運営会社: Datxe.com Travel VietNam Pte. Ltd.",

    // Package Search (Shared keys: search, apply, package, roundTrip, oneWay, from, to, departureDate, returnDate)
    hotel: "ホテル",
    hotelDestination: "目的地",
    checkin: "チェックイン",
    checkout: "チェックアウト",
    nights: "泊",
    rooms: "部屋",

    // Search Forms
    selectAirport: "空港を選択",
    selectBusStation: "バスターミナルを選択",
    selectTrainStation: "駅を選択",
    swapDestinations: "出発地/到着地を入れ替える",
    searching: "検索中...",
    searchFlight: "航空券を検索",
    searchBus: "バスを検索",
    searchTrain: "列車を検索",
    viewCheapCalendar: "格安カレンダー",
    loadingCalendar: "読み込み中...",
    calendar30Days: "30日間の価格カレンダー",
    noCheapFlights: "現在、これらの日付に適した旅行はありません。「最安値を検索」のチェックを外して通常の検索を使用するか、出発地/到着地/日付を変更できます。",

    // Booking Steps
    step1Title: "座席選択",
    step2Title: "乗客",
    step3Title: "追加サービス",
    step4Title: "支払い",
    step1: "ステップ1: クラスと座席の選択",
    step2: "ステップ2: 乗客情報",
    step3: "ステップ3: 追加サービス",
    step4: "ステップ4: 確認と支払い",
    seatClassAll: "すべて",
    seatClassEco: "エコノミー",
    seatClassBiz: "ビジネス",
    bookingSummary: "予約の概要",
    totalCost: "合計費用",
    paymentDetails: "支払いの詳細",
    paymentVNPAY: "VNPayで支払う",
    bookTicketNow: "今すぐ予約する",
    goBack: "戻る",
    nextStep: "次へ",
    reviewAndPay: "確認して支払う",
    successBooking: "予約が成功しました！",
    promoCodeLabel: "プロモコード / ギフト券",
    applyPromo: "適用",
    promoInstruction: "お持ちのコードを入力してください。",
    passengerLastName: "姓 *",
    passengerFirstName: "名 *",
    dob: "生年月日 *",
    nationality: "国籍",
    phoneNumber: "電話番号 *",
    emailField: "メールアドレス *",
    memberCode: "会員番号 (任意)",
    receivePromo: "プロモーション情報を受け取る",
    rememberInfo: "情報を保存する",
    selectSeatInstruction: "クラスを選択し、希望する座席をクリックしてください。",
    passengerInstruction: "乗客の情報を入力してください。*が付いている項目は必須です。",
    extrasInstruction: "オプションサービスを追加して、快適な旅行をお楽しみください。",
    reviewInstruction: "支払い手続きの前に、すべての詳細を確認してください。",
    baggage: "手荷物",
    meal: "お食事",
    insurance: "保険",
    airportTransfer: "送迎",
    free: "無料",
    processing: "処理中...",

    // Extra Strings
    adminTrips: "管理トリップ",
    adminReviews: "管理レビュー",
    providerReviews: "レビュー (プロバイダー)",
    revenue: "収益",
    refunds: "払い戻し",
    account: "アカウント",
    bookingHistory: "予約履歴",
    logout: "ログアウト",

    // My Bookings
    yourBookings: "予約履歴",
    noBookings: "まだ旅行がありません。今すぐ予約しましょう！",
    status: "ステータス",
    paid: "支払い済み",
    confirmed: "確認済み",
    completed: "完了",
    cancelled: "キャンセル",
    pendingPayment: "支払い待ち",
    ticketCode: "チケットコード",
    bookedAt: "予約日",
    passengerList: "乗客リスト",
    seat: "座席",
    passengerNameText: "乗客",
    ticketPrice: "チケット価格",
    cancelTicket: "チケットをキャンセル",
    cancelTicketConfirmTitle: "キャンセルの確認",
    cancelTicketConfirmDesc: "このチケットをキャンセルしてもよろしいですか？チケット価格は合計金額から差し引かれます。",
    confirmComplete: "この旅行が完了したことを確認しますか？",
    completeBookingBtn: "完了",
    payNowBtn: "今すぐ支払う",
    requestRefundBtn: "払い戻しをリクエスト",
    submitReviewBtn: "レビューを送信 ⭐️",
    refundedAmount: "払い戻し額",
    noName: "名前なし",

    // Refunds
    refundManagement: "払い戻しリクエスト管理",
    allFilter: "すべて",
    pendingFilter: "保留中",
    approvedFilter: "承認済み",
    rejectedFilter: "拒否済み",
    noRefunds: "払い戻しリクエストはありません。",
    refundRequest: "払い戻しリクエスト",
    refundReason: "リクエストの理由",
    notePrefix: "注意",
    refundNote: "払い戻しリクエストはプロバイダーによって審査されます。結果が通知されます。",
    cancelBtn: "キャンセル",
    sendRefundRequest: "払い戻しリクエストを送信",
    approveRefund: "✓ 承認",
    rejectRefund: "✕ 拒否",
    providerNoteText: "プロバイダーのメモ",
    sentAt: "送信日時",
    processedAt: "処理日時",
    rejectTitle: "払い戻しリクエストを拒否",
    rejectReasonLabel: "拒否の理由（オプション）",
    rejectConfirmBtn: "拒否を確認",
    refundReasonLabel: "払い戻しリクエストの理由",

    // Reviews
    rating: "評価",
    commentText: "コメント",
    searchPlaceholder: "旅行、プロバイダー、または内容で検索...",
    userCol: "ユーザー",
    providerCol: "プロバイダー",
    journeyCol: "旅行",
    noReviews: "レビューが見つかりません。",
    selectRating: "評価を選択する",
    reviewCommentOption: "コメント（オプション）",

    // Revenue
    revenueTitle: "収益統計",
    totalRevenue: "総収益",
    totalBookings: "総予約数",
    revenueByMonth: "月別収益",
    revenueByService: "サービス別収益",
    revenueByDate: "日別収益詳細",
    dateCol: "日付",
    revenueCol: "収益",

    // Package
    favoriteTours: "お気に入りツアー",

  },



  zh: {
    // Header
    app: "應用程式",
    heroTitle: "与 Datxe.com 一起探索世界",
    heroTagline: "以最优惠的价格预订机票、火车、巴士和旅游",
    search: "搜尋",
    support: "客服",
    login: "登录/注册",
    checkInQR: "扫描门票",

    // Auth Modal
    authTitle: "登入 / 註冊",
    emailPlaceholder: "請輸入電子郵件",
    continueWithEmail: "繼續使用電子郵件",
    or: "或",
    loginWithGoogle: "使用Google登入",
    loginWithFacebook: "使用Facebook登入",
    loginWithApple: "使用Apple登入",
    qrText: "使用應用程式",
    qrHighlight: "使用QR碼登入",

    // Password Step
    createAccount: "創建帳戶",
    setPassword: "為您的新帳戶設置密碼：",
    password: "密碼",
    passwordRequirement: "密碼必須至少8個字符，包含字母、數字和符號",
    registerAndLogin: "註冊並登入",
    notYou: "不是您嗎？",
    termsPrefix: "通過登入或註冊，您被視為已同意",
    termsAndConditions: "條款與條件",
    privacyPolicy: "隱私權政策",
    of: "的",

    // Language
    selectLanguage: "選擇語言",
    language: "語言",

    // Errors
    emailRequired: "請輸入電子郵件",
    emailInvalid: "電子郵件必須是Gmail（帶@gmail.com）",
    passwordRequired: "請輸入密碼",
    passwordInvalid: "密碼必須至少8個字符，包含字母、數字和符號",
    registerSuccess: "帳戶 {email} 註冊成功！",

    // Booking Tabs & Sidebar
    flight: "機票",
    train: "火車票",
    bus: "巴士票",
    package: "套裝預訂",
    bookingContent: "預訂內容:",

    // Flight Search
    roundTrip: "往返",
    oneWay: "單程",
    multiCity: "多個城市",
    directFlight: "僅限直飛",
    from: "出發地",
    to: "目的地",
    selectDeparture: "選擇出發地",
    selectDestination: "選擇目的地",
    departureDate: "出發日期",
    returnDate: "回程日期",
    passengers: "乘客",
    adult: "成人",
    child: "兒童",
    infant: "嬰兒",
    adultAge: "成人 (12歲以上)",
    childAge: "兒童 (2-11歲)",
    infantAge: "嬰兒 (2歲以下)",
    class: "艙等",
    economy: "經濟艙",
    premium: "豪華經濟艙",
    business: "商務艙",
    first: "頭等艙",
    apply: "套用",
    flightHotel: "機票 + 酒店",
    anywhere: "任何地方",
    addFlight: "添加其他航班",

    // Train Search
    departureStation: "出發站",
    arrivalStation: "到達站",
    departureTime: "出發時間",
    returnTime: "回程時間",
    addReturn: "添加回程",
    onlyHighSpeed: "僅高速",
    exploreHotel: "探索酒店",
    all: "全部",
    vip: "VIP",

    // City Selector - Tabs
    vietnam: "越南",
    taiwan: "台灣",
    japan: "日本",
    uk: "英國",
    searchCity: "搜尋城市...",

    // Vietnam Cities
    hanoi: "河內",
    hcmc: "胡志明市",
    danang: "峴港",

    // Taiwan Cities
    taipei: "台北",
    kaohsiung: "高雄",
    taichung: "台中",

    // Japan Cities
    tokyo: "東京",
    osaka: "大阪",
    nagoya: "名古屋",
    sapporo: "札幌",
    fukuoka: "福岡",

    // UK Cities
    london: "倫敦",
    manchester: "曼徹斯特",
    edinburgh: "愛丁堡",
    birmingham: "伯明翰",

    // Footer
    contactUs: "聯繫我們",
    customerCare: "客戶服務",
    serviceGuarantee: "服務保證",
    moreServiceInfo: "更多服務信息",
    aboutUs: "關於Datxe.com",
    news: "新聞",
    careers: "招聘",
    termsConditions: "條款與條件",
    aboutGroup: "關於Datxe.com集團",
    otherServices: "其他服務",
    investorRelations: "投資者關係",
    rewards: "Datxe.com獎勵",
    affiliateProgram: "聯盟計畫",
    listProperty: "註冊住宿",
    security: "安全",
    paymentMethods: "付款方式",
    ourPartners: "合作夥伴",
    copyright: "版權所有 © 2025 Datxe.com Travel VietNam Pte. Ltd. 保留所有權利。運營商：Datxe.com Travel VietNam Pte. Ltd.",


    //Package Search (Shared keys: search, apply, package, roundTrip, oneWay, from, to, departureDate, returnDate)
    hotel: "酒店",
    hotelDestination: "目的地",
    checkin: "入住",
    checkout: "退房",
    nights: "晚",
    rooms: "房間",

    // Search Forms
    selectAirport: "选择机场",
    selectBusStation: "选择巴士站",
    selectTrainStation: "选择火车站",
    swapDestinations: "交换出发地/目的地",
    searching: "搜寻中...",
    searchFlight: "查找航班",
    searchBus: "查找巴士",
    searchTrain: "查找火车",
    viewCheapCalendar: "查看特价日历",
    loadingCalendar: "载入中...",
    calendar30Days: "30天价格日历",
    noCheapFlights: "目前在这些日期内没有合适的行程。您可以取消选中“查找最便宜”，然后使用普通搜索，或者更改您的出发地/目的地/日期。",

    // Booking Steps
    step1Title: "选择座位",
    step2Title: "乘客",
    step3Title: "附加服务",
    step4Title: "支付",
    step1: "第一步：选择舱位与座位",
    step2: "第二步：乘客信息",
    step3: "第三步：附加服务",
    step4: "第四步：确认并付款",
    seatClassAll: "全部",
    seatClassEco: "经济舱",
    seatClassBiz: "商务舱",
    bookingSummary: "预订详情",
    totalCost: "总费用",
    paymentDetails: "付款明细",
    paymentVNPAY: "通过VNPay付款",
    bookTicketNow: "立即预订机票",
    goBack: "返回",
    nextStep: "下一步",
    reviewAndPay: "确认并付款",
    successBooking: "预订成功！",
    promoCodeLabel: "优惠码 / 礼品券",
    applyPromo: "确认",
    promoInstruction: "如果您有优惠码，请在此输入。",
    passengerLastName: "姓 *",
    passengerFirstName: "名 *",
    dob: "出生日期 *",
    nationality: "国籍",
    phoneNumber: "电话号码 *",
    emailField: "电子邮件 *",
    memberCode: "会员号 (选填)",
    receivePromo: "接收促销信息",
    rememberInfo: "保存信息供下次使用",
    selectSeatInstruction: "选择舱位后点击所需座位。",
    passengerInstruction: "输入乘客个人信息。带有 * 的为必填项。",
    extrasInstruction: "选择附加服务，让旅行更舒适。",
    reviewInstruction: "完成前请再次检查所有信息。",
    baggage: "行李",
    meal: "餐点",
    insurance: "保险",
    airportTransfer: "接机服务",
    free: "免费",
    processing: "正在处理...",

    // Extra Strings
    adminTrips: "管理行程",
    adminReviews: "管理評論",
    providerReviews: "評論 (提供商)",
    revenue: "收入",
    refunds: "退款",
    account: "帳戶",
    bookingHistory: "預訂歷史",
    logout: "登出",

    // My Bookings
    yourBookings: "您的預訂",
    noBookings: "您還沒有行程。現在就預訂門票吧！",
    status: "狀態",
    paid: "已付款",
    confirmed: "已確認",
    completed: "已完成",
    cancelled: "已取消",
    pendingPayment: "待付款",
    ticketCode: "票券代碼",
    bookedAt: "預訂於",
    passengerList: "乘客名單",
    seat: "座位",
    passengerNameText: "乘客",
    ticketPrice: "票價",
    cancelTicket: "取消票券",
    cancelTicketConfirmTitle: "確認取消",
    cancelTicketConfirmDesc: "您確定要取消此票券嗎？票價將從總訂單中扣除。",
    confirmComplete: "您確認此行程已完成嗎？",
    completeBookingBtn: "完成",
    payNowBtn: "立即付款",
    requestRefundBtn: "請求退款",
    submitReviewBtn: "提交評論 ⭐️",
    refundedAmount: "已退款",
    noName: "無名",

    // Refunds
    refundManagement: "退款請求管理",
    allFilter: "全部",
    pendingFilter: "待處理",
    approvedFilter: "已批准",
    rejectedFilter: "已拒絕",
    noRefunds: "未找到退款請求。",
    refundRequest: "退款請求",
    refundReason: "請求原因",
    notePrefix: "注意",
    refundNote: "您的退款請求將由提供商審查。您將收到結果通知。",
    cancelBtn: "取消",
    sendRefundRequest: "發送退款請求",
    approveRefund: "✓ 批准",
    rejectRefund: "✕ 拒絕",
    providerNoteText: "提供商備註",
    sentAt: "發送時間",
    processedAt: "處理時間",
    rejectTitle: "拒絕退款請求",
    rejectReasonLabel: "拒絕原因 (可選)",
    rejectConfirmBtn: "確認拒絕",
    refundReasonLabel: "退款請求原因",

    // Reviews
    rating: "評分",
    commentText: "評論",
    searchPlaceholder: "按旅程、提供商或內容搜索...",
    userCol: "用戶",
    providerCol: "提供商",
    journeyCol: "旅程",
    noReviews: "未找到評論。",
    selectRating: "選擇評分",
    reviewCommentOption: "評論 (可選)",

    // Revenue
    revenueTitle: "收入統計",
    totalRevenue: "總收入",
    totalBookings: "總預訂數",
    revenueByMonth: "按月收入",
    revenueByService: "按服務收入",
    revenueByDate: "按日期收入明細",
    dateCol: "日期",
    revenueCol: "收入",

    // Package
    favoriteTours: "收藏的行程",
  }


};

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    try {
      const savedLanguage = localStorage.getItem("language");
      if (savedLanguage) {
        return JSON.parse(savedLanguage);
      }
    } catch {
      // Ignore parse error
    }
    return { code: 'vi', name: 'Tiếng Việt', flag: null };
  });

  const t = React.useMemo(() => {
    return translations[currentLanguage.code] || translations.vi;
  }, [currentLanguage.code]);

  useEffect(() => {
    document.documentElement.lang = currentLanguage.code;
  }, [currentLanguage.code]);

  const changeLanguage = React.useCallback((language) => {
    setCurrentLanguage(language);
    localStorage.setItem("language", JSON.stringify(language));
    document.documentElement.lang = language.code;
    globalThis.dispatchEvent(new CustomEvent('languageChange', { detail: { language: language.code } }));
  }, []);

  const value = React.useMemo(
    () => ({ currentLanguage, t, changeLanguage, translations }),
    [currentLanguage, t, changeLanguage]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};