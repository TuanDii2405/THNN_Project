# TIỂU LUẬN

## Phần Mở Đầu

Trong bối cảnh toàn cầu hóa và chuyển đổi số đang diễn ra mạnh mẽ trên mọi lĩnh vực của đời sống xã hội, việc ứng dụng các công nghệ hiện đại vào quản lý, vận hành và bảo mật thông tin trở thành một yêu cầu tất yếu. Đặc biệt, trong thời đại mà dữ liệu cá nhân, tài sản số và các giao dịch trực tuyến ngày càng gia tăng về số lượng và giá trị, vấn đề xác thực danh tính người dùng đóng vai trò then chốt trong việc đảm bảo an toàn, bảo mật và nâng cao trải nghiệm người dùng.

Các phương pháp xác thực truyền thống như sử dụng mật khẩu, mã PIN, thẻ từ,... đã và đang bộc lộ nhiều hạn chế nghiêm trọng. Người dùng thường xuyên gặp phải các vấn đề như quên mật khẩu, bị đánh cắp thông tin, lộ lọt dữ liệu hoặc bị giả mạo danh tính. Điều này không chỉ gây ra những tổn thất về tài chính mà còn ảnh hưởng nghiêm trọng đến uy tín, quyền riêng tư và sự phát triển bền vững của các tổ chức, doanh nghiệp.

Trước thực trạng đó, xác thực sinh trắc học – đặc biệt là nhận diện khuôn mặt – nổi lên như một giải pháp công nghệ tiên tiến, mang lại nhiều ưu điểm vượt trội so với các phương pháp truyền thống. Nhận diện khuôn mặt không chỉ dựa trên các đặc trưng sinh học duy nhất của mỗi cá nhân mà còn mang lại sự tiện lợi, nhanh chóng và khó bị giả mạo. Công nghệ này đã và đang được ứng dụng rộng rãi trong nhiều lĩnh vực như ngân hàng, giáo dục, y tế, thương mại điện tử, quản lý hành chính công,... góp phần nâng cao hiệu quả quản lý, bảo mật và tối ưu hóa trải nghiệm người dùng.

Tuy nhiên, việc triển khai các hệ thống xác thực khuôn mặt trên nền tảng web vẫn còn đối mặt với nhiều thách thức lớn. Đó là các vấn đề về độ chính xác, tốc độ xử lý, khả năng chống giả mạo (liveness), tích hợp đa nền tảng, bảo mật dữ liệu cá nhân và tuân thủ các quy định pháp lý ngày càng nghiêm ngặt. Bên cạnh đó, sự phát triển nhanh chóng của các kỹ thuật tấn công như deepfake, spoofing,... cũng đặt ra yêu cầu cấp thiết về việc nâng cao năng lực phát hiện và phòng chống các hình thức giả mạo tinh vi.

Xuất phát từ những yêu cầu thực tiễn và thách thức nêu trên, nhóm tác giả lựa chọn đề tài "Nghiên cứu, xây dựng hệ thống xác thực người dùng qua nhận diện khuôn mặt trên nền tảng web" với mong muốn góp phần giải quyết một phần các bài toán thực tiễn, đồng thời nâng cao nhận thức, năng lực nghiên cứu và ứng dụng công nghệ mới trong lĩnh vực bảo mật thông tin. Đề tài không chỉ tập trung vào việc nghiên cứu các thuật toán, mô hình nhận diện khuôn mặt, kiểm tra liveness mà còn chú trọng đến việc xây dựng một hệ thống hoàn chỉnh, tích hợp đa nền tảng (frontend, backend PHP, AI backend Python), đảm bảo các tiêu chí về hiệu năng, bảo mật, khả năng mở rộng và tuân thủ pháp lý.

Phần mở đầu này sẽ trình bày tổng quan về bối cảnh, lý do lựa chọn đề tài, ý nghĩa khoa học và thực tiễn, đồng thời định hướng cho toàn bộ nội dung nghiên cứu được trình bày trong các chương tiếp theo của báo cáo. Qua đó, giúp người đọc có cái nhìn tổng thể, logic và nhận diện rõ ràng về mục tiêu, phạm vi, đối tượng nghiên cứu cũng như các đóng góp mà đề tài hướng tới.

