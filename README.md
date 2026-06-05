# Coffee Shop Chain POS (Point of Sale) System

Hệ thống quản lý bán hàng (POS) phân quyền dành cho chuỗi cửa hàng cà phê (Coffee Shop Chain). Dự án được thiết kế với mục tiêu xây dựng một ứng dụng web nhẹ, nhanh chóng, không sử dụng framework hay build tool, chạy trực tiếp trên môi trường máy chủ PHP/MySQL tiêu chuẩn.

---

## 📌 Các Tính Năng Chính

Dự án cung cấp 4 phân hệ chính tương ứng với các vai trò (Roles) trong chuỗi cửa hàng:

### 1. Phân hệ Đăng nhập & Xác thực (Authentication)
* Form đăng nhập hợp nhất bảo mật sử dụng cơ chế **PHP Session** kết hợp mã hóa mật khẩu bằng `password_hash()` (mã hóa BCRYPT).
* Tự động nhận diện vai trò của nhân viên sau khi đăng nhập thành công và chuyển hướng (redirect) về màn hình làm việc tương ứng.
* Tự động bảo vệ các endpoint API và các trang giao diện thông qua cơ chế kiểm tra quyền hạn (`require_login` và `require_role`).

### 2. Giao diện Bán hàng Touchscreen (`pos.html`)
*Dành cho vai trò **Barista** (Nhân viên pha chế) và **Shift Lead** (Trưởng ca):*
* **Tạo đơn hàng mới (New Order Flow):** 
  * Duyệt thực đơn theo danh mục (Espresso, Cold Brew, Trà, Đồ ăn).
  * Lựa chọn kích cỡ (Size), nhiệt độ (Temperature), loại sữa (Milk), mức đường (Sweetness) và các món thêm (Add-ons).
  * Giỏ hàng (Cart Review) hỗ trợ chọn loại đơn hàng (Dine-in, Takeaway, Pickup) và chọn bàn hoặc khách hàng thân thiết.
  * Thanh toán (Payment) bằng nhiều phương thức (Tiền mặt, Thẻ, Chuyển khoản qua di động).
* **Quản lý hàng chờ pha chế (Prep Queue):** Theo dõi và chuyển đổi trạng thái đơn hàng thời gian thực (Pending → Preparing → Served).
* **Quản lý bàn (Tables):** Xem trạng thái các bàn (Available, Occupied) theo chi nhánh hiện tại.
* **Lịch sử đơn hàng (Order History):** Tra cứu danh sách đơn hàng đã thực hiện.
* **Tính năng dành riêng cho Trưởng ca (Shift Lead Only):**
  * Hủy đơn / Hoàn tiền (Voids & Refunds).
  * Quản lý két tiền mặt (Cash Drawer).
  * Điểm danh đầu/cuối ca (Clock In/Out).
  * Đóng ca làm việc (Shift Close).

### 3. Trang Quản lý Chi nhánh (`manager.html`)
*Dành cho vai trò **Store Manager** (Quản lý cửa hàng):*
* **Quản lý chi nhánh (Branch):** 
  * Dashboard tổng quan doanh số và số lượng đơn hàng của chi nhánh.
  * Theo dõi mức độ tồn kho của các nguyên liệu tại chi nhánh (Inventory Levels).
  * Cảnh báo nguyên liệu sắp hết dựa trên ngưỡng thiết lập (Low-Stock Alerts).
  * Điều chỉnh kho hàng thủ công (Stock Adjustments).
* **Báo cáo doanh số (Reports):**
  * Báo cáo doanh số theo từng món ăn/đồ uống (Sales by Item).
  * Báo cáo tần suất bán hàng theo giờ (Sales by Hour).
  * Phân tích doanh thu từ các món chọn thêm (Modifier Analysis).
* **Quản lý nhân sự (Staff):** Xem lịch làm việc (Schedule) và danh sách phân ca (Roster).

