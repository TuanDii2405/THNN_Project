# NLP.ipynb – Báo cáo kết quả & giải thích code/ tham số (2026-05-07)

Notebook: `NLP.ipynb`  
Bài toán: **phân loại văn bản tiếng Việt theo chuyên mục (category)** trên dữ liệu `vnexpress.csv`.

---

## 0) Môi trường & thư viện

### Cell: Cài underthesea
```python
!pip install underthesea
```
**Kết quả chạy (stdout):**
- `Requirement already satisfied: underthesea ... (9.4.0)`  
→ underthesea đã được cài sẵn trên Colab.

### Cell: Import
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
**Ý nghĩa:**
- `train_test_split`: chia train/test
- `TfidfVectorizer`: biến văn bản → vector TF‑IDF
- `LogisticRegression`, `MultinomialNB`, `LinearSVC`: 3 mô hình baseline
- `accuracy_score`, `classification_report`, `confusion_matrix`: đánh giá mô hình
- `word_tokenize`: tách từ tiếng Việt
- `tqdm`: progress bar cho `.progress_apply`

---

## 1) Lấy dữ liệu từ Kaggle

### Cell: Upload kaggle.json
```python
from google.colab import files
files.upload()
```
**Kết quả chạy:**
- In ra UI upload file và `Saving kaggle.json to kaggle.json`
- Output có chứa nội dung `{"username": "...", "key":"..."}` (NHẠY CẢM).

> Cảnh báo: Không nên để key trong notebook public. Hãy xoá output cell và rotate key trên Kaggle.

### Cell: Cấu hình thư mục Kaggle
```python
!mkdir -p ~/.kaggle
!cp kaggle.json ~/.kaggle/
!chmod 600 ~/.kaggle/kaggle.json
```
**Ý nghĩa tham số/lệnh:**
- `mkdir -p`: tạo thư mục nếu chưa có
- `chmod 600`: chỉ user hiện tại được đọc/ghi key (Kaggle yêu cầu).

### Cell: Download dataset
```python
!kaggle datasets download -d ntkhoi2005/mydata
```
**Kết quả chạy (stdout):**
- `Downloading mydata.zip ... 100% 69.1M/69.1M`
- Có link dataset.

### Cell: Giải nén
```python
!unzip mydata.zip
```
**Kết quả chạy:**
- Giải nén ra `vnexpress.csv`

---

## 2) Load dữ liệu

### Cell: đọc CSV và chọn cột
```python
df = pd.read_csv("vnexpress.csv", encoding="utf-8-sig")
df.head()

# Sử dụng cột content với category
df = df[['content', 'category']].dropna()
tqdm.pandas()
```

**Ý nghĩa tham số:**
- `encoding="utf-8-sig"`: xử lý file có BOM (hay gặp ở CSV xuất từ Excel)
- `[['content','category']]`: chỉ giữ nội dung và nhãn
- `.dropna()`: bỏ dòng thiếu dữ liệu
- `tqdm.pandas()`: bật progress_apply

**Kết quả chạy:**
- `df.head()` hiển thị vài dòng đầu.

---

## 3) Tiền xử lý (Preprocessing)