---

## Chương 1: Tổng Quan Về Đề Tài

### 1.1. Đặt Vấn Đề

Trong bối cảnh chuyển đổi số toàn cầu, các hoạt động kinh tế, xã hội, giáo dục, y tế, tài chính,... đều dịch chuyển mạnh mẽ lên môi trường số, đặt ra yêu cầu cấp thiết về các giải pháp xác thực danh tính người dùng vừa an toàn, vừa thuận tiện, vừa đảm bảo trải nghiệm người dùng (UX/UI) tối ưu. Các phương pháp xác thực truyền thống như mật khẩu, mã PIN, thẻ từ,... ngày càng bộc lộ nhiều điểm yếu nghiêm trọng: dễ bị lộ lọt, tấn công phishing, brute-force, shoulder surfing, hoặc đơn giản là bị quên, gây phiền toái cho người dùng và tăng chi phí vận hành cho tổ chức.

Đặc biệt, trong các lĩnh vực nhạy cảm như ngân hàng, giáo dục, y tế, thương mại điện tử, việc xác thực sai danh tính có thể dẫn đến hậu quả nghiêm trọng về tài chính, pháp lý, uy tín và quyền riêng tư. Các vụ tấn công giả mạo, đánh cắp danh tính, lừa đảo qua mạng ngày càng tinh vi, sử dụng cả công nghệ deepfake, spoofing, khiến các giải pháp truyền thống trở nên lạc hậu.

Sinh trắc học, đặc biệt là nhận diện khuôn mặt, nổi lên như một xu hướng tất yếu nhờ tính duy nhất, khó giả mạo, thuận tiện (không cần nhớ thông tin, không cần thiết bị phụ trợ), dễ tích hợp với các thiết bị số hiện đại (webcam, smartphone, IoT). Tuy nhiên, việc triển khai thực tế các hệ thống xác thực khuôn mặt trên nền tảng web lại đối mặt với nhiều thách thức lớn: đảm bảo độ chính xác cao trong điều kiện môi trường đa dạng (ánh sáng, góc mặt, chất lượng camera), tốc độ xử lý đáp ứng thời gian thực, khả năng chống giả mạo (liveness detection), bảo mật dữ liệu sinh trắc học, tuân thủ các quy định pháp lý (GDPR, luật An ninh mạng Việt Nam), và khả năng tích hợp, mở rộng với các hệ thống hiện hữu.

Những thách thức này đòi hỏi phải có cách tiếp cận tổng thể, kết hợp giữa công nghệ AI hiện đại (deep learning, computer vision), kiến trúc hệ thống module hóa, quy trình bảo mật chặt chẽ, thiết kế UX/UI lấy người dùng làm trung tâm và tuân thủ pháp lý nghiêm ngặt. Đó cũng chính là lý do nhóm tác giả lựa chọn đề tài này, với mong muốn giải quyết các bài toán thực tiễn, đồng thời đóng góp tri thức, kinh nghiệm cho cộng đồng nghiên cứu và ứng dụng công nghệ tại Việt Nam.

### 1.2. Mục Tiêu Của Đề Tài

Mục tiêu tổng quát của đề tài là nghiên cứu, xây dựng và triển khai thành công một hệ thống xác thực người dùng qua nhận diện khuôn mặt trên nền tảng web, đáp ứng đồng thời các tiêu chí về công nghệ, bảo mật, pháp lý và trải nghiệm người dùng. Cụ thể:

- Ứng dụng các thuật toán AI hiện đại (deep learning, computer vision) để nhận diện khuôn mặt và kiểm tra liveness với độ chính xác cao, chống giả mạo hiệu quả.
- Thiết kế hệ thống module hóa, tích hợp đa nền tảng (frontend HTML/JS/CSS, backend PHP, AI backend Python), dễ mở rộng, bảo trì, nâng cấp.
- Đảm bảo tốc độ xử lý nhanh, tối ưu hóa pipeline nhận diện, giảm độ trễ, đáp ứng tốt cho các ứng dụng thực tế quy mô vừa và lớn.
- Xây dựng giao diện người dùng (UI) trực quan, thân thiện, hỗ trợ đa thiết bị, tối ưu trải nghiệm người dùng (UX) cho cả người dùng cuối và quản trị viên.
- Đảm bảo an toàn dữ liệu sinh trắc học, tuân thủ các quy định pháp lý về bảo mật dữ liệu cá nhân (GDPR, luật Việt Nam), hỗ trợ logging, kiểm soát truy cập, mã hóa dữ liệu.
- Đánh giá thực nghiệm toàn diện về hiệu năng, độ chính xác, khả năng mở rộng, bảo mật và UX/UI.

### 1.3. Phạm Vi Của Đề Tài

Phạm vi nghiên cứu và triển khai của đề tài bao gồm:

- Nghiên cứu tổng quan các phương pháp, thuật toán nhận diện khuôn mặt, kiểm tra liveness, xác thực sinh trắc học trên nền tảng web, phân tích ưu nhược điểm, khả năng ứng dụng thực tiễn.
- Thiết kế, xây dựng hệ thống xác thực người dùng qua khuôn mặt tích hợp đầy đủ các thành phần: frontend (HTML/JS/CSS), backend PHP (quản lý người dùng, xác thực, bảo mật, kết nối DB), AI backend Python (nhận diện, liveness, OCR, API), cơ sở dữ liệu (SQLite/MySQL/PostgreSQL).
- Xây dựng quy trình bảo mật dữ liệu sinh trắc học, nhật ký xác thực, kiểm soát truy cập, logging, mã hóa dữ liệu.
- Đánh giá toàn diện hiệu năng, độ chính xác, khả năng mở rộng, bảo mật, UX/UI qua kiểm thử thực tế, phân tích số liệu, khảo sát người dùng.
- Đề xuất các giải pháp nâng cao, định hướng phát triển tiếp theo về công nghệ, bảo mật, pháp lý, UX/UI, dữ liệu, tích hợp đa nền tảng.

### 1.4. Cấu Trúc Của Bài Báo Cáo Này

Bài báo cáo được tổ chức logic thành 9 chương, đảm bảo trình tự từ tổng quan, lý thuyết, phân tích, thiết kế, triển khai, kiểm thử, đánh giá đến kết luận, giúp người đọc dễ dàng theo dõi, tra cứu và nắm bắt toàn diện quá trình nghiên cứu, phát triển hệ thống. Cấu trúc này cũng phản ánh đúng quy trình phát triển phần mềm hiện đại (SDLC), kết hợp giữa lý thuyết và thực tiễn, giữa công nghệ và yếu tố con người, pháp lý.

### 1.5. Đối Tượng Nghiên Cứu

Đối tượng nghiên cứu của đề tài bao gồm:

- Các kỹ thuật, thuật toán AI (deep learning, computer vision) cho nhận diện khuôn mặt, kiểm tra liveness, OCR, xác thực sinh trắc học trên nền tảng web.
- Các mô hình kiến trúc hệ thống web tích hợp AI backend, quy trình xác thực người dùng, bảo mật dữ liệu sinh trắc học, logging, kiểm soát truy cập.
- Các tiêu chuẩn, quy định pháp lý về bảo mật dữ liệu cá nhân (GDPR, luật Việt Nam), các giải pháp đảm bảo tuân thủ pháp lý khi triển khai thực tế.
- Phân tích tác động của công nghệ đến trải nghiệm người dùng, hiệu quả vận hành, chi phí, rủi ro và khả năng mở rộng hệ thống.

### 1.6. Đối Tượng Áp Dụng

Hệ thống hướng đến các đối tượng áp dụng đa dạng:

