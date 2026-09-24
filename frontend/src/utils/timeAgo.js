/**
 * Định dạng thời gian tương đối bằng Tiếng Việt (ví dụ: "Vừa xong", "5 phút trước", "2 giờ trước")
 * @param {string|number|Date} dateInput
 * @returns {string}
 */
export function formatTimeAgo(dateInput) {
  if (!dateInput) return '';

  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const elapsedSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  // Nếu thời gian trong tương lai hoặc chưa quá 30 giây
  if (elapsedSeconds < 30) {
    return 'Vừa xong';
  }

  // Dưới 1 phút
  if (elapsedSeconds < 60) {
    return `${elapsedSeconds} giây trước`;
  }

  // Dưới 1 giờ
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) {
    return `${minutes} phút trước`;
  }

  // Dưới 24 giờ
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} giờ trước`;
  }

  // Dưới 7 ngày
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days} ngày trước`;
  }

  // Trên 7 ngày: hiển thị ngày/tháng/năm
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}
