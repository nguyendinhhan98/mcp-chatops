# 🚀 ChatOps++ — Chrome Extension (Manifest V3)

[![Version](https://img.shields.io/badge/version-3.6.4-blue.svg)](https://chrome.google.com/webstore/devconsole/)
[![Platform](https://img.shields.io/badge/platform-Chrome%20%7C%20Edge%20%7C%20Opera-lightgrey.svg)]()
[![Manifest Version](https://img.shields.io/badge/manifest-V3-orange.svg)]()

**ChatOps++** là một tiện ích mở rộng (Chrome Extension) mạnh mẽ, được thiết kế để tối ưu hóa và tăng hiệu suất làm việc lên tới 1000% cho người dùng sử dụng Mattermost tại `https://chat.runsystem.vn`. Extension bổ sung các tính năng quản lý công việc, ghi chú, tìm kiếm nâng cao và các phím tắt phản hồi nhanh.

---

## ✨ Các Tính Năng Nổi Bật

### 🎯 1. Quản Lý Công Việc (Tasks)
* Tạo task nhanh chóng trực tiếp từ bất kỳ tin nhắn nào trên Mattermost.
* Đặt lịch nhắc nhở (Reminder) thông qua Chrome Alarms tích hợp thông báo đẩy tiện dụng.
* Quản lý trạng thái task (Pending, In Progress, Done) với giao diện trực quan.
* Hỗ trợ tính năng **Nhắc nhở công việc nhóm định kỳ hằng ngày (Group Reminder)**: Tự động gửi tin nhắn nhắc nhở vào các kênh/nhóm chat của Mattermost theo khung giờ cấu hình sẵn, hỗ trợ định dạng văn bản (in đậm, in nghiêng, code, trích dẫn, gạch ngang) và tag tên thành viên trực tiếp trong nội dung tin nhắn.

### 📒 2. Ghi Chú Nhanh (Notes/Memos)
* Lưu trữ các ghi chú quan trọng từ tin nhắn hoặc tự viết nhanh.
* Phân loại ghi chú theo từng chủ đề/dự án (Categories) dễ dàng tìm kiếm.
* Hỗ trợ đồng bộ hóa đám mây thông minh qua `chrome.storage.sync` (chia nhỏ dữ liệu để vượt giới hạn 8KB của Google).
* Tích hợp **Mẫu chèn nhanh (Quick Template Picker)**, **Tạo công việc (Quick Task Creator)** và **Tạo phòng họp Google Meet nhanh**: Cho phép chèn nhanh ghi chú làm mẫu báo cáo (biểu tượng `📒`), tạo công việc nhanh (biểu tượng `🎯` pre-fill nội dung đang gõ) hoặc tạo nhanh phòng họp Google Meet (sử dụng biểu tượng logo Google Meet SVG, tự động mở tab mới khởi tạo cuộc họp thật hợp lệ và chèn link vào khung chat) trực tiếp từ ô chat Mattermost (khung chat chính & reply).

### 🔍 3. Tìm Kiếm Nâng Cao (Advanced Search)
* Tìm kiếm các bài viết (posts) theo nhiều bộ lọc kết hợp: Từ khóa, người gửi, channel cụ thể, và khoảng thời gian.
* Giao diện xem kết quả tìm kiếm chi tiết, cho phép điều hướng thẳng tới bài viết gốc.
* Tích hợp biểu tượng `🔍` ở thanh header đầu trang giúp mở nhanh giao diện tìm kiếm nâng cao dưới dạng modal.

### 🔔 4. Quét Lượt Nhắc Tên (Mentions Tracker)
* Tự động quét và liệt kê tất cả các lượt nhắc tên (`@mentions`) chưa đọc trên toàn bộ các kênh (channels) giúp bạn không bao giờ bỏ lỡ tin nhắn quan trọng.
* Tích hợp biểu tượng `🔔` ở thanh header đầu trang giúp mở nhanh giao diện quét lượt nhắc tên dưới dạng modal.

### 🖼️ 5. Thư Viện Ảnh & Giphy (Image Picker & Editor)
* Tích hợp thư viện ảnh Meme tùy chỉnh cá nhân.
* Kết nối trực tiếp với Giphy API để tìm và gửi ảnh động (GIF) nhanh chóng.
* Bộ chỉnh sửa ảnh (image editor) cơ bản tích hợp sẵn, hỗ trợ **tự vẽ nét tự do từ ảnh tải lên hoặc dán trực tiếp từ clipboard** (Draw from custom image upload/paste from clipboard).
* Thêm tab quản lý **Files & Hình ảnh (Files)** riêng biệt ngay trong phần công cụ khác (và shortcut tab ở navigation header) cho phép tìm kiếm theo tên và chuyển trang (pagination) mượt mà.

### 🔥 6. Tương Tác Nhanh (Quick Reactions)
* Cho phép thả hàng loạt biểu cảm (spam react) vào post.
* Tính năng sao chép (clone) emoji reaction từ post này sang post khác.
* Thu hồi toàn bộ reaction cá nhân chỉ với một thao tác.

---

## 🛠️ Công Nghệ Sử Dụng

* **Core:** HTML, CSS thuần (Vanilla CSS), JavaScript ESM (ES Modules).
* **Kiến trúc:** Chrome Extension Manifest V3.
  * **Service Worker (Background):** Quản lý cookie sync, alarms nhắc nhở và điều hướng Side Panel.
  * **Content Scripts:** Can thiệp an toàn vào DOM của Mattermost, sử dụng React Fiber Bridge để tương tác trực tiếp với giao diện trò chuyện.
  * **Side Panel UI:** Cung cấp thanh tiện ích bên cạnh (native panel) giúp tương tác song song khi đang làm việc.
* **Thư viện tích hợp:** `flatpickr` (Date Picker), `gifenc` (GIF encoder).

---

## 📂 Cấu Trúc Dự Án

```
chatops_mcp/
└── chrome-extension/
    ├── manifest.json              # Khai báo quyền, script và cấu hình MV3
    ├── package.json               # Metadata dự án
    ├── content/                   # Content Scripts (chạy trực tiếp trên Mattermost)
    │   ├── content.js             # Logic xử lý giao diện Mattermost chính
    │   └── content.css            # Styles cho các thành phần UI tiêm vào trang
    ├── sidepanel/                 # Giao diện side panel của Chrome
    │   ├── sidepanel.html         # Giao diện chính của tiện ích
    │   └── tabs/                  # Code xử lý logic cho từng Tab (Tasks, Memo,...)
    └── src/                       # Thư mục chứa code logic dùng chung (Shared ESM)
        ├── background.js          # Service Worker chính
        ├── api/                   # Gọi API của Mattermost
        └── utils/                 # Các hàm tiện ích hỗ trợ định dạng, thời gian
```

---

## 💻 Hướng Dẫn Phát Triển & Cài Đặt Dưới Local

Để chạy thử nghiệm hoặc phát triển tiếp extension trên máy cá nhân của bạn, hãy làm theo các bước sau:

### 1. Tải Mã Nguồn
Tải mã nguồn về máy:
```bash
git clone https://github.com/nguyendinhhan98/mcp-chatops.git
cd mcp-chatops/chrome-extension
```

### 2. Cài Đặt Trên Trình Duyệt Chrome
1. Mở trình duyệt Google Chrome và truy cập vào địa chỉ: `chrome://extensions/`.
2. Kích hoạt **Chế độ dành cho nhà phát triển** (Developer mode) ở góc trên cùng bên phải.
3. Click vào nút **Tải tiện ích đã giải nén** (Load unpacked) ở góc trên bên trái.
4. Chọn thư mục `chrome-extension` trong thư mục dự án của bạn.
5. Biểu tượng **ChatOps++** sẽ xuất hiện trên thanh công cụ tiện ích của Chrome.

### 3. Cấu Hình Ban Đầu
1. Truy cập vào trang Mattermost của công ty tại: `https://chat.runsystem.vn` và đăng nhập.
2. Mở **Side Panel** của ChatOps++ bằng cách click vào biểu tượng extension hoặc click vào nút toggle được thêm trực tiếp trên giao diện Mattermost.
3. Vào tab **Cài đặt (Settings)** để thiết lập:
   * Giao diện, màu sắc chủ đạo, thứ tự các tab hiển thị.

---

## 🔒 Chính Sách Quyền Riêng Tư (Privacy Policy)

Dữ liệu của bạn hoàn toàn bảo mật. Chi tiết xem tại [PRIVACY_POLICY.md](./PRIVACY_POLICY.md).
* ChatOps++ xử lý mọi thông tin (ghi chú, tác vụ, cài đặt) **ngay tại máy cục bộ của bạn** qua `chrome.storage.local`.

---

## 📝 Đóng Góp Ý Kiến (Contribution)

Mọi đóng góp, báo lỗi hoặc yêu cầu thêm tính năng mới xin vui lòng:
1. Tạo một **Issue** trên kho lưu trữ này.
2. Hoặc gửi các bản vá thông qua **Pull Request**.

Xem thêm hướng dẫn chi tiết cho lập trình viên tại [AGENTS.md](./AGENTS.md).