- Các tổ chức, doanh nghiệp, trường học, ngân hàng, bệnh viện,... có nhu cầu xác thực danh tính người dùng an toàn, tiện lợi, tiết kiệm chi phí vận hành trên môi trường số.
- Các nhà phát triển phần mềm, nhóm nghiên cứu muốn tích hợp xác thực khuôn mặt vào sản phẩm, dịch vụ của mình.
- Người dùng cuối mong muốn trải nghiệm xác thực nhanh chóng, tiện lợi, bảo mật cao mà không cần ghi nhớ thông tin phức tạp.

### 1.7. Phương Pháp Thực Hiện Dự Án

Đề tài sử dụng phương pháp nghiên cứu tổng hợp kết hợp thực nghiệm, đảm bảo tính học thuật và thực tiễn:

- Khảo sát, tổng hợp tài liệu, các công trình nghiên cứu, giải pháp thực tế về xác thực khuôn mặt, liveness, bảo mật web, UX/UI, pháp lý.
- Phân tích, lựa chọn các thuật toán, mô hình AI phù hợp (FaceNet, MTCNN, ArcFace, các giải pháp kiểm tra liveness phổ biến, OCR), đánh giá ưu nhược điểm từng giải pháp.
- Thiết kế kiến trúc hệ thống module hóa, tích hợp đa nền tảng (frontend, backend PHP, AI backend Python), đảm bảo bảo mật, hiệu năng, khả năng mở rộng.
- Xây dựng, triển khai hệ thống mẫu, kiểm thử trên dữ liệu thực tế, đánh giá định lượng (số liệu, biểu đồ) và định tính (khảo sát người dùng, phân tích UX/UI).
- Đánh giá, phân tích kết quả, rút ra bài học, đề xuất hướng phát triển tiếp theo về công nghệ, bảo mật, pháp lý, UX/UI.

### 1.8. Đóng Góp Của Đề Tài

Các đóng góp nổi bật của đề tài:

- Xây dựng thành công hệ thống xác thực người dùng qua khuôn mặt trên nền tảng web, tích hợp đa thành phần (frontend, backend PHP, AI backend Python, DB), có tính ứng dụng thực tiễn cao.
- Đề xuất, hiện thực hóa quy trình kiểm tra liveness, tăng cường bảo mật chống giả mạo, nâng cao độ tin cậy xác thực.
- Thiết kế kiến trúc hệ thống mở, module hóa, dễ mở rộng, bảo trì, tích hợp thêm các công nghệ mới (AI nâng cao, xác thực đa yếu tố, IoT).
- Đánh giá thực nghiệm hiệu năng, độ chính xác, khả năng mở rộng, bảo mật, UX/UI qua kiểm thử thực tế, khảo sát người dùng.
- Đưa ra các khuyến nghị về bảo mật, tuân thủ pháp lý, quy trình vận hành, hướng dẫn triển khai thực tế.
- Cung cấp tài liệu tham khảo, hướng dẫn chi tiết cho các tổ chức, cá nhân có nhu cầu ứng dụng xác thực sinh trắc học.

### 1.9. Hạn Chế Và Định Hướng Tiếp Theo

Hạn chế:

- Hệ thống mẫu chủ yếu kiểm thử trên tập dữ liệu giới hạn, chưa triển khai thực tế quy mô lớn, chưa đánh giá sâu trên nhiều môi trường, thiết bị khác nhau.
- Một số thuật toán kiểm tra liveness còn đơn giản, cần nâng cấp để chống các hình thức giả mạo tinh vi hơn (deepfake, spoofing).
- Chưa tích hợp xác thực đa yếu tố (multi-factor), tối ưu hóa cho thiết bị di động, IoT.
- Chưa đánh giá toàn diện về hiệu năng, bảo mật khi mở rộng quy mô lớn hoặc tích hợp với hệ thống phức tạp.

Định hướng tiếp theo:

- Mở rộng tập dữ liệu, kiểm thử thực tế trên nhiều môi trường, đối tượng, thiết bị khác nhau.
- Nâng cấp, tối ưu hóa thuật toán nhận diện khuôn mặt, kiểm tra liveness, tích hợp AI nâng cao, phát hiện deepfake, spoofing.
- Phát triển xác thực đa yếu tố kết hợp sinh trắc học và các phương pháp khác (OTP, SMS, email, vân tay, mống mắt,...).
- Tối ưu hóa hiệu năng, giao diện cho thiết bị di động, IoT, hỗ trợ đa nền tảng.
- Đề xuất, xây dựng chính sách bảo mật, quy trình vận hành, tuân thủ pháp lý quốc tế về dữ liệu cá nhân.

### 1.10. Tiểu Kết Chương 1

Chương 1 đã trình bày tổng quan, phân tích sâu sắc bối cảnh, lý do lựa chọn đề tài, mục tiêu, phạm vi, đối tượng nghiên cứu và áp dụng, phương pháp thực hiện, đóng góp, hạn chế và định hướng phát triển. Những nội dung này là nền tảng quan trọng, giúp người đọc có cái nhìn toàn diện, logic, nhận diện rõ ràng các vấn đề thực tiễn, thách thức công nghệ, pháp lý, bảo mật, UX/UI và các giải pháp mà đề tài hướng tới. Đây cũng là cơ sở để triển khai các chương tiếp theo một cách hệ thống, khoa học và thực tiễn.

---

## Chương 2: Cơ Sở Lý Thuyết

### 2.1. Xác Thực Sinh Trắc Học

Xác thực sinh trắc học là quá trình sử dụng các đặc trưng sinh học duy nhất, ổn định theo thời gian của mỗi cá nhân để xác định hoặc xác thực danh tính. Các đặc trưng này có thể là vân tay, khuôn mặt, mống mắt, giọng nói, tĩnh mạch, DNA,... Trong đó, nhận diện khuôn mặt nổi bật nhờ tính tiện lợi, không xâm lấn, dễ tích hợp trên thiết bị số hiện đại (webcam, smartphone, IoT) và khả năng ứng dụng rộng rãi trong thực tiễn.

So với các phương pháp truyền thống (mật khẩu, thẻ từ), xác thực sinh trắc học giúp nâng cao bảo mật, giảm thiểu rủi ro bị giả mạo, quên/lộ thông tin, đồng thời tối ưu trải nghiệm người dùng (không cần nhớ thông tin, thao tác nhanh). Tuy nhiên, các hệ thống này đối mặt với nhiều thách thức: độ chính xác phụ thuộc vào chất lượng cảm biến, môi trường (ánh sáng, góc mặt), khả năng chống giả mạo (spoofing, deepfake), bảo mật dữ liệu sinh trắc học (không thể thay đổi nếu bị lộ), các vấn đề pháp lý về quyền riêng tư, đồng thuận người dùng.

Các bước cơ bản trong xác thực sinh trắc học gồm: thu thập đặc trưng (qua cảm biến/camera), tiền xử lý (lọc nhiễu, chuẩn hóa), trích xuất đặc trưng (feature extraction), so khớp với mẫu lưu trữ (matching) và đưa ra quyết định xác thực. Việc lựa chọn đặc trưng phù hợp, xây dựng pipeline AI tối ưu, đảm bảo an toàn dữ liệu, tuân thủ pháp lý là những yếu tố then chốt quyết định thành công của hệ thống. Ví dụ, các hệ thống ngân hàng, sân bay quốc tế, bệnh viện lớn đều đã ứng dụng xác thực sinh trắc học để nâng cao bảo mật và tối ưu vận hành.

### 2.2. Nhận Diện Khuôn Mặt

Nhận diện khuôn mặt là quá trình xác định hoặc xác thực một cá nhân dựa trên các đặc trưng hình thái học, cấu trúc không gian của khuôn mặt. Quy trình hiện đại gồm: phát hiện khuôn mặt (face detection), căn chỉnh (alignment), trích xuất đặc trưng (feature extraction), so khớp (matching) và đánh giá xác suất nhận diện.

Các thuật toán phát hiện khuôn mặt phổ biến: Haar Cascade, HOG, MTCNN, SSD, YOLO, RetinaFace,... Trong đó, các phương pháp deep learning (MTCNN, RetinaFace) cho độ chính xác cao, phát hiện tốt trong điều kiện ánh sáng/góc nhìn đa dạng, chống nhiễu tốt hơn các phương pháp truyền thống.