### Cell: định nghĩa hàm clean & tokenize & preprocess
```python
def clean_basic_text(x):
    if pd.isna(x):
        return ""
    x = str(x)
    x = re.sub(r"\s+", " ", x).strip()
    return x

def vi_tokenize(text):
    return word_tokenize(text, format="text")

VI_STOPWORDS = {
    "và", "là", "của", "có", "cho", "với", "trong", "được", "một", "những", "các",
    "đang", "này", "đó", "khi", "để", "về", "trên", "ra", "tại", "từ", "hay", "thì",
    "sẽ", "đã", "bị", "theo", "cũng", "như", "đến", "sau", "trước", "nên", "nếu",
    "vì", "do", "ở", "rằng", "rất", "hơn", "ít", "nhiều", "vẫn", "mới", "lại",
    "đây", "kia", "ấy", "cùng", "từng", "mỗi", "thêm", "nữa", "vào", "qua",
    "giữa", "còn", "chỉ", "tới", "sự", "việc", "người", "ông", "bà", "anh", "chị", "em",
    "tôi", "ta", "họ", "không", "nhưng", "năm", "ngày", "tháng"
}

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

**Kết quả chạy:**
- Có progress bar:
  - `100%|██████████| 43490/43490 [26:15<00:00, 27.60it/s]`

**Giải thích chi tiết các tham số/regex:**
- `re.sub(r"\s+", " ", x)`: chuẩn hoá nhiều khoảng trắng thành 1 khoảng trắng.
- `.lower()`: đưa về chữ thường để giảm số lượng từ khác nhau do viết hoa/thường.
- `r"http\S+|www\.\S+"`: xoá URL.
- `r"[^0-9a-zA-ZÀ-ỹ_\s]"`: xoá ký tự không phải chữ/số/dấu tiếng Việt/underscore/khoảng trắng.
- `word_tokenize(..., format="text")`: underthesea trả token theo dạng chuỗi có dấu `_` cho từ ghép, ví dụ: `giáo_sư`.
- `len(tok) < 2 and not tok.isdigit()`: bỏ token 1 ký tự (trừ khi là số).
- `tok in VI_STOPWORDS`: bỏ stopword.

### Cell: lưu file clean
```python
df.to_csv("vnexpress_clean.csv", index=False)
```

### Cell: đọc lại file clean (khi đã có sẵn)
```python
df = pd.read_csv("vnexpress_clean.csv", encoding="utf-8-sig")
df.head()

df = df[['content', 'category', 'clean_text']].dropna()
tqdm.pandas()
```

### Cell: xem df.head()
Notebook của bạn hiển thị:
- `rows`: 43364
- `category`: 26 lớp (trước khi lọc min_samples)
- `clean_text`: dạng đã tokenize.

---

## 4) Lọc lớp ít mẫu

### Cell
```python
min_samples = 50
counts = df['category'].value_counts()

valid_classes = counts[counts >= min_samples].index
df = df[df['category'].isin(valid_classes)]
```

**Ý nghĩa tham số:**
- `min_samples = 50`: chỉ giữ các category có >= 50 mẫu.
  - Mục tiêu: giảm overfit/đánh giá ảo do lớp quá ít.

---

## 5) Chia train/test

### Cell
```python
X_train, X_test, y_train, y_test = train_test_split(
    df['clean_text'], df['category'],
    test_size=0.2,
    random_state=42
)
```

**Ý nghĩa tham số:**
- `test_size=0.2`: 80% train, 20% test
- `random_state=42`: cố định ngẫu nhiên để lần chạy sau ra cùng kết quả.

---

## 6) TF‑IDF

### Cell
```python
vectorizer = TfidfVectorizer(max_features=2000)

X_train_tfidf = vectorizer.fit_transform(X_train)
X_test_tfidf = vectorizer.transform(X_test)
```

**Ý nghĩa tham số:**
- `max_features=2000`: chỉ giữ 2000 từ (features) quan trọng nhất theo tần suất / thống kê của vectorizer.
- `fit_transform(train)`: học vocabulary + idf từ TRAIN và biến đổi.
- `transform(test)`: chỉ biến đổi theo vocabulary train (tránh leakage).

---

## 7) Huấn luyện mô hình cổ điển và kết quả

### 7.1 Logistic Regression

**Code**
```python
lr_model = LogisticRegression(max_iter=200)
lr_model.fit(X_train_tfidf, y_train)
```

**Ý nghĩa tham số**
- `max_iter=200`: số vòng lặp tối đa của solver để hội tụ (vì TF‑IDF nhiều chiều dễ cần tăng).

**Kết quả evaluate (code)**
```python
y_pred_lr = lr_model.predict(X_test_tfidf)

print("Logistic Accuracy:", accuracy_score(y_test, y_pred_lr))
print(classification_report(y_test, y_pred_lr))
```

**Kết quả chạy (trích đúng notebook)**
- `Logistic Accuracy: 0.8984167340806657`
- Báo cáo (classification_report) có các lớp như: Bất động sản, Công nghệ, Du lịch, ... Đời sống  
  (Notebook của bạn hiển thị đầy đủ với precision/recall/f1-score).

---

### 7.2 Naive Bayes (MultinomialNB)

**Code**
```python
nb_model = MultinomialNB()
nb_model.fit(X_train_tfidf, y_train)
```

**Ý nghĩa tham số**
- `MultinomialNB()` không set tham số → dùng mặc định `alpha=1.0` (Laplace smoothing).

**Kết quả evaluate**
```python
y_pred_nb = nb_model.predict(X_test_tfidf)

