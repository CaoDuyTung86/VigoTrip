import React, { useState } from "react";
import axios from "axios";
import { useLanguage } from "../context/LanguageContext";
import Header from "../LayOut/Header";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import {
  MdFlight,
  MdHotel,
  MdRestaurant,
  MdAttractions,
  MdLocalOffer,
  MdFavorite,
  MdFavoriteBorder,
  MdArrowBack,
  MdShare,
  MdCalendarToday,
  MdPeople,
  MdCreditCard,
  MdCheckCircle,
  MdInfo
} from "react-icons/md";
import { FaStar, FaStarHalfAlt } from "react-icons/fa";
import { TbTrain, TbBus } from "react-icons/tb";
import { GiCommercialAirplane } from "react-icons/gi";

const basePackages = [
  {
    id: 1,
    type: "flight",
    price: 5990000,
    originalPrice: 7990000,
    discount: 25,
    rating: 4.8,
    reviewCount: 128,
    image: "https://images.unsplash.com/photo-1583417319070-4a69db38a482?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    airline: "Vietnam Airlines",
    availableDates: ["15/06/2026", "20/06/2026", "25/06/2026", "30/06/2026"],
  },
  {
    id: 2,
    type: "flight",
    price: 4590000,
    originalPrice: 5890000,
    discount: 22,
    rating: 4.7,
    reviewCount: 256,
    image: "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    airline: "Bamboo Airways",
    availableDates: ["10/06/2026", "15/06/2026", "20/06/2026", "25/06/2026"],
  },
  {
    id: 3,
    type: "flight",
    price: 3990000,
    originalPrice: 5490000,
    discount: 27,
    rating: 4.9,
    reviewCount: 189,
    image: "https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    airline: "Vietjet Air",
    availableDates: ["05/06/2026", "12/06/2026", "19/06/2026", "26/06/2026"],
  },
  {
    id: 4,
    type: "train",
    price: 3890000,
    originalPrice: 4890000,
    discount: 20,
    rating: 4.5,
    reviewCount: 87,
    image: "https://images.unsplash.com/photo-1474487548417-781cb71495f3?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    trainCompany: "Đường sắt Việt Nam",
    availableDates: ["01/06/2026", "05/06/2026", "10/06/2026", "15/06/2026"],
  },
  {
    id: 5,
    type: "train",
    price: 2790000,
    originalPrice: 3590000,
    discount: 22,
    rating: 4.6,
    reviewCount: 124,
    image: "/tour_hue_danang.png",
    trainCompany: "Đường sắt Việt Nam",
    availableDates: ["08/06/2026", "12/06/2026", "18/06/2026", "22/06/2026"],
  },
  {
    id: 6,
    type: "bus",
    price: 1890000,
    originalPrice: 2490000,
    discount: 24,
    rating: 4.8,
    reviewCount: 156,
    image: "/tour_san_may.png",
    busCompany: "Xe khách Sao Việt",
    availableDates: ["03/06/2026", "07/06/2026", "11/06/2026", "15/06/2026"],
  },
  {
    id: 7,
    type: "bus",
    price: 2290000,
    originalPrice: 2990000,
    discount: 23,
    rating: 4.7,
    reviewCount: 203,
    image: "/dalat_city.png",
    busCompany: "Phương Trang",
    availableDates: ["02/06/2026", "06/06/2026", "10/06/2026", "14/06/2026"],
  },
];