Về trích xuất đặc trưng, các mô hình học sâu như FaceNet, ArcFace, VGGFace, InsightFace,... học được vector đặc trưng (embedding) có tính phân biệt cao giữa các cá thể, giảm thiểu sai số nhận diện. Các embedding này được so khớp với mẫu lưu trữ bằng các hàm khoảng cách (cosine, Euclidean) để xác định danh tính.

Nhận diện khuôn mặt trên nền tảng web đòi hỏi sự phối hợp chặt chẽ giữa frontend (truy xuất camera, xử lý ảnh ban đầu, UX/UI), backend (xử lý AI, so khớp dữ liệu, bảo mật), AI backend (nhận diện, liveness, OCR) và cơ sở dữ liệu (lưu trữ embedding, nhật ký xác thực). Việc tối ưu hóa pipeline xử lý, bảo mật dữ liệu khuôn mặt, đảm bảo tốc độ phản hồi, khả năng mở rộng và tuân thủ pháp lý là những thách thức lớn. Ví dụ, các hệ thống eKYC ngân hàng, kiểm soát ra vào tòa nhà, chấm công thông minh,... đều ứng dụng pipeline này.

### 2.3. Kiểm Tra Liveness

Kiểm tra liveness (liveness detection) là quá trình xác định đối tượng xác thực có phải là người thật đang hiện diện trước camera hay chỉ là hình ảnh, video, mặt nạ, deepfake,... nhằm phòng chống các hình thức giả mạo (spoofing). Đây là thành phần then chốt trong các hệ thống xác thực sinh trắc học hiện đại, đặc biệt khi các kỹ thuật tấn công ngày càng tinh vi.

Các phương pháp kiểm tra liveness phổ biến:

- **Chủ động (active):** Yêu cầu người dùng thực hiện các hành động ngẫu nhiên (chớp mắt, quay đầu, cử động môi, đọc số,...) để xác minh tính sống động. Độ chính xác cao nhưng có thể ảnh hưởng UX nếu lạm dụng.
- **Thụ động (passive):** Phân tích đặc trưng hình ảnh/video (texture, ánh sáng, phản xạ, chuyển động vi mô, phân tích quang phổ,...) để phát hiện giả mạo mà không cần tương tác người dùng. Tối ưu UX nhưng khó chống lại deepfake tinh vi.
- **Lai (hybrid):** Kết hợp cả hai để tăng độ chính xác, giảm false positive/negative.

Các thuật toán AI hiện đại (CNN, RNN, GAN-based detection, optical flow, attention mechanism,...) ngày càng được ứng dụng rộng rãi, giúp phát hiện các hình thức tấn công mới như deepfake, replay attack, mask attack. Việc tích hợp kiểm tra liveness vào hệ thống xác thực khuôn mặt trên web giúp nâng cao bảo mật, giảm thiểu nguy cơ bị giả mạo, đồng thời tối ưu trải nghiệm người dùng. Ví dụ, các hệ thống eKYC ngân hàng lớn đều bắt buộc kiểm tra liveness khi xác thực từ xa.

### 2.4. OCR

OCR (Optical Character Recognition) là công nghệ nhận dạng ký tự quang học, chuyển đổi hình ảnh chứa văn bản (giấy tờ tùy thân, ảnh chụp, scan,...) thành dữ liệu số có thể xử lý tự động. Trong hệ thống xác thực, OCR thường dùng để trích xuất thông tin từ giấy tờ tùy thân (CMND/CCCD, hộ chiếu, thẻ sinh viên,...) phục vụ đối chiếu với dữ liệu nhận diện khuôn mặt, tăng độ tin cậy xác thực.