print("NB Accuracy:", accuracy_score(y_test, y_pred_nb))
print(classification_report(y_test, y_pred_nb))
```

**Kết quả chạy**
- `NB Accuracy: 0.8122038599329712`

---

### 7.3 Linear SVM (LinearSVC) – tốt nhất của TF‑IDF

**Code**
```python
svm_model = LinearSVC()
svm_model.fit(X_train_tfidf, y_train)
```

**Ý nghĩa tham số**
- `LinearSVC()` dùng mặc định:
  - `C=1.0`: hệ số regularization (C lớn → ít regularize hơn)
  - loss/penalty mặc định phù hợp phân loại tuyến tính trên data sparse.

**Kết quả evaluate**
```python
y_pred_svm = svm_model.predict(X_test_tfidf)

print("SVM Accuracy:", accuracy_score(y_test, y_pred_svm))
print(classification_report(y_test, y_pred_svm))
```

**Kết quả chạy**
- `SVM Accuracy: 0.9013059054663123`

---

## 8) Confusion Matrix

### Logistic
```python
print(confusion_matrix(y_test, y_pred_lr))
```
**Kết quả chạy:** notebook in ma trận 2D (15x15 theo các lớp còn lại sau lọc).

### Naive Bayes
```python
print(confusion_matrix(y_test, y_pred_nb))
```

### SVM
```python
print(confusion_matrix(y_test, y_pred_svm))
```

**Ghi chú quan trọng**
- `confusion_matrix` trả về ma trận theo **thứ tự nhãn** nội bộ (sorted labels) nếu bạn không truyền `labels=...`.
- Nếu muốn đọc rõ “hàng/cột là lớp nào”, nên làm:
```python
labels = sorted(df['category'].unique())
cm = confusion_matrix(y_test, y_pred_svm, labels=labels)
```

---

## 9) FastText (unsupervised) + SVM

### Cài thư viện
```python
!pip install fasttext
```
**Kết quả:** `Requirement already satisfied: fasttext (0.9.3)`

### Chuẩn bị train text
```python
with open("train_ft.txt", "w", encoding="utf-8") as f:
    for text in df['clean_text']:
        f.write(text + "\n")
```
**Ý nghĩa:** ghi mỗi dòng là một văn bản để FastText train unsupervised.

### Train embedding
```python
import fasttext

ft_model = fasttext.train_unsupervised(
    "train_ft.txt",
    model="skipgram",
    dim=100,
    epoch=5
)
```

**Ý nghĩa tham số**
- `model="skipgram"`: học embedding theo skip-gram (thường tốt cho từ hiếm hơn CBOW).
- `dim=100`: số chiều vector từ.
- `epoch=5`: số vòng lặp qua dữ liệu.

### Sentence embedding = trung bình vector từ
```python
def sentence_to_vec(text):
    words = text.split()
    vectors = [ft_model.get_word_vector(w) for w in words if w.strip() != ""]
    return np.mean(vectors, axis=0) if vectors else np.zeros(50)

X_ft = np.array([sentence_to_vec(t) for t in df['clean_text']])
```

**LƯU Ý BUG**
- Bạn train `dim=100` nhưng `np.zeros(50)` → sai dimension. Đúng phải là:
  - `np.zeros(100)`  
Nếu không có câu rỗng thì chưa phát lỗi, nhưng vẫn nên sửa.

### Train/test + SVM
```python
X_train_ft, X_test_ft, y_train_ft, y_test_ft = train_test_split(
    X_ft, df['category'], test_size=0.2, random_state=42
)

svm_ft = LinearSVC()
svm_ft.fit(X_train_ft, y_train_ft)

print("FastText + SVM:", accuracy_score(y_test_ft, svm_ft.predict(X_test_ft)))
```

**Kết quả chạy**
- `FastText + SVM: 0.8710273893447359`

---

## 10) LSTM (TensorFlow/Keras)

### Cài tensorflow
```python
!pip install tensorflow
```
**Kết quả:** `Requirement already satisfied: tensorflow (2.20.0)`

### Tokenizer + padding
```python
from tensorflow.keras.preprocessing.text import Tokenizer
from tensorflow.keras.preprocessing.sequence import pad_sequences