### 4. Trang Quản trị Hệ thống (`admin.html`)
*Dành cho vai trò **Admin** (Quản trị viên chuỗi):*
* **Quản lý thực đơn (Menu Management):** Quản lý Danh mục (Categories), Món ăn (Menu Items), Nhóm modifier (Modifier Groups), Tùy chọn modifier (Modifier Options) và liên kết Món ăn ↔ Modifier.
* **Chương trình khuyến mãi (Promotions):** Quản lý và tạo mới các chương trình giảm giá tự động (phần trăm hoặc số tiền cố định).
* **Vận hành chuỗi (Chain Operations):** Xem thông tin tất cả chi nhánh và biểu đồ doanh thu toàn chuỗi (Chain Dashboard).
* **Báo cáo chuỗi (Reports):** Doanh thu theo từng chi nhánh, Các món bán chạy nhất (Best Sellers), Phân tích doanh thu modifier, Khách hàng thân thiết tích điểm nhiều nhất.
* **Nhật ký hệ thống (Audit):** Xem lịch sử thao tác nhạy cảm của nhân viên (Audit Log).

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

Hệ thống tuân thủ nguyên tắc giữ cho mã nguồn **đơn giản nhất có thể**, không sử dụng framework cồng kềnh hay các công cụ biên dịch (build tools):

| Thành phần | Công nghệ | Chi tiết |
|---|---|---|
| **Database** | MariaDB / MySQL | Gồm 18 bảng quan hệ tối ưu hóa cùng 1 View tổng hợp điểm tích lũy của khách hàng. |
| **Backend** | PHP Thuần | Kết nối cơ sở dữ liệu qua thư viện `mysqli`, sử dụng Prepared Statements để ngăn chặn SQL Injection. |
| **Frontend** | HTML5, CSS3, ES6 JS | Sử dụng CSS thuần tối ưu hiệu năng và mã nguồn JavaScript thuần (`Fetch API`) để trao đổi dữ liệu JSON với Backend. |
| **Bảo mật** | PHP Native Sessions | Kiểm tra phân quyền truy cập trực tiếp tại máy chủ. |
| **Máy chủ** | Apache (XAMPP / Laragon) | Hoặc máy chủ tích hợp sẵn của PHP (`php -S localhost:8000`). |

---

## 📁 Cấu Trúc Thư Mục Dự Án

```markdown
Final_INS3060/
├── sql/                        # Tập lệnh SQL khởi tạo CSDL
│   ├── 01_schema.sql           # Cấu trúc 18 bảng và 1 view
│   ├── 02_sample_data.sql      # Dữ liệu mẫu (2 chi nhánh, 7 nhân viên, 5 khách hàng, đơn hàng mẫu)
│   ├── 03_queries.sql          # Các câu truy vấn mẫu giải quyết 6 Use Cases
│   └── 04_auth.sql             # Cập nhật trường password_hash cho bảng staff
├── api/                        # Các API Endpoint xử lý phía Backend (PHP)
│   ├── db.php                  # Kết nối CSDL MySQL
│   ├── _helpers.php            # Hàm tiện ích (JSON output, kiểm tra đăng nhập/phân quyền)
│   ├── auth.php                # Đăng nhập, đăng xuất và lấy thông tin phiên hiện tại
│   ├── setup_db.php            # Thiết lập mã hóa mật khẩu mặc định cho các nhân viên mẫu
│   ├── create_order.php        # API chính xử lý Tạo đơn hàng (Transaction)
│   └── [các endpoint khác].php # Các API truy vấn dữ liệu báo cáo, thực đơn, tồn kho,...
├── web/                        # Giao diện ứng dụng phía Frontend
│   ├── index.html              # Màn hình Đăng nhập
│   ├── pos.html                # Màn hình dành cho Barista / Shift Lead
│   ├── manager.html            # Màn hình dành cho Store Manager
│   ├── admin.html              # Màn hình dành cho Admin
│   ├── css/
│   │   └── style.css           # File CSS chung của dự án (hỗ trợ responsive và giao diện hiện đại)
│   └── js/
│       ├── api.js              # Wrapper Fetch API dùng chung để gửi yêu cầu tới API
│       ├── pos.js              # Logic nghiệp vụ bán hàng
│       ├── manager.js          # Logic nghiệp vụ quản lý chi nhánh
│       └── admin.js            # Logic nghiệp vụ quản trị chuỗi
├── plan/                       # Kế hoạch và tài liệu phân tích thiết kế
│   ├── goal.md                 # Mục tiêu dự án
│   ├── techstack.md            # Đặc tả công nghệ sử dụng
│   └── timeline.md             # Lộ trình 6 giai đoạn phát triển
├── run.bat                     # File script tự động kiểm tra PHP và chạy nhanh server trên Windows
└── README.md                   # Hướng dẫn này
```

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### Bước 1: Chuẩn bị môi trường
* Máy tính của bạn cần cài đặt **PHP** (phiên bản 7.4 trở lên) và **MySQL / MariaDB**.
* *Khuyên dùng:* Cài đặt gói công cụ **XAMPP** hoặc **Laragon** để nhanh chóng có cả PHP và MySQL.