Các thư viện OCR phổ biến: Tesseract, EasyOCR, Google Vision API,... Việc kết hợp OCR với nhận diện khuôn mặt giúp giảm thiểu rủi ro giả mạo danh tính, phát hiện giấy tờ giả, tự động hóa quy trình onboarding. Tuy nhiên, OCR đối mặt với thách thức: chất lượng ảnh đầu vào (mờ, bóng, méo), đa dạng font chữ/ngôn ngữ, bố cục tài liệu phức tạp, bảo mật dữ liệu giấy tờ.

Trong hệ thống xác thực web, OCR có thể tích hợp ở cả frontend (tiền xử lý ảnh, UX/UI hướng dẫn chụp ảnh đúng chuẩn) và backend (xử lý nhận dạng, đối chiếu dữ liệu, logging), đảm bảo tự động hóa, bảo mật thông tin, nâng cao trải nghiệm người dùng. Ví dụ, các app ngân hàng, ví điện tử đều tích hợp OCR để onboarding khách hàng mới.

### 2.5. Xác Thực & Bảo Mật

Xác thực (authentication) là quá trình xác minh danh tính người dùng, còn bảo mật (security) là tổng thể các biện pháp bảo vệ hệ thống, dữ liệu khỏi nguy cơ tấn công, truy cập trái phép. Trong hệ thống xác thực sinh trắc học, bảo mật dữ liệu sinh trắc (khuôn mặt, vân tay,...) là yêu cầu bắt buộc, bởi đây là thông tin nhạy cảm, không thể thay đổi nếu bị lộ.

Các nguyên tắc bảo mật quan trọng:

- Mã hóa dữ liệu khi lưu trữ và truyền tải (AES, RSA, HTTPS, JWT,...), bảo vệ embedding khuôn mặt, giấy tờ tùy thân.
- Phân quyền truy cập, kiểm soát nhật ký hoạt động, logging chi tiết các thao tác nhạy cảm.
- Ẩn danh hóa (anonymization), băm dữ liệu (hashing) embedding khuôn mặt, hạn chế truy xuất trực tiếp.
- Định kỳ kiểm tra, đánh giá lỗ hổng bảo mật (pentest, audit), cập nhật bản vá kịp thời.
- Tuân thủ các tiêu chuẩn quốc tế (ISO/IEC 27001, GDPR, luật Việt Nam,...), xây dựng quy trình xử lý sự cố, đào tạo nhân sự.

Ngoài ra, hệ thống cần có cơ chế phát hiện, cảnh báo và ứng phó với các hành vi bất thường, tấn công giả mạo, đảm bảo an toàn cho cả người dùng và tổ chức vận hành. Ví dụ, các hệ thống xác thực ngân hàng, chính phủ đều có quy trình bảo mật nhiều lớp, kiểm soát truy cập nghiêm ngặt.

### 2.6. Kiến Trúc Hệ Thống Web

Kiến trúc hệ thống web hiện đại thường xây dựng theo mô hình đa lớp (multi-tier): frontend (giao diện người dùng, UX/UI), backend (xử lý nghiệp vụ, API, bảo mật), AI backend (nhận diện, liveness, OCR), cơ sở dữ liệu (lưu trữ thông tin, embedding, nhật ký).

Frontend đảm nhận thu thập dữ liệu đầu vào (ảnh khuôn mặt, giấy tờ), hướng dẫn người dùng thao tác đúng chuẩn, hiển thị kết quả xác thực, tối ưu UX/UI. Backend PHP quản lý người dùng, xác thực phiên đăng nhập, kết nối AI backend và DB, kiểm soát bảo mật, logging. AI backend (Python) thực hiện nhận diện khuôn mặt, kiểm tra liveness, OCR, cung cấp API cho backend PHP.

Thiết kế kiến trúc mở, module hóa, tách biệt các thành phần giúp dễ dàng mở rộng, bảo trì, nâng cấp hệ thống, tích hợp thêm công nghệ mới (AI nâng cao, xác thực đa yếu tố, IoT). Các thành phần giao tiếp qua API (RESTful, WebSocket), sử dụng JWT cho xác thực, đảm bảo linh hoạt, bảo mật, hiệu năng. Ví dụ, hệ thống trong đề tài sử dụng FastAPI cho AI backend, PHP cho backend nghiệp vụ, HTML/JS cho frontend.

