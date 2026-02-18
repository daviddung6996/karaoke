# Hướng Dẫn Build Karaoke Portable (Host + TV)

Tài liệu này hướng dẫn cách đóng gói ứng dụng Karaoke (bao gồm màn hình Host và màn hình TV) thành một thư mục `karaoke-portable` để có thể chạy trên máy khác mà không cần cài đặt môi trường phát triển phức tạp.

## 1. Yeu cầu chuẩn bị
- Máy tính đã cài đặt **Node.js** (phiên bản 18 trở lên).
- Mã nguồn dự án đã được tải về.

## 2. Cách Build (Đóng gói)

Mở Terminal tại thư mục gốc của dự án (`c:\my-apps\karaoke`) và chạy lệnh sau:

```bash
npm run package
```

**Quá trình này sẽ tự động thực hiện các bước:**
1.  Xóa thư mục `karaoke-portable` cũ (nếu có).
2.  Chạy lệnh `npm run build` để biên dịch mã nguồn React (Host + TV) thành file tĩnh tối ưu.
3.  Tạo thư mục `karaoke-portable`.
4.  Copy toàn bộ mã nguồn đã biên dịch (`dist`) vào đó.
5.  Copy file `server.js` (máy chủ Node nhẹ) và cài đặt các thư viện cần thiết cho bản portable.
6.  Tạo file `start.bat` để chạy nhanh.

## 3. Kết quả

Sau khi chạy xong, bạn sẽ thấy thư mục **`karaoke-portable`** được tạo ra.

**Thư mục này chứa:**
- `dist/`: Giao diện ứng dụng (HTML, CSS, JS).
- `server.js`: Web server.
- `start.bat`: File chạy ứng dụng trên Windows.
- `node_modules/`: Các thư viện cần thiết để chạy server.

## 4. Cách Sử Dụng (Chạy App)

1.  Copy trọn vẹn thư mục **`karaoke-portable`** sang máy tính cần dùng (máy này cần có Node.js cài sẵn để chạy `server.js`).
2.  Chạy file **`start.bat`**.
3.  Một cửa sổ đen (CMD) hiện lên báo "Karaoke Server Ready". **Không tắt cửa sổ này.**
4.  Trình duyệt sẽ tự động mở địa chỉ: `http://localhost:5173`.

## 5. Lưu ý
- Đây chỉ là bản build cho **Host (Điều khiển)** và **TV (Màn hình chiếu)**.
- Giao diện **Customer Web (Chọn bài trên điện thoại)** không nằm trong gói này (như yêu cầu của bạn).
- Nếu muốn tắt server, chỉ cần tắt cửa sổ đen (CMD).
