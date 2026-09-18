// @ts-check
// Validate hành khách: định dạng ngày sinh, ngày sinh có thực sự tồn tại,
// không ở tương lai, và tuổi phù hợp với loại hành khách (Adult/Child/Infant)
// tại thời điểm khởi hành. Đây chỉ là validate định dạng/hợp lý — không xác
// thực danh tính thật (không đối chiếu CCCD), việc đó do nhân viên soát vé
// thực hiện.

const DOB_FORMAT_REGEX = /^\d{2}\/\d{2}\/\d{4}$/;

// Parse "DD/MM/YYYY" thành Date, trả về null nếu ngày không tồn tại thật
// (VD 31/02/2024, 30/02/2024, 32/01/2024...)
export const parseDobStrict = (dobStr) => {
  if (!DOB_FORMAT_REGEX.test(dobStr)) return null;
  const [dd, mm, yyyy] = dobStr.split('/').map(Number);
  if (mm < 1 || mm > 12 || dd < 1) return null;
  const date = new Date(yyyy, mm - 1, dd);
  if (
    date.getFullYear() !== yyyy ||
    date.getMonth() !== mm - 1 ||
    date.getDate() !== dd
  ) {
    return null;
  }
  return date;
};

const ageAt = (dob, referenceDate) => {
  let age = referenceDate.getFullYear() - dob.getFullYear();
  const beforeBirthdayThisYear =
    referenceDate.getMonth() < dob.getMonth() ||
    (referenceDate.getMonth() === dob.getMonth() && referenceDate.getDate() < dob.getDate());
  if (beforeBirthdayThisYear) age -= 1;
  return age;
};

const AGE_RANGE_BY_TYPE = {
  INFANT: { min: 0, max: 1 },
  CHILD: { min: 2, max: 11 },
  ADULT: { min: 12, max: 120 },
};

// referenceDate: ngày dùng để tính tuổi hành khách (mặc định ngày khởi hành,
// nếu không có thì dùng ngày hiện tại)
export const validatePassengerDob = (dobStr, passengerType, referenceDate = new Date()) => {
  if (!dobStr) return 'required';

  const dob = parseDobStrict(dobStr);
  if (!dob) return 'invalid';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (dob > today) return 'future';

  const range = AGE_RANGE_BY_TYPE[passengerType];
  if (range) {
    const age = ageAt(dob, referenceDate);
    if (age < range.min || age > range.max) return 'ageMismatch';
  }

  return null;
};
