# NLP.ipynb – Báo cáo chi tiết (dùng để vấn đáp/đánh giá) – 2026-05-07

Notebook: `NLP.ipynb`  
Bài toán: **Phân loại văn bản tiếng Việt theo chuyên mục (category)** từ báo VnExpress.  
Dữ liệu đầu vào: `vnexpress.csv` (tải từ Kaggle dataset `ntkhoi2005/mydata`).  
Đầu ra mong muốn: Với mỗi bài viết (cột `content`), dự đoán `category`.

---

## 0) Mục tiêu học thuật & lý do chọn hướng giải

### 0.1 Vì sao đây là bài toán NLP “kinh điển”?
Phân loại văn bản (text classification) là bài toán tiêu chuẩn trong NLP, trong đó:
- **Đầu vào**: chuỗi ký tự (văn bản tự nhiên), nhiễu, độ dài thay đổi.
- **Đầu ra**: nhãn rời rạc (chuyên mục).
- Khó ở chỗ: phải biến văn bản thành dạng số (vector) rồi mới huấn luyện mô hình.

### 0.2 Vì sao cần so sánh nhiều phương pháp?
Bạn triển khai 3 nhóm:
1) **Bag-of-words/TF‑IDF + mô hình tuyến tính** (LR, NB, SVM)  
2) **Word embedding (FastText) + mô hình tuyến tính**  
3) **Deep learning (LSTM)**  

Mục tiêu của so sánh:
- Tìm baseline mạnh, nhanh, dễ giải thích (phù hợp vấn đáp).
- Quan sát vì sao mô hình “phức tạp hơn” chưa chắc tốt hơn nếu chưa tối ưu.

---

## 1) Chuẩn bị môi trường & thư viện

### 1.1 Cài `underthesea`
**Code**
```python
!pip install underthesea
```

**Kết quả chạy**
- `Requirement already satisfied: underthesea (9.4.0)`

**Vì sao cần underthesea?**
- Tiếng Việt là ngôn ngữ **tách từ theo khoảng trắng không chính xác** (ví dụ: “giáo sư” gồm 2 tiếng nhưng 1 từ).
- `underthesea.word_tokenize(format="text")` tạo token dạng `giáo_sư`, giúp mô hình học đúng đơn vị từ.

### 1.2 Import
**Code**
```python
import pandas as pd
import re
import numpy as np

from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import MultinomialNB
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.svm import LinearSVC

from underthesea import word_tokenize
from tqdm import tqdm
```

**Vì sao dùng scikit-learn?**
- Có sẵn pipeline cho TF‑IDF và mô hình tuyến tính rất mạnh cho text classification.
- Dễ tái lập, dễ giải thích về mặt toán (trọng số, siêu phẳng, regularization).

---

## 2) Lấy dữ liệu từ Kaggle (và lưu ý bảo mật)

### 2.1 Upload `kaggle.json`
**Code**
```python
from google.colab import files
files.upload()
```

**Kết quả chạy**
- `Saving kaggle.json to kaggle.json`
- Output có in ra key.

> **Cảnh báo quan trọng:** notebook của bạn đang lộ Kaggle API key trong output. Khi nộp bài/đẩy GitHub nên:
> - Xóa output cell đó
> - Rotate key trên Kaggle

### 2.2 Cấu hình Kaggle
**Code**
```python
!mkdir -p ~/.kaggle
!cp kaggle.json ~/.kaggle/
!chmod 600 ~/.kaggle/kaggle.json
```

**Giải thích**
- Kaggle CLI yêu cầu file `~/.kaggle/kaggle.json` có quyền truy cập an toàn.

### 2.3 Tải & giải nén dataset
**Code**
```python
!kaggle datasets download -d ntkhoi2005/mydata
!unzip mydata.zip
```

**Kết quả chạy**
- `Downloading mydata.zip ... 100% 69.1M/69.1M`
- Giải nén ra `vnexpress.csv`

---

## 3) Nạp dữ liệu & chọn đặc trưng

### 3.1 Load và giữ 2 cột quan trọng
**Code**
```python
df = pd.read_csv("vnexpress.csv", encoding="utf-8-sig")
df = df[['content', 'category']].dropna()
tqdm.pandas()
```

**Vì sao chỉ dùng `content` và `category`?**
- Đây là dạng tối thiểu của bài toán phân loại: văn bản → nhãn.
- Giảm yếu tố phụ (title, tags…) để tập trung vào NLP cơ bản.

**Ý nghĩa `encoding="utf-8-sig"`**
- CSV có thể chứa BOM, đọc bằng utf‑8 thường sẽ lỗi ký tự đầu dòng.