### Bước 2: Thiết lập Cơ sở dữ liệu
1. Mở công cụ quản lý cơ sở dữ liệu của bạn (ví dụ: MySQL Workbench, phpMyAdmin).
2. Tạo một cơ sở dữ liệu tên là `final` (hoặc chạy trực tiếp file SQL).
3. Import lần lượt các file SQL theo thứ tự:
   * [sql/01_schema.sql](file:///c:/Users/BAN%20AI-02/Downloads/db/Final_INS3060/sql/01_schema.sql)
   * [sql/02_sample_data.sql](file:///c:/Users/BAN%20AI-02/Downloads/db/Final_INS3060/sql/02_sample_data.sql)

### Bước 3: Cấu hình thông tin kết nối
Mở file [api/db.php](file:///c:/Users/BAN%20AI-02/Downloads/db/Final_INS3060/api/db.php) và cấu hình lại các hằng số kết nối phù hợp với tài khoản MySQL của bạn:
```php
define('DB_HOST', 'localhost');
define('DB_USER', 'root');         // Tên đăng nhập MySQL của bạn
define('DB_PASS', 'tqqnnmmhh68');   // Mật khẩu MySQL của bạn
define('DB_NAME', 'final');
```

### Bước 4: Khởi tạo mật khẩu mã hóa cho dữ liệu mẫu
Hệ thống sử dụng mật khẩu thật được mã hóa bảo mật. Bạn cần kích hoạt script khởi tạo mật khẩu một lần bằng cách:
* Truy cập đường dẫn sau trên trình duyệt: `http://localhost:8000/api/setup_db.php`
* Hoặc chạy trực tiếp file này bằng PHP CLI: `php api/setup_db.php`
* *Kết quả thành công:* Hệ thống sẽ báo cập nhật mật khẩu mặc định thành công cho 7 nhân viên mẫu.

### Bước 5: Khởi chạy máy chủ
* **Cách 1 (Nhanh nhất trên Windows):** Click đúp vào file [run.bat](file:///c:/Users/BAN%20AI-02/Downloads/db/Final_INS3060/run.bat). Script sẽ tự dò đường dẫn cài đặt PHP (XAMPP, Laragon, hoặc hệ thống) và tự khởi động máy chủ tại cổng `8000` đồng thời tự động mở trình duyệt đến giao diện đăng nhập.
* **Cách 2 (Thủ công bằng CLI):** Mở terminal tại thư mục gốc dự án và chạy lệnh:
  ```bash
  php -S localhost:8000
  ```
* Truy cập hệ thống tại địa chỉ: **[http://localhost:8000/web/index.html](http://localhost:8000/web/index.html)**

---

## 🔑 Tài Khoản Thử Nghiệm Mẫu

Sau khi chạy xong script khởi tạo mật khẩu ở **Bước 4**, mật khẩu mặc định của tất cả nhân viên mẫu được quy ước là: **`[tên viết thường không dấu của nhân viên]123`**.

Dưới đây là danh sách tài khoản mẫu có sẵn trong CSDL:

| ID | Nhân viên | Vai trò (Role) | Chi nhánh mặc định | Mật khẩu mẫu | Giao diện hiển thị |
|---|---|---|---|---|---|
| **1** | James Carter | **Admin** | Downtown Branch | `james123` | [admin.html](file:///c:/Users/BAN%20AI-02/Downloads/db/Final_INS3060/web/admin.html) |
| **2** | Sarah Nguyen | **StoreManager** | Downtown Branch | `sarah123` | [manager.html](file:///c:/Users/BAN%20AI-02/Downloads/db/Final_INS3060/web/manager.html) |
| **3** | Tom Pham | **StoreManager** | Airport Branch | `tom123` | [manager.html](file:///c:/Users/BAN%20AI-02/Downloads/db/Final_INS3060/web/manager.html) |
| **4** | Lisa Tran | **ShiftLead** | Downtown Branch | `lisa123` | [pos.html](file:///c:/Users/BAN%20AI-02/Downloads/db/Final_INS3060/web/pos.html) *(có quyền Shift Lead)* |
| **5** | Kevin Le | **Barista** | Downtown Branch | `kevin123` | [pos.html](file:///c:/Users/BAN%20AI-02/Downloads/db/Final_INS3060/web/pos.html) |
| **6** | Minh Hoang | **Barista** | Downtown Branch | `minh123` | [pos.html](file:///c:/Users/BAN%20AI-02/Downloads/db/Final_INS3060/web/pos.html) |
| **7** | Lan Vo | **Barista** | Airport Branch | `lan123` | [pos.html](file:///c:/Users/BAN%20AI-02/Downloads/db/Final_INS3060/web/pos.html) |

---

## 🛡️ Nguyên Tắc Thiết Kế Cơ Sở Dữ Liệu Quan Trọng

Khi phát triển thêm tính năng cho dự án, vui lòng tuân thủ các nguyên tắc thiết kế cốt lõi sau:

1. **Ràng buộc Toàn vẹn Giá bán (Price Integrity Rule):**
   * Giá gốc của món ăn (`menu_item.base_price`) và tùy chọn thêm (`modifier_option.price_delta`) có thể thay đổi trong tương lai.
   * Để hóa đơn cũ không bị thay đổi số tiền khi xem lại, hệ thống lưu trữ **Snapshot giá bán tại thời điểm mua** trong bảng `order_item.unit_price` và `order_item_modifier.price_delta_at_sale`.
2. **Giao dịch Toàn vẹn (Database Transactions):**
   * Luồng thanh toán tạo đơn hàng mới được bọc hoàn toàn trong 1 Database Transaction ở file [api/create_order.php](file:///c:/Users/BAN%20AI-02/Downloads/db/Final_INS3060/api/create_order.php).
   * Mọi thao tác bao gồm: Tạo đơn (`orders`) → Thêm món (`order_item`) → Thêm tùy chọn (`order_item_modifier`) → Ghi nhận thanh toán (`payment`) → Tích lũy điểm khách hàng (`loyalty_transaction`) → Cập nhật bàn (`dining_table`) → Ghi nhật ký thao tác (`audit_log`) phải cùng thành công, hoặc cùng bị phục hồi (Rollback) nếu xảy ra lỗi giữa chừng để tránh rò rỉ dữ liệu.
3. **Tính toán Điểm khách hàng thân thiết:**
   * Số điểm `customer.loyalty_points` chỉ được dùng làm bộ nhớ đệm hiển thị nhanh.
   * Nguồn dữ liệu đáng tin cậy nhất (Source of Truth) phải được tính từ tổng số điểm tích lũy và quy đổi trong bảng lịch sử giao dịch `loyalty_transaction` thông qua View `v_customer_loyalty_balance`.