const packageTranslations = {
  vi: [
    {
      id: 1,
      title: "Hành trình khám phá miền Bắc",
      description: "Khám phá Hà Nội - Hạ Long - Sapa trong 5 ngày 4 đêm",
      shortDesc: "Hà Nội - Hạ Long - Sapa",
      departureCity: "TP. Hồ Chí Minh",
      destinationCity: "Hà Nội",
      duration: "5 ngày 4 đêm",
      hotel: "Khách sạn Daewoo Hà Nội",
      meals: ["4 bữa sáng", "2 bữa trưa", "1 bữa tối"],
      transport: "Máy bay + Xe du lịch",
      includes: [
        "Vé máy bay khứ hồi",
        "Khách sạn 4 sao (4 đêm)",
        "Xe đưa đón sân bay",
        "Bữa sáng hàng ngày",
        "Vé tham quan Hạ Long",
        "Hướng dẫn viên tiếng Việt"
      ],
      schedule: [
        "Ngày 1: Đón tại sân bay Nội Bài - Nhận phòng khách sạn - Tự do khám phá Hà Nội",
        "Ngày 2: Tham quan Hồ Gươm, Văn Miếu - Di chuyển Hạ Long",
        "Ngày 3: Du thuyền tham quan vịnh Hạ Long - Kayak - Lặn ngắm san hô",
        "Ngày 4: Di chuyển Sapa - Bản Cát Cát - Núi Hàm Rồng",
        "Ngày 5: Chợ phiên Sapa - Di chuyển về Hà Nội - Bay về"
      ]
    },
    {
      id: 2,
      title: "Kỳ nghỉ biển Đà Nẵng - Hội An",
      description: "Tận hưởng kỳ nghỉ tại Đà Nẵng và khám phá phố cổ Hội An",
      shortDesc: "Đà Nẵng - Hội An - Bà Nà",
      departureCity: "TP. Hồ Chí Minh",
      destinationCity: "Đà Nẵng",
      duration: "4 ngày 3 đêm",
      hotel: "Resort Furama Đà Nẵng",
      meals: ["3 bữa sáng", "2 bữa trưa", "2 bữa tối"],
      transport: "Máy bay + Xe du lịch",
      includes: [
        "Vé máy bay khứ hồi",
        "Resort 5 sao (3 đêm)",
        "Xe đưa đón sân bay",
        "Buffet sáng",
        "Vé Bà Nà Hills (Cáp treo)",
        "Vé tham quan Hội An"
      ],
      schedule: [
        "Ngày 1: Đón tại sân bay Đà Nẵng - Check-in resort - Tắm biển",
        "Ngày 2: Bà Nà Hills - Cầu Vàng - Vườn hoa Le Jardin",
        "Ngày 3: Tham quan Hội An - Chợ đêm - Thả hoa đăng",
        "Ngày 4: Tự do khám phá Đà Nẵng - Bay về"
      ]
    },
    {
      id: 3,
      title: "Tour du lịch Phú Quốc - Thiên đường biển đảo",
      description: "Khám phá hòn đảo ngọc Phú Quốc với những bãi biển tuyệt đẹp",
      shortDesc: "Phú Quốc - Grand World - Hòn Thơm",
      departureCity: "TP. Hồ Chí Minh",
      destinationCity: "Phú Quốc",
      duration: "4 ngày 3 đêm",
      hotel: "Novotel Phú Quốc Resort",
      meals: ["3 bữa sáng", "3 bữa trưa"],
      transport: "Máy bay + Xe du lịch + Cano",
      includes: [
        "Vé máy bay khứ hồi",
        "Resort 4 sao (3 đêm)",
        "Xe đưa đón sân bay",
        "Buffet sáng",
        "Vé Grand World",
        "Tour 3 đảo (Cáp treo Hòn Thơm)",
        "Bảo hiểm du lịch"
      ],
      schedule: [
        "Ngày 1: Đón tại sân bay Phú Quốc - Nhận phòng - Tắm biển",
        "Ngày 2: Tour 3 đảo: Hòn Mây Rút - Hòn Mây Rút In - Hòn Gầm Ghì",
        "Ngày 3: Grand World - Cáp treo Hòn Thơm - Aquatopia",
        "Ngày 4: Chợ đêm Phú Quốc - Mua sắm đặc sản - Bay về"
      ]
    },
    {
      id: 4,
      title: "Hành trình xuyên Việt bằng tàu hỏa",
      description: "Trải nghiệm hành trình xuyên Việt từ Bắc vào Nam trên những chuyến tàu",
      shortDesc: "Hà Nội - Huế - Đà Nẵng - Sài Gòn",
      departureCity: "Hà Nội",
      destinationCity: "TP. Hồ Chí Minh",
      duration: "4 ngày 3 đêm",
      seatClass: "Giường nằm khoang 4",
      meals: ["3 bữa sáng", "2 bữa trưa", "2 bữa tối"],
      transport: "Tàu hỏa + Xe du lịch",
      includes: [
        "Vé tàu giường nằm (khứ hồi)",
        "Khách sạn 3 sao (3 đêm)",
        "Xe đưa đón ga tàu",
        "Bữa sáng",
        "Vé tham quan các điểm dừng",
        "Hướng dẫn viên"
      ],
      schedule: [
        "Ngày 1: Lên tàu tại ga Hà Nội - Bắt đầu hành trình",
        "Ngày 2: Đến ga Huế - Tham quan Đại Nội, lăng tẩm",
        "Ngày 3: Di chuyển Đà Nẵng - Bà Nà Hills - Cầu Vàng",
        "Ngày 4: Tiếp tục hành trình vào Sài Gòn - Kết thúc tour"
      ]
    },
    {
      id: 5,
      title: "Tour Huế - Đà Nẵng bằng tàu hỏa",
      description: "Khám phá cố đô Huế và thành phố Đà Nẵng với trải nghiệm tàu hỏa ven biển",
      shortDesc: "Huế - Đà Nẵng - Hội An",
      departureCity: "Huế",
      destinationCity: "Đà Nẵng",
      duration: "4 ngày 3 đêm",
      seatClass: "Ghế ngồi mềm điều hòa",
      meals: ["3 bữa sáng", "1 bữa trưa"],
      transport: "Tàu hỏa + Xe du lịch",
      includes: [
        "Vé tàu Huế - Đà Nẵng",
        "Khách sạn 4 sao (3 đêm)",
        "Xe đưa đón",
        "Ăn sáng",
        "Vé tham quan",
        "Hướng dẫn viên"
      ],
      schedule: [
        "Ngày 1: Ga Huế - Nhận phòng - Tham quan Đại Nội",
        "Ngày 2: Lăng Minh Mạng, Tự Đức - Chùa Thiên Mụ",
        "Ngày 3: Di chuyển Đà Nẵng bằng tàu - Bán đảo Sơn Trà",
        "Ngày 4: Hội An - Phố cổ - Kết thúc tour"
      ]
    },
    {
      id: 6,
      title: "Tour săn mây Tà Xùa",
      description: "Chinh phục đỉnh Tà Xùa - thiên đường săn mây của Tây Bắc",
      shortDesc: "Hà Nội - Tà Xùa - Mộc Châu",
      departureCity: "Hà Nội",
      destinationCity: "Tà Xùa",
      duration: "3 ngày 2 đêm",
      busType: "Limousine giường nằm",
      meals: ["2 bữa sáng", "3 bữa chính"],
      transport: "Xe limousine + Xe ôm",
      includes: [
        "Xe giường nằm limousine khứ hồi",
        "Homestay (2 đêm)",
        "Các bữa ăn theo chương trình",
        "Vé tham quan",
        "Hướng dẫn viên",
        "Bảo hiểm du lịch"
      ],
      schedule: [
        "Ngày 1: Hà Nội - Mộc Châu - Thung lũng mận Nà Ka",
        "Ngày 2: Di chuyển Tà Xùa - Săn mây đỉnh Sống Lưng Khủng Long",
        "Ngày 3: Ngắm bình minh trên mây - Hà Nội"
      ]
    },
    {
      id: 7,
      title: "Du lịch Đà Lạt - Thành phố ngàn hoa",
      description: "Khám phá Đà Lạt mộng mơ với xe khách chất lượng cao",
      shortDesc: "Sài Gòn - Đà Lạt",
      departureCity: "TP. Hồ Chí Minh",
      destinationCity: "Đà Lạt",
      duration: "4 ngày 3 đêm",
      busType: "Giường nằm VIP 34 chỗ",
      meals: ["3 bữa sáng"],
      transport: "Xe khách + Xe du lịch",
      includes: [
        "Xe giường nằm khứ hồi",
        "Khách sạn trung tâm (3 đêm)",
        "Các bữa ăn sáng",
        "Vé tham quan các điểm",
        "Xe đưa đón tham quan"
      ],
      schedule: [
        "Ngày 1: Sài Gòn - Đà Lạt - Quảng trường Lâm Viên",
        "Ngày 2: Thiền viện Trúc Lâm - Thác Datanla - Ga Đà Lạt",
        "Ngày 3: Làng Cù Lần - Vườn dâu tây - Chợ đêm",
        "Ngày 4: Mua sắm đặc sản - Về Sài Gòn"
      ]
    }
  ],
  en: [
    {
      id: 1,
      title: "Northern Vietnam Discovery",
      description: "Explore Hanoi - Ha Long - Sapa in 5 days 4 nights",
      shortDesc: "Hanoi - Ha Long - Sapa",
      departureCity: "Ho Chi Minh City",
      destinationCity: "Hanoi",
      duration: "5 days 4 nights",
      hotel: "Daewoo Hotel Hanoi",
      meals: ["4 breakfasts", "2 lunches", "1 dinner"],
      transport: "Flight + Tour Bus",
      includes: [
        "Round-trip flight ticket",
        "4-star Hotel (4 nights)",
        "Airport shuttle transfer",
        "Daily breakfast",
        "Ha Long Bay sightseeing ticket",
        "Tour Guide service"
      ],
      schedule: [
        "Day 1: Noi Bai Airport pick-up - Hotel check-in - Free to explore Hanoi",
        "Day 2: Visit Sword Lake, Temple of Literature - Transfer to Ha Long",
        "Day 3: Ha Long Bay Cruise - Kayaking - Coral reef viewing",
        "Day 4: Transfer to Sapa - Cat Cat Village - Ham Rong Mountain",
        "Day 5: Sapa Market - Transfer back to Hanoi - Flight home"
      ]
    },
    {
      id: 2,
      title: "Da Nang - Hoi An Beach Vacation",
      description: "Enjoy your vacation in Da Nang and explore ancient Hoi An town",
      shortDesc: "Da Nang - Hoi An - Ba Na",
      departureCity: "Ho Chi Minh City",
      destinationCity: "Da Nang",
      duration: "4 days 3 nights",
      hotel: "Furama Resort Da Nang",
      meals: ["3 breakfasts", "2 lunches", "2 dinners"],
      transport: "Flight + Tour Bus",
      includes: [
        "Round-trip flight ticket",
        "5-star Resort (3 nights)",
        "Airport shuttle transfer",
        "Buffet breakfast",
        "Ba Na Hills ticket (Cable car)",
        "Hoi An sightseeing ticket"
      ],
      schedule: [
        "Day 1: Da Nang Airport pick-up - Resort check-in - Beach time",
        "Day 2: Ba Na Hills - Golden Bridge - Le Jardin Garden",
        "Day 3: Explore Hoi An - Night market - Lantern releasing",
        "Day 4: Free exploration in Da Nang - Flight home"
      ]
    },
    {
      id: 3,
      title: "Phu Quoc Island Paradise Tour",
      description: "Explore the pearl island of Phu Quoc with crystal clear beaches",
      shortDesc: "Phu Quoc - Grand World - Hon Thom",
      departureCity: "Ho Chi Minh City",
      destinationCity: "Phu Quoc",
      duration: "4 days 3 nights",
      hotel: "Novotel Phu Quoc Resort",
      meals: ["3 breakfasts", "3 lunches"],
      transport: "Flight + Tour Bus + Speedboat",
      includes: [
        "Round-trip flight ticket",
        "4-star Resort (3 nights)",
        "Airport shuttle transfer",
        "Buffet breakfast",
        "Grand World ticket",
        "3-Island tour (Hon Thom Cable car)",
        "Travel insurance"
      ],
      schedule: [
        "Day 1: Phu Quoc Airport pick-up - Check-in - Beach relaxation",
        "Day 2: 3-Island Tour: May Rut - May Rut Trong - Gam Ghi",
        "Day 3: Grand World - Hon Thom Cable Car - Aquatopia Water Park",
        "Day 4: Phu Quoc Night Market - Local specialties shopping - Flight home"
      ]
    },
    {
      id: 4,
      title: "Trans-Vietnam Train Journey",
      description: "Experience scenic railway journeys from North to South Vietnam",
      shortDesc: "Hanoi - Hue - Da Nang - Saigon",
      departureCity: "Hanoi",
      destinationCity: "Ho Chi Minh City",
      duration: "4 days 3 nights",
      seatClass: "4-berth Sleeper Cabin",
      meals: ["3 breakfasts", "2 lunches", "2 dinners"],
      transport: "Train + Tour Bus",
      includes: [
        "Round-trip sleeper train tickets",
        "3-star Hotel (3 nights)",
        "Railway station transfers",
        "Daily breakfast",
        "Sightseeing tickets for all stops",
        "Tour Guide"
      ],
      schedule: [
        "Day 1: Board train at Hanoi Station - Begin journey",
        "Day 2: Arrive at Hue Station - Visit Imperial Citadel & Royal Tombs",
        "Day 3: Transfer to Da Nang - Ba Na Hills - Golden Bridge",
        "Day 4: Continue journey to Saigon - Tour concludes"
      ]
    },
    {
      id: 5,
      title: "Hue - Da Nang Coastal Train Tour",
      description: "Discover ancient Hue and Da Nang with coastal railway views",
      shortDesc: "Hue - Da Nang - Hoi An",
      departureCity: "Hue",
      destinationCity: "Da Nang",
      duration: "4 days 3 nights",
      seatClass: "Air-conditioned Soft Seats",
      meals: ["3 breakfasts", "1 lunch"],
      transport: "Train + Tour Bus",
      includes: [
        "Hue - Da Nang train tickets",
        "4-star Hotel (3 nights)",
        "Station & tour transfers",
        "Breakfast",
        "Sightseeing tickets",
        "Tour Guide"
      ],
      schedule: [
        "Day 1: Hue Station - Check-in - Visit Imperial City",
        "Day 2: Minh Mang, Tu Duc Tombs - Thien Mu Pagoda",
        "Day 3: Scenic coastal train to Da Nang - Son Tra Peninsula",
        "Day 4: Hoi An Ancient Town - Tour concludes"
      ]
    },
    {
      id: 6,
      title: "Ta Xua Cloud Hunting Tour",
      description: "Conquer Ta Xua peak - Northwest cloud hunting wonderland",
      shortDesc: "Hanoi - Ta Xua - Moc Chau",
      departureCity: "Hanoi",
      destinationCity: "Ta Xua",
      duration: "3 days 2 nights",
      busType: "Limousine Sleeper Bus",
      meals: ["2 breakfasts", "3 main meals"],
      transport: "Limousine Bus + Motorbike",
      includes: [
        "Round-trip limousine sleeper bus",
        "Cozy Homestay (2 nights)",
        "Meals as per itinerary",
        "Sightseeing tickets",
        "Tour Guide",
        "Travel insurance"
      ],
      schedule: [
        "Day 1: Hanoi - Moc Chau - Na Ka Plum Valley",
        "Day 2: Transfer to Ta Xua - Dinosaur Backbone cloud hunting",
        "Day 3: Sunrise over clouds - Return to Hanoi"
      ]
    },
    {
      id: 7,
      title: "Da Lat - City of Eternal Spring",
      description: "Discover romantic Da Lat with high-class sleeper buses",
      shortDesc: "Saigon - Da Lat",
      departureCity: "Ho Chi Minh City",
      destinationCity: "Da Lat",
      duration: "4 days 3 nights",
      busType: "VIP 34-Berth Sleeper Bus",
      meals: ["3 breakfasts"],
      transport: "Sleeper Bus + Tour Car",
      includes: [
        "Round-trip sleeper bus",
        "Center Hotel (3 nights)",
        "Breakfasts",
        "Sightseeing entrance tickets",
        "Sightseeing transfers"
      ],
      schedule: [
        "Day 1: Saigon - Da Lat - Lam Vien Square",
        "Day 2: Truc Lam Zen Monastery - Datanla Waterfall - Da Lat Station",
        "Day 3: Cu Lan Village - Strawberry Garden - Night Market",
        "Day 4: Specialty shopping - Return to Saigon"
      ]
    }
  ],
  ja: [
    {
      id: 1,
      title: "ベトナム北部 探訪の旅",
      description: "ハノイ・ハロン湾・サパを巡る5日間4泊の旅",
      shortDesc: "ハノイ - ハロン - サパ",
      departureCity: "ホーチミン市",
      destinationCity: "ハノイ",
      duration: "5日間4泊",
      hotel: "ハノイ・デウーホテル",
      meals: ["朝食4回", "昼食2回", "夕食1回"],
      transport: "飛行機 + 観光バス",
      includes: [
        "往復航空券",
        "4つ星ホテル（4泊）",
        "空港送迎サービス",
        "毎朝食付き",
        "ハロン湾クルーズ観光チケット",
        "日本語/ベトナム語ガイド"
      ],
      schedule: [
        "1日目: ノイバイ空港到着 - ホテルチェックイン - ハノイ市内自由散策",
        "2日目: ホアンキエム湖、文廟観光 - ハロン湾へ移動",
        "3日目: ハロン湾クルーズ - カヤック - サンゴ礁鑑賞",
        "4日目: サパへ移動 - カットカット村 - ハムロン山",
        "5日目: サパの朝市 - ハノイへ戻り - 帰国便"
      ]
    },
    {
      id: 2,
      title: "ダナン・ホイアン ビーチリゾート休暇",
      description: "ダナンでのリゾート滞在と古都ホイアンの散策を満喫",
      shortDesc: "ダナン - ホイアン - バーナー",
      departureCity: "ホーチミン市",
      destinationCity: "ダナン",
      duration: "4日間3泊",
      hotel: "フラマリゾート・ダナン",
      meals: ["朝食3回", "昼食2回", "夕食2回"],
      transport: "飛行機 + 観光バス",
      includes: [
        "往復航空券",
        "5つ星リゾート（3泊）",
        "空港送迎",
        "ビュッフェ朝食",
        "バーナーヒルズ入場券（ロープウェイ）",
        "ホイアン観光チケット"
      ],
      schedule: [
        "1日目: ダナン空港到着 - リゾートチェックイン - ビーチ散策",
        "2日目: バーナーヒルズ - ゴールデンブリッジ - 庭園散策",
        "3日目: ホイアン古都散策 - ナイトマーケット - 灯籠流し",
        "4日目: ダナン自由散策 - 帰国便"
      ]
    },
    {
      id: 3,
      title: "フーコック島 パラダイスツアー",
      description: "エメラルドグリーンの海が広がる真珠の島フーコックを探訪",
      shortDesc: "フーコック - グランドワールド - ホントム",
      departureCity: "ホーチミン市",
      destinationCity: "フーコック",
      duration: "4日間3泊",
      hotel: "ノボテル・フーコックリゾート",
      meals: ["朝食3回", "昼食3回"],
      transport: "飛行機 + バス + スピードボート",
      includes: [
        "往復航空券",
        "4つ星リゾート（3泊）",
        "空港送迎",
        "ビュッフェ朝食",
        "グランドワールド入場券",
        "3島巡り（ホントム・ロープウェイ）",
        "旅行保険"
      ],
      schedule: [
        "1日目: フーコック空港到着 - チェックイン - ビーチでのんびり",
        "2日目: 3島アイランドホッピングツアー",
        "3日目: グランドワールド - ホントム・ロープウェイ - ウォーターパーク",
        "4日目: ナイトマーケット - 特産品ショッピング - 帰国便"
      ]
    },
    {
      id: 4,
      title: "ベトナム縦断 鉄道の旅",
      description: "南北を結ぶ風光明媚な鉄道でベトナムの絶景を巡る",
      shortDesc: "ハノイ - フエ - ダナン - サイゴン",
      departureCity: "ハノイ",
      destinationCity: "ホーチミン市",
      duration: "4日間3泊",
      seatClass: "4人部屋 寝台",
      meals: ["朝食3回", "昼食2回", "夕食2回"],
      transport: "列車 + 観光バス",
      includes: [
        "往復寝台列車チケット",
        "3つ星ホテル（3泊）",
        "駅送迎サービス",
        "毎朝食付き",
        "各停車駅の観光チケット",
        "ツアーガイド"
      ],
      schedule: [
        "1日目: ハノイ駅より列車に乗車 - 旅の始まり",
        "2日目: フエ駅到着 - 王宮・帝陵観光",
        "3日目: ダナンへ移動 - バーナーヒルズ - ゴールデンブリッジ",
        "4日目: サイゴンへ向け出発 - ツアー終了"
      ]
    },
    {
      id: 5,
      title: "フエ・ダナン 沿岸鉄道ツアー",
      description: "古都フエとダナンを海沿いの絶景パノラマ列車で巡る旅",
      shortDesc: "フエ - ダナン - ホイアン",
      departureCity: "フエ",
      destinationCity: "ダナン",
      duration: "4日間3泊",
      seatClass: "エアコン完備 ソフトシート",
      meals: ["朝食3回", "昼食1回"],
      transport: "列車 + 観光バス",
      includes: [
        "フエ〜ダナン間 列車チケット",
        "4つ星ホテル（3泊）",
        "送迎車",
        "朝食付き",
        "観光入場券",
        "ツアーガイド"
      ],
      schedule: [
        "1日目: フエ駅到着 - チェックイン - フエ王宮観光",
        "2日目: ミンマン帝陵・カイディン帝陵 - ティエンムー寺",
        "3日目: 絶景列車でダナンへ移動 - ソンチャ半島観光",
        "4日目: ホイアン古都散策 - ツアー終了"
      ]
    },
    {
      id: 6,
      title: "タースア 雲海ハンティングツアー",
      description: "北西部最高峰の雲海スポット・タースア山頂を目指す冒険",
      shortDesc: "ハノイ - タースア - モクチャウ",
      departureCity: "ハノイ",
      destinationCity: "タースア",
      duration: "3日間2泊",
      busType: "リムジン寝台バス",
      meals: ["朝食2回", "主要食事3回"],
      transport: "リムジンバス + バイク",
      includes: [
        "往復リムジン寝台バス",
        "ホームステイ（2泊）",
        "日程に記載された食事",
        "観光地入場券",
        "ツアーガイド",
        "旅行保険"
      ],
      schedule: [
        "1日目: ハノイ - モクチャウ - ナカ渓谷",
        "2日目: タースアへ移動 - 恐竜の背骨（雲海スポット）",
        "3日目: 雲上のご来光鑑賞 - ハノイへ帰着"
      ]
    },
    {
      id: 7,
      title: "ダラット・花の都ツアー",
      description: "快適な高級長距離バスで巡るロマンチックな高原都市ダラット",
      shortDesc: "サイゴン - ダラット",
      departureCity: "ホーチミン市",
      destinationCity: "ダラット",
      duration: "4日間3泊",
      busType: "VIP 34人乗り寝台バス",
      meals: ["朝食3回"],
      transport: "長距離バス + 観光専用車",
      includes: [
        "往復寝台バスチケット",
        "中心部ホテル（3泊）",
        "朝食付き",
        "観光スポット入場券",
        "観光専用車での送迎"
      ],
      schedule: [
        "1日目: サイゴン - ダラット - ラムビエン広場",
        "2日目: チュックラム禅院 - ダタンラ滝 - ダラット駅",
        "3日目: クラン村 - イチゴ農園 - ナイトマーケット",
        "4日目: 特産品ショッピング - サイゴンへ帰着"
      ]
    }
  ],
  zh: [
    {
      id: 1,
      title: "探索越南北部之旅",
      description: "5天4晚探索河內 - 下龍灣 - 沙壩",
      shortDesc: "河內 - 下龍灣 - 沙壩",
      departureCity: "胡志明市",
      destinationCity: "河內",
      duration: "5天4晚",
      hotel: "河內大宇酒店",
      meals: ["4次早餐", "2次午餐", "1次晚餐"],
      transport: "飛機 + 旅遊巴士",
      includes: [
        "來回機票",
        "四星級酒店（4晚）",
        "機場接送服務",
        "每日早餐",
        "下龍灣觀光船票",
        "中文/越南語導遊"
      ],
      schedule: [
        "第1天: 內排機場接機 - 辦理入住 - 自由探索河內",
        "第2天: 參觀還劍湖、文廟 - 前往下龍灣",
        "第3天: 下龍灣遊船 - 皮划艇 - 觀賞珊瑚",
        "第4天: 前往沙壩 - 貓貓村 - 含龍山",
        "第5天: 沙壩市集 - 返回河內 - 搭機返程"
      ]
    },
    {
      id: 2,
      title: "峴港 - 會安海濱度假之旅",
      description: "享受峴港海濱度假並探索會安古鎮",
      shortDesc: "峴港 - 會安 - 巴拿山",
      departureCity: "胡志明市",
      destinationCity: "峴港",
      duration: "4天3晚",
      hotel: "峴港芙蓉度假村",
      meals: ["3次早餐", "2次午餐", "2次晚餐"],
      transport: "飛機 + 旅遊巴士",
      includes: [
        "來回機票",
        "五星級度假村（3晚）",
        "機場接送",
        "自助早餐",
        "巴拿山門票（纜車）",
        "會安觀光門票"
      ],
      schedule: [
        "第1天: 峴港機場接機 - 入住度假村 - 海灘休閒",
        "第2天: 巴拿山 - 黃金佛手橋 - 愛之花園",
        "第3天: 會安古鎮觀光 - 夜市 - 放水燈祈福",
        "第4天: 峴港市區自由活動 - 搭機返程"
      ]
    },
    {
      id: 3,
      title: "富國島海島天堂之旅",
      description: "探索擁有絕美白沙灘的富國珍珠島",
      shortDesc: "富國島 - 大世界 - 香島",
      departureCity: "胡志明市",
      destinationCity: "富國島",
      duration: "4天3晚",
      hotel: "富國島諾富特度假村",
      meals: ["3次早餐", "3次午餐"],
      transport: "飛機 + 旅遊巴士 + 快艇",
      includes: [
        "來回機票",
        "四星級度假村（3晚）",
        "機場接送",
        "自助早餐",
        "富國大世界門票",
        "跳島遊（香島跨海纜車）",
        "旅遊保險"
      ],
      schedule: [
        "第1天: 富國機場接機 - 辦理入住 - 海灘放鬆",
        "第2天: 三島跳島遊（雲退島 - 野鴿島）",
        "第3天: 富國大世界 - 香島纜車 - 水上樂園",
        "第4天: 富國夜市 - 購買特產 - 搭機返程"
      ]
    },
    {
      id: 4,
      title: "搭乘火車縱貫越南之旅",
      description: "搭乘經典火車體驗從北到南的越南壯麗風光",
      shortDesc: "河內 - 順化 - 峴港 - 西貢",
      departureCity: "河內",
      destinationCity: "胡志明市",
      duration: "4天3晚",
      seatClass: "4人軟臥包廂",
      meals: ["3次早餐", "2次午餐", "2次晚餐"],
      transport: "火車 + 旅遊巴士",
      includes: [
        "來回火車臥鋪票",
        "三星級酒店（3晚）",
        "火車站接送",
        "每日早餐",
        "各停靠站觀光門票",
        "導遊隨行"
      ],
      schedule: [
        "第1天: 河內火車站搭車 - 開啟縱貫之旅",
        "第2天: 抵達順化站 - 參觀皇城與皇陵",
        "第3天: 前往峴港 - 巴拿山 - 黃金橋",
        "第4天: 繼續前往西貢 - 行程圓滿結束"
      ]
    },
    {
      id: 5,
      title: "順化 - 峴港海岸觀光火車之旅",
      description: "搭乘沿海景觀火車探索順化古都與峴港",
      shortDesc: "順化 - 峴港 - 會安",
      departureCity: "順化",
      destinationCity: "峴港",
      duration: "4天3晚",
      seatClass: "空調軟座",
      meals: ["3次早餐", "1次午餐"],
      transport: "火車 + 旅遊巴士",
      includes: [
        "順化至峴港火車票",
        "四星級酒店（3晚）",
        "專車接送",
        "含早餐",
        "景點門票",
        "導遊服務"
      ],
      schedule: [
        "第1天: 順化站 - 辦理入住 - 參觀順化皇城",
        "第2天: 明命陵、啟定陵 - 天姥寺",
        "第3天: 搭乘海岸火車前往峴港 - 山茶半島",
        "第4天: 會安古鎮遊覽 - 行程結束"
      ]
    },
    {
      id: 6,
      title: "塔宿雲海追尋之旅",
      description: "征服西北雲海天堂塔宿峰",
      shortDesc: "河內 - 塔宿 - 木州",
      departureCity: "河內",
      destinationCity: "塔宿",
      duration: "3天2晚",
      busType: "豪華臥鋪巴士",
      meals: ["2次早餐", "3次正餐"],
      transport: "豪華巴士 + 摩托車",
      includes: [
        "來回豪華臥鋪巴士",
        "特色民宿（2晚）",
        "行程所列餐食",
        "景點門票",
        "導遊隨行",
        "旅遊保險"
      ],
      schedule: [
        "第1天: 河內 - 木州 - 那卡李子谷",
        "第2天: 前往塔宿 - 恐龍脊追尋壯觀雲海",
        "第3天: 雲海日出觀賞 - 返回河內"
      ]
    },
    {
      id: 7,
      title: "大叻 - 千花之城浪漫之旅",
      description: "搭乘優質臥鋪巴士探索浪漫的大叻高原",
      shortDesc: "西貢 - 大叻",
      departureCity: "胡志明市",
      destinationCity: "大叻",
      duration: "4天3晚",
      busType: "VIP 34座豪華臥鋪",
      meals: ["3次早餐"],
      transport: "長途巴士 + 旅遊專車",
      includes: [
        "來回臥鋪巴士票",
        "市中心酒店（3晚）",
        "含早餐",
        "景點觀光門票",
        "觀光接送專車"
      ],
      schedule: [
        "第1天: 西貢 - 大叻 - 林園廣場",
        "第2天: 竹林禪院 - 達坦拉瀑布 - 大叻火車站",
        "第3天: 庫蘭村 - 草莓園 - 大叻夜市",
        "第4天: 購買特產 - 返回西貢"
      ]
    }
  ]
};