tokenizer = Tokenizer(num_words=10000)
tokenizer.fit_on_texts(df['clean_text'])

X_seq = tokenizer.texts_to_sequences(df['clean_text'])
X_pad = pad_sequences(X_seq, maxlen=200)
```

**Ý nghĩa tham số**
- `Tokenizer(num_words=10000)`: chỉ giữ top 10k từ phổ biến nhất.
- `pad_sequences(..., maxlen=200)`: cắt hoặc pad mỗi văn bản về độ dài 200 token.

### LabelEncoder
```python
from sklearn.preprocessing import LabelEncoder

le = LabelEncoder()
y_encoded = le.fit_transform(df['category'])
```
**Ý nghĩa:** chuyển nhãn string → số nguyên 0..K-1.

### Split
```python
X_train_seq, X_test_seq, y_train_seq, y_test_seq = train_test_split(
    X_pad, y_encoded, test_size=0.2, random_state=42
)
```

### Build model
```python
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Embedding, LSTM, Dense

model = Sequential([
    Embedding(10000, 128, input_length=200),
    LSTM(64),
    Dense(64, activation='relu'),
    Dense(len(set(y_encoded)), activation='softmax')
])
```

**Ý nghĩa tham số**
- `Embedding(10000, 128, ...)`
  - 10000: vocab size (phù hợp Tokenizer num_words)
  - 128: embedding_dim
  - `input_length=200`: (deprecated warning) chiều dài sequence.
- `LSTM(64)`: 64 units.
- `Dense(64, relu)`: fully-connected layer.
- `Dense(num_classes, softmax)`: phân loại đa lớp.

**Kết quả cảnh báo**
- Warning: `input_length is deprecated` → có thể bỏ.

### Compile & train
```python
model.compile(loss='sparse_categorical_crossentropy', optimizer='adam', metrics=['accuracy'])
model.fit(X_train_seq, y_train_seq, epochs=5, batch_size=64)
```

**Ý nghĩa tham số**
- `sparse_categorical_crossentropy`: dùng khi label là số nguyên (không one-hot).
- `adam`: optimizer phổ biến.
- `epochs=5`: số vòng train.
- `batch_size=64`: kích thước batch.

**Kết quả chạy (log notebook)**
- Epoch 1: accuracy ~ 0.4594
- Epoch 5: accuracy ~ 0.8533 (train)

### Evaluate
```python
loss, acc = model.evaluate(X_test_seq, y_test_seq)
print("LSTM:", acc)
```

**Kết quả chạy**
- `LSTM: 0.8012250065803528`

---

## 11) Lưu mô hình tốt nhất (TF‑IDF + SVM)

### Cell
```python
import joblib
joblib.dump(vectorizer, "tfidf.pkl")
joblib.dump(svm_model, "svm.pkl")
```

**Kết quả chạy**
- Output: `['svm.pkl']` (joblib dump trả về list tên file)

**Ý nghĩa**
- `tfidf.pkl`: lưu vectorizer (vocabulary + idf)
- `svm.pkl`: lưu mô hình SVM
- Khi predict lại phải load cả 2.

---

## 12) Tổng kết kết quả (theo notebook)

- TF‑IDF + Logistic Regression: **0.8984167340806657**
- TF‑IDF + MultinomialNB: **0.8122038599329712**
- TF‑IDF + LinearSVC (SVM): **0.9013059054663123**  ✅ cao nhất trong notebook
- FastText (mean embedding) + SVM: **0.8710273893447359**
- LSTM: **0.8012250065803528**

---

## 13) Khuyến nghị kỹ thuật ngắn (để cải thiện thêm)
1) Dùng `stratify=df['category']` khi split.  
2) Tăng chất lượng TF‑IDF: thử `ngram_range=(1,2)` và tăng `max_features`.  
3) Sửa bug FastText: `np.zeros(100)` cho đúng dim.  
4) Nếu muốn vượt SVM: cân nhắc fine-tune **PhoBERT**.