---

## 4) Tiền xử lý (Preprocessing) – vì sao phải làm và vì sao làm như vậy?

### 4.1 Code tiền xử lý
**Code (nguyên bản notebook)**
```python
def clean_basic_text(x):
    if pd.isna(x):
        return ""
    x = str(x)
    x = re.sub(r"\s+", " ", x).strip()
    return x

def vi_tokenize(text):
    return word_tokenize(text, format="text")

VI_STOPWORDS = {...}

def preprocess_text(text):
    text = clean_basic_text(text).lower()

    text = re.sub(r"http\S+|www\.\S+", " ", text)
    text = re.sub(r"[^0-9a-zA-ZÀ-ỹ_\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    if not text:
        return ""

    text = vi_tokenize(text).replace("/", " ")

    tokens = []
    for tok in text.split():
        tok = tok.strip()
        if not tok:
            continue
        if len(tok) < 2 and not tok.isdigit():
            continue
        if tok in VI_STOPWORDS:
            continue
        tokens.append(tok)

    return " ".join(tokens)

df['clean_text'] = df['content'].progress_apply(preprocess_text)
```

**Kết quả chạy**
- Progress: `100%|██████████| 43490/43490 [26:15<00:00, 27.60it/s]`

### 4.2 Giải thích “tại sao dùng cái này, tại sao không dùng cái kia”

#### (A) Lowercase (`.lower()`)
- **Tại sao:** giảm số lượng từ vựng; “Việt Nam” và “việt nam” coi như 1.
- **Đổi lại:** mất thông tin viết hoa (đôi khi phân biệt tên riêng). Nhưng với phân loại chủ đề, lợi > hại.

#### (B) Xóa URL
- **Tại sao:** link thường không mang nghĩa chủ đề, chủ yếu gây nhiễu.

#### (C) Regex giữ `0-9a-zA-ZÀ-ỹ_`
- **Tại sao giữ dấu tiếng Việt:** tiếng Việt có dấu, mất dấu sẽ làm nhập nhằng (“hoa” vs “hóa”).
- **Tại sao giữ `_`:** token của underthesea dùng `_` nối từ ghép (`giáo_sư`), nếu xóa `_` sẽ phá token.
- **Tại sao vẫn giữ số:** số có thể là đặc trưng (U23, 2024, tỷ số…). Tuy nhiên số cũng có thể gây nhiễu; đây là điểm có thể cải tiến.

#### (D) Tokenize tiếng Việt (`underthesea.word_tokenize`)
- **Tại sao:** với tiếng Việt, bag-of-words hoạt động tốt nếu tách đúng từ ghép.
- **Nếu không tokenize:** TF‑IDF sẽ coi mỗi “tiếng” là token → giảm khả năng phân loại.

#### (E) Stopwords thủ công
- **Tại sao:** loại từ rất phổ biến (và, là, của...) giúp TF‑IDF tập trung vào từ mang nội dung.
- **Tại sao thủ công lại có rủi ro:** danh sách có thể thiếu (nhiều từ chức năng còn sót), hoặc loại nhầm từ hữu ích theo ngữ cảnh.

#### (F) Loại token 1 ký tự
- **Tại sao:** ký tự đơn thường là nhiễu (a, b, x...), trừ số.

---

## 5) Lọc lớp ít dữ liệu – tại sao cần?

**Code**
```python
min_samples = 50
counts = df['category'].value_counts()

valid_classes = counts[counts >= min_samples].index
df = df[df['category'].isin(valid_classes)]
```

**Tại sao làm bước này?**
- Nếu một lớp chỉ vài mẫu, mô hình dễ:
  - học “thuộc lòng” (overfit),
  - hoặc không học được gì → đánh giá không ổn định.
- Đặt ngưỡng 50 là một cách “dọn dữ liệu” hợp lý cho baseline.

**Trade-off**
- Mất các lớp hiếm → mô hình không còn tổng quát cho toàn bộ 26 lớp ban đầu.
- Nhưng giúp bài toán “đủ dữ liệu” để so sánh mô hình công bằng.

---

## 6) Chia train/test – ý nghĩa tham số & ảnh hưởng kết quả

**Code**
```python
X_train, X_test, y_train, y_test = train_test_split(
    df['clean_text'], df['category'],
    test_size=0.2,
    random_state=42
)
```

**Ý nghĩa**
- `test_size=0.2`: giữ 20% để kiểm tra “khả năng tổng quát hóa”.
- `random_state=42`: đảm bảo tái lập kết quả.

