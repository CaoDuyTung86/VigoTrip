// Ảnh minh hoạ suất ăn nằm trong /public/suat an/. Cơ sở dữ liệu chỉ lưu tên và giá dịch vụ,
// nên ảnh được tra theo đúng tên dịch vụ mà AdditionalServiceSeeder ghi vào bảng dich_vu_bo_sung.
// Sửa tên ở seeder thì phải sửa key tương ứng tại đây.
const MEAL_IMAGES = {
  "Suất ăn - Combo Bánh chưng chà bông, hạt điều & nước suối": "/suat an/Combo Banh chung cha bong, hat dieu va nuoc suoi.jpg",
  "Suất ăn - Combo Bún xào Singapore, nước suối & hạt điều": "/suat an/Combo Bun xao Singapore va Nuoc suoi va Hat dieu.jpg",
  "Suất ăn - Combo Cơm chiên Thái, nước suối & hạt điều": "/suat an/Combo Com chien Thai va Nuoc suoi va Hat dieu.jpg",
  "Suất ăn - Combo Cơm chiên Dương Châu chay, nước suối & hạt điều": "/suat an/Combo Com chien duong chau chay va Nuoc suoi va Hat dieu.jpg",
  "Suất ăn - Combo Cơm thịt bò, hạt điều & nước suối": "/suat an/Combo Com thit bo, hat dieu va nuoc suoi.jpg",
  "Suất ăn - Combo Hattrick Bia, khô gà & chả giò": "/suat an/Combo Hattrick Bia, Kho ga va Cha gio.jpg",
  "Suất ăn - Combo Miến xào tôm cua, nước suối & hạt điều": "/suat an/Combo Mien xao Tom cua va Nuoc suoi va Hat dieu.jpg",
  "Suất ăn - Combo Mỳ Ý, nước suối & hạt điều": "/suat an/Combo My Y va Nuoc suoi va Hat dieu.jpg",
  "Suất ăn - Combo Penalty Soda dâu & hạt Macca": "/suat an/Combo Penalty Soda Dau va Hat Macca.jpg",
  "Suất ăn - Combo Xôi khúc giò, hạt điều & nước suối": "/suat an/Combo Xoi khuc gio, hat dieu va nuoc suoi.jpg",
  "Suất ăn - Combo Xôi mặn, hạt điều & nước suối": "/suat an/Combo Xoi man, hat dieu va nuoc suoi.jpg",
};

export const getMealImage = (serviceName) => MEAL_IMAGES[serviceName] || null;

export default MEAL_IMAGES;
