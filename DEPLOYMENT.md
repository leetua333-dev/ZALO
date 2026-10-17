# Xuất bản bản demo SmartLit AI

Bản demo GitHub Pages hoạt động trên trình duyệt, không cần API key, máy chủ Node hoặc cơ sở dữ liệu trực tuyến. Mỗi người xem có một bộ dữ liệu dùng thử riêng trong `localStorage`; tải lại trang vẫn giữ dữ liệu, nhưng thiết bị/trình duyệt khác không thấy những thay đổi đó. Chỉ dùng dữ liệu giả. Mã nguồn Node/SQLite vẫn có quy trình chạy riêng trong README.

## Bật website trong GitHub

Có thể kiểm tra và sửa cấu hình trực tiếp bằng API, sử dụng xác thực GitHub CLI hiện có:

```bash
npm run pages:configure
```

Lệnh này cần truy cập mạng tới `api.github.com` và quyền quản trị Pages phù hợp. Lệnh kiểm tra cấu hình trước, chọn `gh-pages` ở thư mục gốc, giữ nguyên tên miền tùy chỉnh nếu có và kiểm tra trạng thái build. Đường dẫn in ra lấy từ phản hồi GitHub; trạng thái cấu hình thành công chưa thay thế việc mở và kiểm tra website. Lỗi mạng 403 của proxy cần được giải quyết trong cài đặt môi trường, không phải bằng cách gửi token trong chat.

Sau khi nhánh `gh-pages` đã được đẩy lên kho `leetua333-dev/ZALO`:

1. Mở kho trên GitHub → **Settings → Pages**.
2. Trong **Build and deployment**, chọn **Source: Deploy from a branch**.
3. Chọn nhánh **gh-pages**, thư mục **/ (root)**, rồi **Save**.
4. Chờ GitHub hoàn tất xuất bản. Dùng địa chỉ được GitHub hiển thị ở phần Pages; chỉ coi website đã hoạt động sau khi mở được trang và thử một thao tác.

Nếu GitHub không cho chọn Pages, kiểm tra quyền quản trị kho, trạng thái tài khoản và gói GitHub áp dụng cho kho riêng tư. Không cần đổi kho riêng tư sang công khai khi chưa có chủ ý chia sẻ mã nguồn. Không gửi mật khẩu hoặc token qua chat.

## Cập nhật bản demo

Yêu cầu Node.js 24+, Git và quyền ghi vào kho gốc:

```bash
npm ci --cache /tmp/smartlit-npm-cache
npm test
npm run build:demo
node scripts/publish-demo.mjs        # Thử quyền xuất bản, không thay đổi nhánh từ xa
node scripts/publish-demo.mjs --push # Đẩy bản demo đã build lên gh-pages
```

Hoặc `npm run deploy:demo` để build và đẩy trong một lệnh. Script không bật Pages hoặc tạo tài khoản hosting. Script dùng xác thực Git hiện có, một index tạm riêng, không force push và không đưa `.data`/SQLite hoặc thông tin xác thực lên web. Nhánh `gh-pages` chứa các tệp website; mã nguồn ứng dụng nằm ở nhánh `main`.

Mặc định bản demo dùng đường dẫn dự án `/ZALO/`. Nếu xuất bản dưới tên khác, đặt `SMARTLIT_BASE_PATH` khi build, ví dụ `/smartlit/`. Định tuyến hash (`#/sessions`, `#/corpus`) cho phép tải lại và mở đường dẫn con trên hosting tĩnh.

## Chức năng trên bản demo web

- Ngữ liệu đã duyệt, câu lệnh và phản tư dùng cùng thuật toán với bản máy chủ.
- Thêm/duyệt văn bản, tạo phiên học, trò chuyện trích xuất, nộp phản tư và xác nhận điểm được lưu tại trình duyệt.
- Excel được tạo trong trình duyệt; PDF dùng chức năng in.
- Không gửi phiên học hoặc bài viết tới backend/AI. Khi mở trang, trình duyệt vẫn tải tài nguyên website từ GitHub Pages; đây không phải chế độ ngoại tuyến hoàn chỉnh.
- Không có tài khoản, chia sẻ dữ liệu giữa giáo viên và học sinh, đồng bộ thiết bị hoặc quản lý lớp thực tế.

Để sử dụng chung dữ liệu giữa nhiều người cần triển khai bản máy chủ, bổ sung đăng nhập/phân quyền và lưu trữ bền vững. Không dùng GitHub Pages để phục vụ các API Node/SQLite.