**Điểm cần lưu ý khi vấn đáp**
- Bạn **chưa dùng `stratify`**. Nếu dữ liệu lệch lớp, test có thể thiếu/ít mẫu của lớp nhỏ.
- Khi giáo viên hỏi “tại sao kết quả có thể dao động?”, bạn trả lời:
  - vì split ngẫu nhiên không stratify → phân phối nhãn có thể đổi.

---

## 7) TF‑IDF – vì sao chọn TF‑IDF và ý nghĩa tham số

### 7.1 Code TF‑IDF
```python
vectorizer = TfidfVectorizer(max_features=2000)

X_train_tfidf = vectorizer.fit_transform(X_train)
X_test_tfidf = vectorizer.transform(X_test)
```

### 7.2 Vì sao dùng TF‑IDF?
- **TF (term frequency)**: từ xuất hiện nhiều trong văn bản có thể quan trọng.
- **IDF (inverse document frequency)**: từ xuất hiện quá phổ biến toàn bộ tập thì ít phân biệt (ví dụ “hôm nay”, “cho biết”) → bị giảm trọng số.
- TF‑IDF đặc biệt mạnh cho:
  - phân loại chủ đề,
  - dữ liệu văn bản dài (bài báo),
  - mô hình tuyến tính (SVM/LR).

### 7.3 Ý nghĩa tham số `max_features=2000`
- Chỉ giữ top 2000 từ quan trọng nhất (theo thống kê nội bộ của vectorizer).
- **Tại sao cần:** giảm chiều, tăng tốc, giảm overfitting.
- **Tại sao có thể làm giảm chất lượng:** 2000 có thể chưa đủ cho nhiều lớp; từ khóa phân biệt lớp nhỏ có thể bị loại.

### 7.4 Vì sao `fit_transform` trên train, `transform` trên test?
- Tránh **data leakage**:
  - Nếu học IDF trên toàn bộ dữ liệu (cả test), bạn đã “nhìn trước” test → kết quả ảo.

---

## 8) Mô hình 1: Logistic Regression – vì sao phù hợp và giải thích kết quả

### 8.1 Code train
```python
lr_model = LogisticRegression(max_iter=200)
lr_model.fit(X_train_tfidf, y_train)
```

### 8.2 Ý nghĩa tham số `max_iter=200`
- Logistic Regression cần tối ưu hàm loss; với dữ liệu sparse nhiều chiều có thể cần nhiều vòng để hội tụ.
- Nếu `max_iter` nhỏ, có thể cảnh báo chưa hội tụ → giảm chất lượng.

### 8.3 Code evaluate + kết quả
```python
y_pred_lr = lr_model.predict(X_test_tfidf)

print("Logistic Accuracy:", accuracy_score(y_test, y_pred_lr))
print(classification_report(y_test, y_pred_lr))
```

**Kết quả notebook**
- `Logistic Accuracy: 0.8984167340806657`

### 8.4 Giải thích tại sao LR cao (~0.898)
- Với TF‑IDF, quan hệ giữa từ khóa và chủ đề thường gần tuyến tính:
  - có từ “bàn thắng”, “hlv” → Thể thao
  - có từ “bệnh viện”, “triệu chứng” → Sức khỏe
- LR học trọng số cho từng feature → dễ bắt từ khóa chủ đề.

### 8.5 Tại sao một số lớp recall thấp (ví dụ “Công nghệ”)?
Trong report của bạn (Logistic):
- “Công nghệ”: recall ~ 0.51
Giải thích khi vấn đáp:
- Từ vựng của “Công nghệ” chồng lấn với “Khoa học công nghệ”.
- Số lượng mẫu của “Công nghệ” nhỏ hơn nhiều lớp lớn → mô hình ít học pattern.
- `max_features=2000` có thể loại mất từ khóa đặc trưng của lớp nhỏ.

---

## 9) Mô hình 2: Multinomial Naive Bayes – vì sao thấp hơn rõ?

### 9.1 Code train
```python
nb_model = MultinomialNB()
nb_model.fit(X_train_tfidf, y_train)
```

### 9.2 Ý nghĩa (mặc định) `alpha=1.0`
- Smoothing để tránh xác suất 0 cho từ chưa thấy trong lớp.
- Nếu alpha quá lớn → làm “mềm” quá mạnh → giảm phân biệt.

### 9.3 Evaluate + kết quả
```python
y_pred_nb = nb_model.predict(X_test_tfidf)

print("NB Accuracy:", accuracy_score(y_test, y_pred_nb))
print(classification_report(y_test, y_pred_nb))
```

**Kết quả notebook**
- `NB Accuracy: 0.8122038599329712`

