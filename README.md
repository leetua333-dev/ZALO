# SmartLit AI

**Hệ thống Trợ lý & Đánh giá Tiến trình Ngữ văn** — bản thử nghiệm nghiên cứu, giao diện tiếng Việt. Dành cho việc kiểm chứng quy trình: ngữ liệu được duyệt → tương tác có dẫn nguồn → phản tư → giáo viên đánh giá sau phiên học.

## Bản demo có đường dẫn web

Đã có cấu hình xuất bản **GitHub Pages**. Xem [DEPLOYMENT.md](DEPLOYMENT.md) để bật Pages và cập nhật website. Bản demo lưu dữ liệu riêng trong trình duyệt của từng người xem, hỗ trợ các thao tác dùng thử và xuất Excel/PDF; chưa đồng bộ dữ liệu giữa giáo viên và học sinh. Bản máy chủ bên dưới lưu dữ liệu bằng SQLite.

Build website tĩnh bằng `npm run build:demo` (kết quả ở `dist-demo/`). Xuất bản bằng `npm run deploy:demo` sau khi kiểm tra quyền Git và cấu hình Pages.

## Chạy ứng dụng

Yêu cầu **Node.js 24 trở lên** (SQLite dùng trực tiếp qua `node:sqlite`). Không cần API key hoặc dịch vụ cơ sở dữ liệu bên ngoài.

```bash
cd /workspace/ZALO
npm ci --cache /tmp/smartlit-npm-cache
npm run dev
```

Giao diện Vite chạy ở cổng **5173**, chuyển tiếp `/api` đến Express ở cổng **3001**. Phông chữ tiếng Việt được đóng gói cùng ứng dụng, không tải từ dịch vụ phông chữ bên ngoài.

```bash
npm test       # Kiểm thử thuật toán, API, lưu trữ và xuất Excel
npm run build # Kiểm tra TypeScript và đóng gói
npm start     # Phục vụ giao diện đã build và API cùng cổng 3001
```

Đổi cổng máy chủ bằng `PORT`. Đổi vị trí SQLite bằng `SMARTLIT_DB_PATH`. Dữ liệu mặc định nằm trong `.data/smartlit.db`, bị loại khỏi Git. Dừng máy chủ trước khi sao lưu toàn bộ thư mục `.data` (SQLite có thể có WAL). Không xóa cơ sở dữ liệu đang sử dụng để nạp lại dữ liệu mẫu.

## Luồng dùng thử

1. **Tổng quan**: xem chỉ số được tính từ dữ liệu, chuyển lớp 11A1/11A2, tìm kiếm và chọn phiên cần đọc đối chiếu.
2. **Kho ngữ liệu**: thêm tên tác phẩm, tác giả, nguồn và nội dung; đọc lại rồi duyệt. Văn bản chưa duyệt không được đưa vào truy xuất. Có thể tạm ngừng truy xuất mà vẫn giữ lịch sử trích dẫn cũ.
3. **Tạo phiên học**: chọn học sinh, lớp, chủ đề và một ngữ liệu đã duyệt. Mở **Góc học sinh**, đặt câu hỏi và xem trích dẫn gắn với đoạn nguồn.
4. Nộp **bài phản tư 300–500 từ**. Phần đếm từ hiện dùng các đơn vị ngăn cách bằng khoảng trắng (phù hợp việc đếm “từ” theo quy ước bản thử nghiệm, chưa phải tách từ tiếng Việt).
5. Mở báo cáo học sinh: xem tổng hợp, sơ đồ tuần tự câu lệnh, nhật ký đầy đủ và đối soát đoạn phản tư với lời trợ lý.
6. Giáo viên sửa điểm/nhận xét và **xác nhận đánh giá**. Thêm tin nhắn hoặc cập nhật phản tư sẽ xóa điểm xác nhận cũ để giáo viên xem lại bằng chứng mới.
7. **Báo cáo & điểm số**: xuất `.xlsx` theo lớp đang chọn. Điểm gợi ý và điểm giáo viên xác nhận nằm ở hai cột riêng. Báo cáo từng học sinh hỗ trợ **In / lưu PDF** qua trình duyệt; bản in gồm tổng hợp một trang và trích đoạn phản tư.

Lần chạy đầu tạo **8 phiên học giả lập, 3 ngữ liệu mẫu**, được ghi rõ trên giao diện. Những phiên mới được phân biệt với dữ liệu minh họa. Dữ liệu được giữ sau khi khởi động lại; không tự đặt lại mỗi lần chạy.