const extraServiceTranslations = {
  vi: [
    { id: 1, name: "Bảo hiểm du lịch cao cấp", price: 199000 },
    { id: 2, name: "Tour guide riêng", price: 1500000 },
    { id: 3, name: "Vé VinWonders", price: 850000 },
    { id: 4, name: "Nâng cấp khách sạn 5 sao", price: 2000000 },
    { id: 5, name: "Buffet tối cao cấp", price: 599000 },
  ],
  en: [
    { id: 1, name: "Premium Travel Insurance", price: 199000 },
    { id: 2, name: "Private Tour Guide", price: 1500000 },
    { id: 3, name: "VinWonders Ticket", price: 850000 },
    { id: 4, name: "5-Star Hotel Upgrade", price: 2000000 },
    { id: 5, name: "Premium Dinner Buffet", price: 599000 },
  ],
  ja: [
    { id: 1, name: "プレミアム旅行保険", price: 199000 },
    { id: 2, name: "プライベートツアーガイド", price: 1500000 },
    { id: 3, name: "VinWonders入場券", price: 850000 },
    { id: 4, name: "5つ星ホテルへのアップグレード", price: 2000000 },
    { id: 5, name: "プレミアムディナービュッフェ", price: 599000 },
  ],
  zh: [
    { id: 1, name: "高級旅遊保險", price: 199000 },
    { id: 2, name: "私人導遊服務", price: 1500000 },
    { id: 3, name: "VinWonders門票", price: 850000 },
    { id: 4, name: "升級五星級酒店", price: 2000000 },
    { id: 5, name: "高級自助晚餐", price: 599000 },
  ],
};