### 9.4 Vì sao NB thấp hơn LR/SVM?
Giải thích chuẩn khi vấn đáp:
- NB giả định các feature độc lập có điều kiện theo lớp (conditional independence).
- Văn bản báo chí có nhiều từ đi kèm theo ngữ cảnh; độc lập hóa làm mất cấu trúc phụ thuộc.
- NB thường mạnh khi:
  - dữ liệu rất lớn,
  - từ khóa lớp cực kỳ đặc trưng,
  - hoặc bài toán spam/ham.
- Với nhiều lớp gần nhau (Thời sự/Thế giới/Pháp luật/Đời sống), NB dễ nhầm.

---

## 10) Mô hình 3: Linear SVM – vì sao tốt nhất?

### 10.1 Code train
```python
svm_model = LinearSVC()
svm_model.fit(X_train_tfidf, y_train)
```

### 10.2 Vì sao Linear SVM hợp với TF‑IDF?
- TF‑IDF tạo vector thưa (sparse) chiều cao.
- Linear SVM tìm siêu phẳng phân tách với **margin lớn nhất** → thường tổng quát hóa tốt.
- Trong text classification, Linear SVM thường là “king of baselines”.

### 10.3 Evaluate + kết quả
```python
y_pred_svm = svm_model.predict(X_test_tfidf)

print("SVM Accuracy:", accuracy_score(y_test, y_pred_svm))
print(classification_report(y_test, y_pred_svm))
```

**Kết quả notebook**
- `SVM Accuracy: 0.9013059054663123` ✅ cao nhất trong notebook

### 10.4 Vì sao SVM nhỉnh hơn LR?
- LR tối ưu log-loss (xác suất), SVM tối ưu hinge-loss (margin).
- Với dữ liệu có nhiều lớp gần nhau, margin-based đôi khi tách tốt hơn.
- Chênh lệch nhỏ (~0.003) là bình thường: cả hai đều mạnh.

---

## 11) Confusion Matrix – đọc thế nào và dùng để trả lời “tại sao nhầm”?

### 11.1 Code
```python
print(confusion_matrix(y_test, y_pred_lr))
print(confusion_matrix(y_test, y_pred_nb))
print(confusion_matrix(y_test, y_pred_svm))
```

### 11.2 Khi giáo viên hỏi: “Nhầm là nhầm cái gì?”
Bạn cần giải thích nguyên lý:
- Confusion matrix: hàng = nhãn thật, cột = nhãn dự đoán.
- Nhìn ô ngoài đường chéo chính → các cặp lớp hay nhầm.

### 11.3 Lý do nhầm thường gặp (theo b���n chất dữ liệu)
Dù notebook chưa map label-index, nhưng theo classification_report của bạn:
- “Công nghệ” dễ nhầm sang “Khoa học công nghệ”: từ khóa giống (AI, chip, dữ liệu…).
- “Pháp luật” nhầm sang “Thời sự”: bài pháp đình có văn phong thời sự.
- “Đời sống” nhầm sang “Sức khỏe/Giải trí/Giáo dục”: “Đời sống” là nhãn rộng, nội dung dễ lấn.

> Nếu muốn trình bày chuyên nghiệp, nên tạo danh sách `labels` và vẽ heatmap.

---

## 12) FastText + SVM – vì sao thấp hơn TF‑IDF?

### 12.1 Cài đặt & train unsupervised
```python
!pip install fasttext
import fasttext

ft_model = fasttext.train_unsupervised(
    "train_ft.txt",
    model="skipgram",
    dim=100,
    epoch=5
)
```

**Vì sao dùng FastText?**
- FastText học embedding từ từ/subword.
- Có lợi cho tiếng Việt khi có nhiều từ hiếm, biến thể, và từ ghép.

### 12.2 Sentence embedding bằng trung bình vector từ
```python
def sentence_to_vec(text):
    words = text.split()
    vectors = [ft_model.get_word_vector(w) for w in words if w.strip() != ""]
    return np.mean(vectors, axis=0) if vectors else np.zeros(50)
```

**Giải thích học thuật**
- Đây là “mean pooling”: coi văn bản là tập từ, lấy trung bình để ra vector cố định.

**Nhược điểm chính (vì sao accuracy thấp)**
- Trung bình vector làm mất thông tin:
  - mất trọng số: từ quan trọng/hiếm bị “pha loãng”
  - mất phân biệt cấu trúc
- TF‑IDF thì nhấn mạnh từ hiếm có tính phân loại mạnh → nên thắng.

**Lưu ý bug**
- `dim=100` nhưng `np.zeros(50)` sai chiều. Đúng: `np.zeros(100)`.