## Bốn trụ cột: cơ chế đã có và giới hạn

| Trụ cột | Bản 0.1 đã thực hiện | Chưa có / cần nghiên cứu tiếp |
| --- | --- | --- |
| Ngữ liệu Việt Nam | Chia đoạn, xếp hạng từ khóa tiếng Việt trong văn bản đã duyệt của đúng phiên, trả trích đoạn nguyên văn kèm nguồn; từ chối khi không có đoạn phù hợp | Embedding, vector database, reranker và LLM được ràng buộc nguồn; kho SGK/SGV/phê bình được cấp phép, thẩm định chuyên môn |
| Nhật ký lệnh | Rubric 4 cấp theo quy tắc; nhãn phản biện, phân tách/liên hệ, yêu cầu dẫn chứng, nhờ làm hộ; lưu câu lệnh và lý do | Phân loại ngữ nghĩa, bộ dữ liệu gán nhãn, đánh giá độ chính xác với giáo viên |
| Đối soát kép | Bài phản tư liên kết nhật ký; phát hiện chuỗi **6 đơn vị từ vựng liên tiếp**, đánh dấu vị trí khớp; đọc đối chiếu từng đoạn | Semantic similarity / diễn đạt lại; không thể tự xác định tư duy độc lập, tác giả hoặc gian lận |
| Báo cáo sau phiên | Tổng hợp chỉ số thật, dấu vết tư duy, lời gợi ý, xác nhận điểm/nhận xét, Excel và bản in PDF | Google Classroom, LMS, sơ đồ ngữ nghĩa, rubric được kiểm định theo yêu cầu GDPT 2018 |

Truy xuất giới hạn nguồn **không bảo đảm loại bỏ hoàn toàn sai lệch**. Nội dung nguồn, cách đọc, phân loại câu lệnh và nhận xét cần được giáo viên kiểm chứng. Phần trả lời hiện là **trích xuất + câu hỏi gợi mở theo mẫu**, chưa phải trả lời sinh bởi LLM. Không có lời gọi đến dịch vụ AI hoặc tự truyền dữ liệu học sinh ra ngoài.

### Rubric thử nghiệm

- Cấp 1: yêu cầu làm hộ / viết bài để nộp.
- Cấp 2: tìm hiểu, làm rõ thông tin.
- Cấp 3: phân tách, so sánh, liên hệ.
- Cấp 4: chất vấn, phản biện, yêu cầu kiểm chứng cách hiểu.

Điểm gợi ý (/10) = prompt trung bình (/4) + độ đầy đủ phản tư (2 điểm khi 300–500 từ, 1 nếu ngoài khoảng) + có trích đoạn từ trợ lý (2) + có yêu cầu dẫn chứng (1) + có dấu hiệu chất vấn (1), chỉ tính khi đã có cả tương tác và phản tư. Không tự động trừ điểm do trùng từ vựng. Đây là công thức minh họa cho **quá trình**, chưa đo mức độ hiểu văn học và chưa phải chuẩn chấm điểm được công nhận.

## Kiến trúc

- `src/`: React 19, TypeScript, React Router, Lucide, CSS thích ứng máy tính/điện thoại.
- `server/index.mjs`: Express, kiểm tra đầu vào, API, SQLite, xuất ExcelJS và phục vụ bản build.
- `server/analysis.mjs`: truy xuất, rubric và đối sánh; độc lập với giao diện.
- `server/seed.mjs`: thơ thuộc phạm vi công cộng, ghi chú thử nghiệm và phiên học giả lập.
- `server/*.test.mjs`: kiểm thử bằng Node test runner, DB cô lập, không sửa dữ liệu phát triển.

Các API chính: `GET /api/health`, `GET /api/state`, `POST /api/sessions`, `POST /api/sessions/:id/messages`, `POST /api/sessions/:id/reflection`, `PATCH /api/sessions/:id/grade`, `POST /api/documents`, `PATCH /api/documents/:id`, `GET /api/export/grades.xlsx?className=11A1`.

## Phạm vi triển khai

Bản này sử dụng chuyển vai trò minh họa, **chưa có đăng nhập, phân quyền, tách dữ liệu theo trường hoặc đồng ý xử lý dữ liệu cá nhân**. Chỉ sử dụng dữ liệu giả trong môi trường nghiên cứu riêng. Trước khi thử với học sinh thật cần bổ sung xác thực, quyền truy cập, quyền riêng tư, chính sách lưu/xóa dữ liệu và kiểm định sư phạm. Không đưa bản này lên Internet như một dịch vụ cho học sinh thật.