### 2.7. Cơ Sở Dữ Liệu

Cơ sở dữ liệu là thành phần trọng tâm, lưu trữ thông tin người dùng, embedding khuôn mặt, nhật ký xác thực, quyền truy cập,... Các hệ quản trị phổ biến: MySQL, PostgreSQL, SQLite,...

Thiết kế cơ sở dữ liệu cần đảm bảo:

- Tính toàn vẹn, nhất quán dữ liệu (ACID), hỗ trợ rollback khi có sự cố.
- Phân quyền truy cập, mã hóa dữ liệu nhạy cảm (embedding, giấy tờ), logging truy vấn nhạy cảm.
- Lưu trữ hiệu quả embedding, nhật ký xác thực, thông tin giấy tờ, hỗ trợ truy vấn nhanh, backup, phục hồi dữ liệu.
- Hỗ trợ mở rộng (scale up/out), tích hợp với các hệ thống khác qua API.

Việc tối ưu hóa truy vấn, bảo mật dữ liệu, đảm bảo hiệu năng khi hệ thống mở rộng là thách thức lớn. Ví dụ, các hệ thống eKYC lớn phải xử lý hàng triệu bản ghi/ngày, yêu cầu thiết kế DB tối ưu, phân vùng dữ liệu, backup định kỳ, kiểm soát truy cập nghiêm ngặt.

### 2.8. Quy Định Pháp Lý

Việc thu thập, lưu trữ, xử lý dữ liệu sinh trắc học chịu sự điều chỉnh của nhiều quy định pháp lý nghiêm ngặt nhằm bảo vệ quyền riêng tư cá nhân, tránh lạm dụng, lộ lọt dữ liệu. Một số quy định, tiêu chuẩn quan trọng:

- **GDPR (EU):** Quy định chung về bảo vệ dữ liệu cá nhân, yêu cầu minh bạch, đồng thuận, quyền truy cập/xóa dữ liệu, thông báo vi phạm, xử phạt nghiêm minh.
- **Luật An ninh mạng, Luật Bảo vệ dữ liệu cá nhân (Việt Nam):** Quy định về thu thập, xử lý, lưu trữ, chuyển giao dữ liệu cá nhân, chế tài xử phạt vi phạm, yêu cầu lưu trữ dữ liệu tại Việt Nam.
- **ISO/IEC 27001:** Tiêu chuẩn quốc tế về quản lý an toàn thông tin, yêu cầu xây dựng chính sách bảo mật, quy trình xử lý sự cố, đào tạo nhân sự.

Hệ thống xác thực sinh trắc học cần tuân thủ nghiêm ngặt các quy định này, xây dựng chính sách bảo mật, quy trình xử lý sự cố, đào tạo nhân sự, đảm bảo quyền lợi người dùng (quyền biết, quyền xóa, quyền phản hồi). Việc không tuân thủ có thể dẫn đến hậu quả pháp lý nghiêm trọng, mất uy tín, thiệt hại tài chính. Ví dụ, các vụ lộ dữ liệu sinh trắc học tại Ấn Độ, Mỹ, Trung Quốc đã gây hậu quả lớn về pháp lý và xã hội.

### 2.9. Tiểu Kết Chương 2

Chương 2 đã trình bày tổng quan, phân tích sâu sắc các khái niệm, công nghệ, quy trình, tiêu chuẩn nền tảng cho hệ thống xác thực người dùng qua khuôn mặt trên nền tảng web. Các nội dung về sinh trắc học, nhận diện khuôn mặt, kiểm tra liveness, OCR, bảo mật, kiến trúc hệ thống, cơ sở dữ liệu, pháp lý,... là cơ sở lý thuyết vững chắc để triển khai các bước phân tích, thiết kế, xây dựng, kiểm thử và đánh giá hệ thống ở các chương tiếp theo. Việc nắm vững lý thuyết giúp đảm bảo hệ thống vừa hiện đại, vừa an toàn, vừa tuân thủ pháp lý và tối ưu trải nghiệm người dùng.

---