const OrderByPackage = () => {
  const { t, currentLanguage } = useLanguage();
  const { token } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [bookingStep, setBookingStep] = useState("browse");
  const [travelers, setTravelers] = useState(2);
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [selectedExtras, setSelectedExtras] = useState([]);
  const [promoCode, setPromoCode] = useState("");
  const [favoriteTours, setFavoriteTours] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("favoriteTours")) || [];
    } catch { return []; }
  });
  const [customerInfo, setCustomerInfo] = useState({
    lastName: "", firstName: "", email: "", phoneDigits: "",
    dob: "", nationality: "Việt Nam"
  });
  const [customerErrors, setCustomerErrors] = useState({});

  const packages = React.useMemo(() => {
    const lang = currentLanguage?.code || "vi";
    const localizedList = packageTranslations[lang] || packageTranslations.vi;
    return basePackages.map(base => {
      const loc = localizedList.find(l => l.id === base.id) || {};
      return {
        ...base,
        ...loc,
        icon: base.type === "flight" ? <MdFlight /> : base.type === "train" ? <TbTrain /> : <TbBus />
      };
    });
  }, [currentLanguage]);

  const extraServices = React.useMemo(() => {
    const lang = currentLanguage?.code || "vi";
    const list = extraServiceTranslations[lang] || extraServiceTranslations.vi;
    const icons = [<MdLocalOffer />, <MdPeople />, <MdAttractions />, <MdHotel />, <MdRestaurant />];
    return list.map((item, idx) => ({
      ...item,
      icon: icons[idx] || <MdLocalOffer />
    }));
  }, [currentLanguage]);


  const filteredPackages = selectedCategory === "all"
    ? packages
    : packages.filter(pkg => pkg.type === selectedCategory);

  const handleSelectPackage = (pkg) => {
    setSelectedPackage(pkg);
    setBookingStep("details");
    window.scrollTo(0, 0);
  };

  const handleBookNow = () => {
    setBookingStep("booking");
  };

  const handleBookingSubmit = () => {
    setBookingStep("customerInfo");
  };

  const handleCustomerInfoSubmit = () => {
    const errors = {};
    if (!customerInfo.lastName.trim()) errors.lastName = "Vui lòng nhập họ";
    if (!customerInfo.firstName.trim()) errors.firstName = "Vui lòng nhập tên";
    if (!customerInfo.email.trim()) errors.email = "Vui lòng nhập email";
    if (!customerInfo.phoneDigits.trim()) errors.phoneDigits = "Vui lòng nhập số điện thoại";
    setCustomerErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setBookingStep("payment");
  };

  const handleVNPayPayment = async () => {
    try {
      const bookingId = Date.now();
      const res = await axios.post(
        "/api/payment/create",
        { bookingId, language: "vn" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.paymentUrl) {
        window.location.href = res.data.paymentUrl;
      }
    } catch {
      alert("Lỗi tạo link VNPay, vui lòng thử lại.");
    }
  };

  const toggleFavorite = (pkgId) => {
    setFavoriteTours(prev => {
      const updated = prev.includes(pkgId)
        ? prev.filter(id => id !== pkgId)
        : [...prev, pkgId];
      localStorage.setItem("favoriteTours", JSON.stringify(updated));
      return updated;
    });
  };

  const toggleExtra = (extraId) => {
    setSelectedExtras(prev =>
      prev.includes(extraId)
        ? prev.filter(id => id !== extraId)
        : [...prev, extraId]
    );
  };

  const calculateTotal = () => {
    if (!selectedPackage) return 0;
    const extrasTotal = selectedExtras.reduce((sum, id) => {
      const extra = extraServices.find(e => e.id === id);
      return sum + (extra?.price || 0);
    }, 0);
    return selectedPackage.price * travelers + extrasTotal;
  };

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalf = rating - fullStars >= 0.5;

    for (let i = 0; i < fullStars; i++) {
      stars.push(<FaStar key={`full-${i}`} style={{ color: "#FFD700" }} />);
    }
    if (hasHalf) {
      stars.push(<FaStarHalfAlt key="half" style={{ color: "#FFD700" }} />);
    }
    while (stars.length < 5) {
      stars.push(<FaStar key={`empty-${stars.length}`} style={{ color: "#E0E0E0" }} />);
    }
    return stars;
  };

  const currentPackage = selectedPackage ? (packages.find(p => p.id === selectedPackage.id) || selectedPackage) : null;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-main)" }}>
      <Header setIsSidebarOpen={setIsSidebarOpen} />

      <div className="page-with-sidebar">
        <Sidebar isOpen={isSidebarOpen} />
        <div className={`page-main ${isSidebarOpen ? "with-sidebar" : ""}`}>
          <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "30px 20px" }}>


            <div style={{ marginBottom: "30px" }}>
              <h1 style={{ fontSize: "36px", fontWeight: "700", color: "var(--text-heading)", marginBottom: "8px" }}>
                {t.package || "Đặt theo gói"}
              </h1>
              <p style={{ fontSize: "16px", color: "var(--text-secondary)" }}>
                {t.packageSubtitle || "Lựa chọn gói du lịch trọn gói với nhiều ưu đãi hấp dẫn"}
              </p>
            </div>

            {/* Category Filter - only show on browse */}
            {bookingStep === "browse" && <div style={{
              display: "flex",
              gap: "12px",
              marginBottom: "30px",
              flexWrap: "wrap"
            }}>
              <button
                onClick={() => setSelectedCategory("all")}
                style={{
                  padding: "12px 24px",
                  borderRadius: "50px",
                  border: "none",
                  background: selectedCategory === "all" ? "#2563eb" : "var(--bg-card)",
                  color: selectedCategory === "all" ? "white" : "var(--text-main)",
                  fontWeight: "600",
                  fontSize: "15px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                  transition: "all 0.2s"
                }}
              >
                <MdFlight /> {t.all}
              </button>
              <button
                onClick={() => setSelectedCategory("flight")}
                style={{
                  padding: "12px 24px",
                  borderRadius: "50px",
                  border: "none",
                  background: selectedCategory === "flight" ? "#2563eb" : "var(--bg-card)",
                  color: selectedCategory === "flight" ? "white" : "var(--text-main)",
                  fontWeight: "600",
                  fontSize: "15px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                  transition: "all 0.2s"
                }}
              >
                <GiCommercialAirplane /> {t.flight}
              </button>
              <button
                onClick={() => setSelectedCategory("train")}
                style={{
                  padding: "12px 24px",
                  borderRadius: "50px",
                  border: "none",
                  background: selectedCategory === "train" ? "#2563eb" : "var(--bg-card)",
                  color: selectedCategory === "train" ? "white" : "var(--text-main)",
                  fontWeight: "600",
                  fontSize: "15px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                  transition: "all 0.2s"
                }}
              >
                <TbTrain /> {t.train}
              </button>
              <button
                onClick={() => setSelectedCategory("bus")}
                style={{
                  padding: "12px 24px",
                  borderRadius: "50px",
                  border: "none",
                  background: selectedCategory === "bus" ? "#2563eb" : "var(--bg-card)",
                  color: selectedCategory === "bus" ? "white" : "var(--text-main)",
                  fontWeight: "600",
                  fontSize: "15px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                  transition: "all 0.2s"
                }}
              >
                <TbBus /> {t.bus}
              </button>
            </div>}

            {/* Favorites Tab */}
            {bookingStep === "browse" && favoriteTours.length > 0 && (
              <div style={{ marginBottom: "24px" }}>
                <button
                  onClick={() => setSelectedCategory(selectedCategory === "favorites" ? "all" : "favorites")}
                  style={{
                    padding: "12px 24px",
                    borderRadius: "50px",
                    border: selectedCategory === "favorites" ? "2px solid #ef4444" : "1px solid rgba(239, 68, 68, 0.4)",
                    background: selectedCategory === "favorites" ? "rgba(239, 68, 68, 0.15)" : "var(--bg-card)",
                    color: "#ef4444",
                    fontWeight: "700",
                    fontSize: "15px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    transition: "all 0.2s"
                  }}
                >
                  <MdFavorite /> {t.favoriteTours || "Tour yêu thích"} ({favoriteTours.length})
                </button>
              </div>
            )}

            {/* Favorite Tours Grid */}
            {bookingStep === "browse" && selectedCategory === "favorites" && (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
                gap: "24px",
                marginBottom: "24px"
              }}>
                {packages.filter(pkg => favoriteTours.includes(pkg.id)).map((pkg) => (
                  <div
                    key={pkg.id}
                    style={{
                      background: "var(--bg-card)",
                      borderRadius: "20px",
                      overflow: "hidden",
                      boxShadow: "0 4px 15px rgba(0,0,0,0.08)",
                      cursor: "pointer",
                      transition: "transform 0.2s, box-shadow 0.2s",
                      position: "relative",
                      border: "2px solid #fca5a5"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-4px)";
                      e.currentTarget.style.boxShadow = "0 8px 25px rgba(0,0,0,0.15)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 4px 15px rgba(0,0,0,0.08)";
                    }}
                    onClick={() => handleSelectPackage(pkg)}
                  >
                    {pkg.discount && (
                      <div style={{
                        position: "absolute", top: "16px", left: "16px",
                        background: "#ef4444", color: "white",
                        padding: "4px 12px", borderRadius: "20px",
                        fontWeight: "700", fontSize: "14px", zIndex: 1
                      }}>-{pkg.discount}%</div>
                    )}
                    <button
                      style={{
                        position: "absolute",
                        top: "16px",
                        right: "16px",
                        background: "rgba(15, 23, 42, 0.75)",
                        backdropFilter: "blur(6px)",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                        zIndex: 2,
                        transition: "all 0.2s ease"
                      }}
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(pkg.id); }}
                    >
                      <MdFavorite style={{ color: "#ef4444", fontSize: "18px" }} />
                    </button>
                    <div style={{
                      height: "200px",
                      backgroundImage: `url(${pkg.image})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      position: "relative"
                    }}>
                      <div style={{
                        position: "absolute", bottom: "12px", left: "12px",
                        background: "rgba(0,0,0,0.6)", color: "white",
                        padding: "4px 12px", borderRadius: "20px", fontSize: "13px",
                        display: "flex", alignItems: "center", gap: "6px"
                      }}>
                        {pkg.icon}
                        <span>{pkg.type === "flight" ? t.flight : pkg.type === "train" ? t.train : t.bus}</span>
                      </div>
                    </div>
                    <div style={{ padding: "20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "8px" }}>
                        {renderStars(pkg.rating)}
                        <span style={{ fontSize: "13px", color: "#64748b", marginLeft: "4px" }}>
                          ({pkg.reviewCount} {t.reviews || "đánh giá"})
                        </span>
                      </div>
                      <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-heading)", marginBottom: "8px" }}>{pkg.title}</h3>
                      <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "12px" }}>{pkg.shortDesc}</p>
                      <div style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
                        <div style={{ fontSize: "13px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                          <MdCalendarToday /> {pkg.duration}
                        </div>
                        <div style={{ fontSize: "13px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                          <MdPeople /> {pkg.departureCity}
                        </div>
                      </div>
                      <div style={{
                        display: "flex", alignItems: "baseline", justifyContent: "space-between",
                        borderTop: "1px solid var(--border-light)", paddingTop: "16px"
                      }}>
                        <div>
                          <span style={{ fontSize: "14px", color: "var(--text-muted)", textDecoration: "line-through", marginRight: "8px" }}>
                            {pkg.originalPrice.toLocaleString("vi-VN")}đ
                          </span>
                          <span style={{ fontSize: "22px", fontWeight: "700", color: "#2563eb" }}>
                            {pkg.price.toLocaleString("vi-VN")}đ
                          </span>
                        </div>
                        <button style={{
                          padding: "8px 16px", background: "#2563eb", color: "white",
                          border: "none", borderRadius: "8px", fontWeight: "600", fontSize: "14px", cursor: "pointer"
                        }}>{t.selectPackage || "Chọn gói"}</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {bookingStep === "browse" && selectedCategory !== "favorites" && (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
                gap: "24px"
              }}>
                {filteredPackages.map((pkg) => (
                  <div
                    key={pkg.id}
                    style={{
                      background: "var(--bg-card)",
                      borderRadius: "20px",
                      overflow: "hidden",
                      boxShadow: "0 4px 15px rgba(0,0,0,0.08)",
                      cursor: "pointer",
                      transition: "transform 0.2s, box-shadow 0.2s",
                      position: "relative"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-4px)";
                      e.currentTarget.style.boxShadow = "0 8px 25px rgba(0,0,0,0.15)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 4px 15px rgba(0,0,0,0.08)";
                    }}
                    onClick={() => handleSelectPackage(pkg)}
                  >
                    {/* Discount Badge */}
                    {pkg.discount && (
                      <div style={{
                        position: "absolute",
                        top: "16px",
                        left: "16px",
                        background: "#ef4444",
                        color: "white",
                        padding: "4px 12px",
                        borderRadius: "20px",
                        fontWeight: "700",
                        fontSize: "14px",
                        zIndex: 1
                      }}>
                        -{pkg.discount}%
                      </div>
                    )}

                    {/* Favorite Button */}
                    <button
                      style={{
                        position: "absolute",
                        top: "16px",
                        right: "16px",
                        background: "rgba(15, 23, 42, 0.75)",
                        backdropFilter: "blur(6px)",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                        zIndex: 2,
                        transition: "all 0.2s ease"
                      }}
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(pkg.id); }}
                    >
                      {favoriteTours.includes(pkg.id)
                        ? <MdFavorite style={{ color: "#ef4444", fontSize: "18px" }} />
                        : <MdFavoriteBorder style={{ color: "rgba(255, 255, 255, 0.85)", fontSize: "18px" }} />}
                    </button>

                    {/* Image */}
                    <div style={{
                      height: "200px",
                      backgroundImage: `url(${pkg.image})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      position: "relative"
                    }}>
                      <div style={{
                        position: "absolute",
                        bottom: "12px",
                        left: "12px",
                        background: "rgba(0,0,0,0.6)",
                        color: "white",
                        padding: "4px 12px",
                        borderRadius: "20px",
                        fontSize: "13px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px"
                      }}>
                        {pkg.icon}
                        <span>{pkg.type === "flight" ? t.flight : pkg.type === "train" ? t.train : t.bus}</span>
                      </div>
                    </div>

                    {/* Content */}
                    <div style={{ padding: "20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "8px" }}>
                        {renderStars(pkg.rating)}
                        <span style={{ fontSize: "13px", color: "#64748b", marginLeft: "4px" }}>
                          ({pkg.reviewCount} {t.reviews || "đánh giá"})
                        </span>
                      </div>

                      <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-heading)", marginBottom: "8px" }}>
                        {pkg.title}
                      </h3>

                      <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "12px" }}>
                        {pkg.shortDesc}
                      </p>

                      <div style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
                        <div style={{ fontSize: "13px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                          <MdCalendarToday /> {pkg.duration}
                        </div>
                        <div style={{ fontSize: "13px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                          <MdPeople /> {pkg.departureCity}
                        </div>
                      </div>

                      <div style={{
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        borderTop: "1px solid var(--border-light)",
                        paddingTop: "16px"
                      }}>
                        <div>
                          <span style={{ fontSize: "14px", color: "var(--text-muted)", textDecoration: "line-through", marginRight: "8px" }}>
                            {pkg.originalPrice.toLocaleString("vi-VN")}đ
                          </span>
                          <span style={{ fontSize: "22px", fontWeight: "700", color: "#2563eb" }}>
                            {pkg.price.toLocaleString("vi-VN")}đ
                          </span>
                        </div>
                        <button
                          style={{
                            padding: "8px 16px",
                            background: "#2563eb",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            fontWeight: "600",
                            fontSize: "14px",
                            cursor: "pointer"
                          }}
                        >
                          {t.selectPackage || "Chọn gói"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Package Details */}
            {bookingStep === "details" && currentPackage && (
              <div>
                {/* Back button */}
                <button
                  onClick={() => { setBookingStep("browse"); setSelectedPackage(null); }}
                  style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    padding: "10px 20px", marginBottom: "20px",
                    background: "var(--bg-card)", border: "1px solid var(--border-light)",
                    borderRadius: "10px", cursor: "pointer",
                    fontWeight: "600", fontSize: "15px", color: "var(--text-secondary)",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.borderColor = "var(--border-main)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-card)"; e.currentTarget.style.borderColor = "var(--border-light)"; }}
                >
                  <MdArrowBack size={20} /> {t.backToList || "Quay lại danh sách"}
                </button>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "24px" }}>
                  <div>
                    {/* Main Image */}
                    <div style={{
                      height: "400px",
                      borderRadius: "20px",
                      backgroundImage: `url(${currentPackage.image})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      marginBottom: "24px",
                      position: "relative"
                    }}>
                      <div style={{
                        position: "absolute",
                        bottom: "20px",
                        left: "20px",
                        background: "rgba(0,0,0,0.7)",
                        color: "white",
                        padding: "8px 16px",
                        borderRadius: "30px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px"
                      }}>
                        {currentPackage.icon}
                        <span style={{ fontSize: "14px" }}>
                          {currentPackage.type === "flight" ? t.flight :
                            currentPackage.type === "train" ? t.train : t.bus}
                        </span>
                      </div>
                    </div>

                    {/* Title and Rating */}
                    <div style={{ marginBottom: "24px" }}>
                      <h2 style={{ fontSize: "28px", fontWeight: "700", color: "var(--text-heading)", marginBottom: "8px" }}>
                        {currentPackage.title}
                      </h2>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                        <div style={{ display: "flex", gap: "2px" }}>
                          {renderStars(currentPackage.rating)}
                        </div>
                        <span style={{ color: "var(--text-muted)" }}>{currentPackage.rating}/5</span>
                        <span style={{ color: "#94a3b8" }}>•</span>
                        <span style={{ color: "var(--text-muted)" }}>{currentPackage.reviewCount} {t.reviews || "đánh giá"}</span>
                      </div>
                      <p style={{ fontSize: "16px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
                        {currentPackage.description}
                      </p>
                    </div>

                    {/* Schedule */}
                    <div style={{
                      background: "var(--bg-card)",
                      borderRadius: "16px",
                      padding: "24px",
                      marginBottom: "24px"
                    }}>
                      <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-heading)", marginBottom: "16px" }}>
                        {t.detailedItinerary || "Lịch trình chi tiết"}
                      </h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        {currentPackage.schedule.map((item, index) => (
                          <div key={index} style={{ display: "flex", gap: "12px" }}>
                            <div style={{
                              width: "28px",
                              height: "28px",
                              background: "#2563eb",
                              color: "white",
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: "700",
                              fontSize: "14px",
                              flexShrink: 0
                            }}>
                              {index + 1}
                            </div>
                            <div style={{ fontSize: "15px", color: "var(--text-main)", lineHeight: "1.5" }}>
                              {item}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* What's Included */}
                    <div style={{
                      background: "var(--bg-card)",
                      borderRadius: "16px",
                      padding: "24px"
                    }}>
                      <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-heading)", marginBottom: "16px" }}>
                        {t.includes || "Bao gồm"}
                      </h3>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
                        {currentPackage.includes.map((item, index) => (
                          <div key={index} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <MdCheckCircle style={{ color: "#10b981", flexShrink: 0 }} />
                            <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Booking Sidebar */}
                  <div>
                    <div style={{
                      background: "var(--bg-card)",
                      borderRadius: "16px",
                      padding: "24px",
                      position: "sticky",
                      top: "90px"
                    }}>
                      {/* Price */}
                      <div style={{ marginBottom: "24px" }}>
                        <div style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "4px" }}>{t.priceFrom || "Giá từ"}</div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
                          <span style={{ fontSize: "32px", fontWeight: "700", color: "#2563eb" }}>
                            {currentPackage.price.toLocaleString("vi-VN")}đ
                          </span>
                          <span style={{ fontSize: "16px", color: "var(--text-muted)", textDecoration: "line-through" }}>
                            {currentPackage.originalPrice.toLocaleString("vi-VN")}đ
                          </span>
                        </div>
                        <div style={{
                          background: "#fee2e2",
                          color: "#ef4444",
                          padding: "4px 12px",
                          borderRadius: "20px",
                          fontSize: "13px",
                          fontWeight: "600",
                          display: "inline-block",
                          marginTop: "8px"
                        }}>
                          {t.save || "Tiết kiệm"} {currentPackage.discount}%
                        </div>
                      </div>

                      {/* Quick Info */}
                      <div style={{
                        background: "var(--bg-hover)",
                        borderRadius: "12px",
                        padding: "16px",
                        marginBottom: "24px"
                      }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: "var(--text-muted)" }}>{t.departurePoint || "Điểm khởi hành"}</span>
                            <span style={{ fontWeight: "600", color: "var(--text-heading)" }}>{currentPackage.departureCity}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: "var(--text-muted)" }}>{t.destinationPoint || "Điểm đến"}</span>
                            <span style={{ fontWeight: "600", color: "var(--text-heading)" }}>{currentPackage.destinationCity}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: "var(--text-muted)" }}>{t.duration || "Thời gian"}</span>
                            <span style={{ fontWeight: "600", color: "var(--text-heading)" }}>{currentPackage.duration}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: "var(--text-muted)" }}>{t.transportation || "Phương tiện"}</span>
                            <span style={{ fontWeight: "600", color: "var(--text-heading)" }}>{currentPackage.transport}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <button
                        onClick={handleBookNow}
                        style={{
                          width: "100%",
                          padding: "16px",
                          background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                          color: "white",
                          border: "none",
                          borderRadius: "12px",
                          fontWeight: "700",
                          fontSize: "16px",
                          cursor: "pointer",
                          marginBottom: "12px"
                        }}
                      >
                        {t.bookNow || "Đặt ngay"}
                      </button>

                      <button
                        style={{
                          width: "100%",
                          padding: "14px",
                          background: "var(--bg-card)",
                          color: "var(--text-muted)",
                          border: "1px solid var(--border-light)",
                          borderRadius: "12px",
                          fontWeight: "600",
                          fontSize: "15px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px"
                        }}
                      >
                        <MdShare /> {t.sharePackage || "Chia sẻ gói này"}
                      </button>

                      {/* Info Note */}
                      <div style={{
                        marginTop: "20px",
                        fontSize: "13px",
                        color: "var(--text-muted)",
                        textAlign: "center"
                      }}>
                        <MdInfo style={{ verticalAlign: "middle", marginRight: "4px" }} />
                        {t.priceDisclaimer || "Giá có thể thay đổi theo ngày khởi hành và số lượng khách"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Booking Form */}
            {bookingStep === "booking" && selectedPackage && (
              <div style={{ maxWidth: "800px", margin: "0 auto" }}>
                <div style={{
                  background: "var(--bg-card)",
                  borderRadius: "20px",
                  padding: "32px"
                }}>
                  <h2 style={{ fontSize: "24px", fontWeight: "700", color: "var(--text-heading)", marginBottom: "24px" }}>
                    Thông tin đặt gói
                  </h2>

                  {/* Travelers */}
                  <div style={{ marginBottom: "24px" }}>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "var(--text-heading)", marginBottom: "8px" }}>
                      Số lượng khách
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <button
                        onClick={() => setTravelers(Math.max(1, travelers - 1))}
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "8px",
                          border: "1px solid var(--border-light)",
                          background: "var(--bg-card)",
                          fontSize: "18px",
                          cursor: "pointer"
                        }}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={travelers}
                        onChange={(e) => setTravelers(Math.max(1, parseInt(e.target.value) || 1))}
                        style={{
                          width: "80px",
                          padding: "8px",
                          textAlign: "center",
                          border: "1px solid var(--border-light)",
                          borderRadius: "8px",
                          background: "var(--bg-input)",
                          color: "var(--text-main)"
                        }}
                      />
                      <button
                        onClick={() => setTravelers(Math.min(10, travelers + 1))}
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "8px",
                          border: "1px solid var(--border-light)",
                          background: "var(--bg-card)",
                          fontSize: "18px",
                          cursor: "pointer"
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Dates */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "var(--text-heading)", marginBottom: "8px" }}>
                        Ngày khởi hành
                      </label>
                      <select
                        value={departureDate}
                        onChange={(e) => setDepartureDate(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "12px",
                          border: "1px solid var(--border-light)",
                          borderRadius: "8px",
                          fontSize: "14px",
                          background: "var(--bg-input)",
                          color: "var(--text-main)"
                        }}
                      >
                        <option value="">Chọn ngày</option>
                        {selectedPackage.availableDates.map((date) => (
                          <option key={date} value={date}>{date}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "var(--text-heading)", marginBottom: "8px" }}>
                        Ngày kết thúc
                      </label>
                      <select
                        value={returnDate}
                        onChange={(e) => setReturnDate(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "12px",
                          border: "1px solid var(--border-light)",
                          borderRadius: "8px",
                          fontSize: "14px",
                          background: "var(--bg-input)",
                          color: "var(--text-main)"
                        }}
                      >
                        <option value="">Chọn ngày</option>
                        {selectedPackage.availableDates.map((date) => (
                          <option key={date} value={date}>{date}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Extras */}
                  <div style={{ marginBottom: "24px" }}>
                    <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-heading)", marginBottom: "16px" }}>
                      Dịch vụ bổ sung
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {extraServices.map((extra) => (
                        <label
                          key={extra.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "12px",
                            border: "1px solid var(--border-light)",
                            borderRadius: "8px",
                            cursor: "pointer"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <input
                              type="checkbox"
                              checked={selectedExtras.includes(extra.id)}
                              onChange={() => toggleExtra(extra.id)}
                            />
                            <span style={{ color: "#2563eb" }}>{extra.icon}</span>
                            <span style={{ fontSize: "14px", fontWeight: "500" }}>{extra.name}</span>
                          </div>
                          <span style={{ fontWeight: "600", color: "#2563eb" }}>
                            {extra.price.toLocaleString("vi-VN")}đ
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Promo Code */}
                  <div style={{ marginBottom: "24px" }}>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "var(--text-heading)", marginBottom: "8px" }}>
                      Mã khuyến mãi
                    </label>
                    <div style={{ display: "flex", gap: "12px" }}>
                      <input
                        type="text"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        placeholder="Nhập mã giảm giá"
                        style={{
                          flex: 1,
                          padding: "12px",
                          border: "1px solid var(--border-light)",
                          borderRadius: "8px",
                          fontSize: "14px",
                          background: "var(--bg-input)",
                          color: "var(--text-main)"
                        }}
                      />
                      <button
                        style={{
                          padding: "12px 24px",
                          background: "#2563eb",
                          color: "white",
                          border: "none",
                          borderRadius: "8px",
                          fontWeight: "600",
                          cursor: "pointer"
                        }}
                      >
                        Áp dụng
                      </button>
                    </div>
                  </div>

                  {/* Total */}
                  <div style={{
                    background: "var(--bg-hover)",
                    borderRadius: "12px",
                    padding: "20px",
                    marginBottom: "24px"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span>Giá gói cơ bản ({travelers} khách)</span>
                      <span style={{ fontWeight: "600" }}>{(selectedPackage.price * travelers).toLocaleString("vi-VN")}đ</span>
                    </div>
                    {selectedExtras.map(id => {
                      const extra = extraServices.find(e => e.id === id);
                      return (
                        <div key={id} style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", color: "var(--text-muted)" }}>
                          <span>+ {extra.name}</span>
                          <span>{extra.price.toLocaleString("vi-VN")}đ</span>
                        </div>
                      );
                    })}
                    <div style={{
                      borderTop: "1px solid var(--border-light)",
                      marginTop: "12px",
                      paddingTop: "12px",
                      display: "flex",
                      justifyContent: "space-between",
                      fontWeight: "700",
                      fontSize: "18px",
                      color: "#2563eb"
                    }}>
                      <span>Tổng cộng</span>
                      <span>{calculateTotal().toLocaleString("vi-VN")}đ</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button
                      onClick={() => setBookingStep("details")}
                      style={{
                        flex: 1,
                        padding: "14px",
                        background: "var(--bg-card)",
                        color: "var(--text-muted)",
                        border: "1px solid var(--border-light)",
                        borderRadius: "8px",
                        fontWeight: "600",
                        cursor: "pointer"
                      }}
                    >
                      Quay lại
                    </button>
                    <button
                      onClick={handleBookingSubmit}
                      style={{
                        flex: 2,
                        padding: "14px",
                        background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        fontWeight: "700",
                        cursor: "pointer"
                      }}
                    >
                      Tiến hành thanh toán
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Customer Info Form */}
            {bookingStep === "customerInfo" && selectedPackage && (
              <div style={{ maxWidth: "800px", margin: "0 auto" }}>
                <div style={{ background: "var(--bg-card)", borderRadius: "20px", padding: "32px" }}>
                  <h2 style={{ fontSize: "24px", fontWeight: "700", color: "var(--text-heading)", marginBottom: "24px" }}>
                    Thông tin khách hàng
                  </h2>
                  <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "20px" }}>Nhập thông tin cá nhân. Các ô có dấu * là bắt buộc.</p>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    {[{ label: "Họ *", key: "lastName" }, { label: "Tên & tên đệm *", key: "firstName" }].map(f => (
                      <div key={f.key}>
                        <label style={{ display: "block", fontSize: "14px", fontWeight: "600", marginBottom: "8px" }}>{f.label}</label>
                        <input value={customerInfo[f.key]}
                          onChange={e => setCustomerInfo(p => ({ ...p, [f.key]: e.target.value }))}
                          style={{ width: "100%", padding: "12px", borderRadius: "8px", border: customerErrors[f.key] ? "2px solid #ef4444" : "1px solid var(--border-light)", fontSize: "14px", boxSizing: "border-box", background: "var(--bg-input)", color: "var(--text-main)" }} />
                        {customerErrors[f.key] && <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>{customerErrors[f.key]}</div>}
                      </div>
                    ))}
                    <div>
                      <label style={{ display: "block", fontSize: "14px", fontWeight: "600", marginBottom: "8px" }}>Ngày sinh</label>
                      <input type="date" value={customerInfo.dob}
                        onChange={e => setCustomerInfo(p => ({ ...p, dob: e.target.value }))}
                        style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-light)", fontSize: "14px", boxSizing: "border-box", background: "var(--bg-input)", color: "var(--text-main)" }} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "14px", fontWeight: "600", marginBottom: "8px" }}>Quốc tịch</label>
                      <select value={customerInfo.nationality}
                        onChange={e => setCustomerInfo(p => ({ ...p, nationality: e.target.value }))}
                        style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-light)", fontSize: "14px", boxSizing: "border-box", background: "var(--bg-input)", color: "var(--text-main)" }}>
                        {["Việt Nam", "Nhật Bản", "Hàn Quốc", "Anh", "Mỹ", "Úc", "Khác"].map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "14px", fontWeight: "600", marginBottom: "8px" }}>Số điện thoại *</label>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <input readOnly value="+84" style={{ width: "64px", padding: "12px 8px", borderRadius: "8px", border: "1px solid var(--border-light)", background: "var(--bg-hover)", textAlign: "center", color: "var(--text-main)" }} />
                        <input value={customerInfo.phoneDigits}
                          onChange={e => setCustomerInfo(p => ({ ...p, phoneDigits: e.target.value.replace(/\D/g, "") }))}
                          placeholder="912345678"
                          style={{ flex: 1, padding: "12px", borderRadius: "8px", border: customerErrors.phoneDigits ? "2px solid #ef4444" : "1px solid var(--border-light)", fontSize: "14px", background: "var(--bg-input)", color: "var(--text-main)" }} />
                      </div>
                      {customerErrors.phoneDigits && <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>{customerErrors.phoneDigits}</div>}
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "14px", fontWeight: "600", marginBottom: "8px" }}>Email *</label>
                      <input type="email" value={customerInfo.email}
                        onChange={e => setCustomerInfo(p => ({ ...p, email: e.target.value }))}
                        style={{ width: "100%", padding: "12px", borderRadius: "8px", border: customerErrors.email ? "2px solid #ef4444" : "1px solid var(--border-light)", fontSize: "14px", boxSizing: "border-box", background: "var(--bg-input)", color: "var(--text-main)" }} />
                      {customerErrors.email && <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>{customerErrors.email}</div>}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
                    <button onClick={() => setBookingStep("booking")}
                      style={{ flex: 1, padding: "14px", background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border-light)", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}>
                      Quay lại
                    </button>
                    <button onClick={handleCustomerInfoSubmit}
                      style={{ flex: 2, padding: "14px", background: "linear-gradient(135deg, #2563eb, #1d4ed8)", color: "white", border: "none", borderRadius: "8px", fontWeight: "700", cursor: "pointer" }}>
                      Tiến hành thanh toán
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Payment - VNPay */}
            {bookingStep === "payment" && selectedPackage && (
              <div style={{ maxWidth: "600px", margin: "0 auto" }}>
                <div style={{ background: "var(--bg-card)", borderRadius: "20px", padding: "32px" }}>
                  <h2 style={{ fontSize: "24px", fontWeight: "700", color: "var(--text-heading)", marginBottom: "24px" }}>
                    Thanh toán
                  </h2>

                  {/* Booking Summary */}
                  <div style={{ border: "1px solid var(--border-main)", borderRadius: "12px", padding: "16px", marginBottom: "16px", background: "var(--bg-input)" }}>
                    <div style={{ fontWeight: "700", marginBottom: "8px", color: "#2563eb" }}>📦 Gói du lịch</div>
                    <div style={{ fontWeight: "700", fontSize: "16px" }}>{selectedPackage.title}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>{selectedPackage.duration} · {selectedPackage.departureCity} → {selectedPackage.destinationCity}</div>
                  </div>

                  <div style={{ border: "1px solid var(--border-main)", borderRadius: "12px", padding: "16px", marginBottom: "16px", background: "var(--bg-input)" }}>
                    <div style={{ fontWeight: "700", marginBottom: "8px", color: "#2563eb" }}>👤 Khách hàng</div>
                    <div style={{ fontSize: "14px" }}>
                      <b>{customerInfo.lastName} {customerInfo.firstName}</b>
                      <div style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>{customerInfo.email} · +84 {customerInfo.phoneDigits}</div>
                    </div>
                  </div>

                  {/* Total */}
                  <div style={{ background: "var(--bg-hover)", borderRadius: "12px", padding: "20px", marginBottom: "24px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span>Giá gói ({travelers} khách)</span>
                      <span style={{ fontWeight: "600" }}>{(selectedPackage.price * travelers).toLocaleString("vi-VN")}đ</span>
                    </div>
                    {selectedExtras.map(id => {
                      const extra = extraServices.find(e => e.id === id);
                      return (
                        <div key={id} style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", color: "var(--text-muted)" }}>
                          <span>+ {extra.name}</span><span>{extra.price.toLocaleString("vi-VN")}đ</span>
                        </div>
                      );
                    })}
                    <div style={{ borderTop: "1px solid var(--border-light)", marginTop: "12px", paddingTop: "12px", display: "flex", justifyContent: "space-between", fontWeight: "700", fontSize: "18px", color: "#2563eb" }}>
                      <span>Tổng cộng</span>
                      <span>{calculateTotal().toLocaleString("vi-VN")}đ</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button onClick={() => setBookingStep("customerInfo")}
                      style={{ flex: 1, padding: "14px", background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border-light)", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}>
                      Quay lại
                    </button>
                    <button onClick={handleVNPayPayment}
                      style={{ flex: 2, padding: "14px", background: "#005baa", color: "white", border: "none", borderRadius: "8px", fontWeight: "800", fontSize: "15px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                      <MdCreditCard /> Thanh toán qua VNPay
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default OrderByPackage;