### 12.3 Kết quả
```python
print("FastText + SVM:", accuracy_score(y_test_ft, svm_ft.predict(X_test_ft)))
```
**Kết quả notebook**
- `FastText + SVM: 0.8710273893447359`

---

## 13) LSTM – vì sao thấp hơn và phân tích sâu theo “bias/variance”

### 13.1 Tokenization & padding
```python
tokenizer = Tokenizer(num_words=10000)
...
X_pad = pad_sequences(X_seq, maxlen=200)
```

**Vì sao dùng Tokenizer + padding?**
- Neural network cần input số có kích thước cố định → padding về 200 token.

### 13.2 Kiến trúc LSTM
```python
model = Sequential([
    Embedding(10000, 128, input_length=200),
    LSTM(64),
    Dense(64, activation='relu'),
    Dense(len(set(y_encoded)), activation='softmax')
])
```

**Giải thích**
- `Embedding`: học vector từ đầu (random init).
- `LSTM`: học phụ thuộc theo chuỗi.
- `softmax`: phân loại đa lớp.

### 13.3 Train/Eval và kết quả
Train log:
- Epoch 1 accuracy ~ 0.4594
- Epoch 5 accuracy ~ 0.8533 (train)

Test:
- `LSTM: 0.8012250065803528`

### 13.4 Vì sao LSTM thua SVM TF‑IDF trong notebook này?
Giải thích “đúng chất vấn đáp”:
1) **Embedding học từ đầu** cần nhiều dữ liệu và tuning để vượt baseline.
2) Bạn chỉ train `epochs=5` → có thể chưa đủ hội tụ.
3) Không thấy dùng:
   - dropout / regularization
   - early stopping
   - class weights (nếu lệch lớp)
4) LSTM mạnh khi cần ngữ cảnh/chuỗi; nhưng bài phân loại chủ đề báo chí thường “từ khóa” đã đủ → TF‑IDF + tuyến tính rất hiệu quả.
5) Với tiếng Việt, giải pháp SOTA thường là Transformer (PhoBERT) hơn là LSTM thuần.

---

## 14) Lưu mô hình – vì sao lưu cả vectorizer và model?

**Code**
```python
joblib.dump(vectorizer, "tfidf.pkl")
joblib.dump(svm_model, "svm.pkl")
```

**Tại sao phải lưu cả hai?**
- Nếu chỉ lưu `svm.pkl` mà không lưu `tfidf.pkl`, khi predict bạn không có:
  - vocabulary
  - idf weights
→ Vector mới sẽ không khớp chiều với model.

---

## 15) Tổng hợp kết quả (đúng theo notebook)

| Phương pháp | Accuracy |
|---|---:|
| TF‑IDF + Logistic Regression | **0.8984167340806657** |
| TF‑IDF + MultinomialNB | **0.8122038599329712** |
| TF‑IDF + LinearSVC (SVM) | **0.9013059054663123** ✅ |
| FastText (mean embedding) + SVM | **0.8710273893447359** |
| LSTM | **0.8012250065803528** |

---

## 16) “Câu hỏi vấn đáp” thường gặp & gợi ý trả lời nhanh

### Q1: Vì sao TF‑IDF + SVM lại mạnh?
- Vì text classification thường tuyến tính trong không gian từ vựng.
- SVM tối ưu margin, phù hợp vector sparse cao chiều.

### Q2: Vì sao Naive Bayes thấp?
- Giả định độc lập điều kiện làm mất tương quan từ.
- Lớp chồng lấn từ vựng → NB nhầm nhiều.

### Q3: Vì sao LSTM thua baseline?
- Chưa dùng pretrained embedding / chưa tune đủ.
- TF‑IDF tận dụng từ khóa tốt hơn trong bài chủ đề.

### Q4: Vì sao “Công nghệ” khó?
- Chồng lấn với “Khoa học công nghệ”.
- Ít mẫu hơn lớp lớn.
- `max_features=2000` có thể làm mất token đặc trưng.

### Q5: Nếu nâng cấp, bạn làm gì?
- Thử `TfidfVectorizer(ngram_range=(1,2), max_features=30000, sublinear_tf=True)`
- Split stratified
- Tuning `C` cho LinearSVC / class_weight
- SOTA: fine-tune PhoBERT.

---

## 17) Các điểm cần sửa/hoàn thiện để bài “chắc” hơn khi nộp
1) **Xóa/ẩn Kaggle key** trong notebook output.
2) **Sửa bug FastText**: `np.zeros(100)`.
3) Thêm `stratify` khi chia train/test.
4) Lưu thêm:
   - danh sách labels,
   - code mapping confusion matrix → label,
   - biểu đồ heatmap để giải thích nhầm lẫn.
