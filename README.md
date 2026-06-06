# VMP Monitor — CPC1 HN

Hệ giám sát **Kế hoạch Thẩm định Gốc (Validation Master Plan)** cho CPC1 HN.
React + Vite, deploy lên **GitHub Pages**, đồng bộ dữ liệu với **Google Sheet qua n8n**.

> Giao diện gốc do bạn thiết kế được giữ nguyên 100%. Bản này bổ sung phần
> hạ tầng để chạy như một web thật trên GitHub Pages và **kết nối đúng** với
> webhook n8n của bạn.

---

## 1. Có gì mới so với file `.jsx` ban đầu?

| Vấn đề ở bản gốc | Đã xử lý |
|---|---|
| App chờ JSON `{objects, activities}`, nhưng n8n trả `{ok, count, rows}` → **không hiển thị được gì** | Thêm lớp **adapter** (`src/lib/n8nAdapter.js`) tự dịch dữ liệu n8n ↔ app |
| Ngày trong Sheet là `dd/mm/yyyy`, app cần `yyyy-mm-dd` | Adapter tự chuẩn hoá ngày |
| Phân loại / bộ phận là chữ tiếng Việt | Adapter tự ánh xạ sang nhóm app (tb/qt/kho/ht/vc, sx/cd/kho/qc/qa) |
| URL kết nối **không được lưu**, tải lại trang là mất | Lưu vào `localStorage` + **tự kết nối lại** khi mở trang |
| Phải đăng nhập lại mỗi lần tải trang | Ghi nhớ phiên đăng nhập (không lưu mật khẩu) |
| Chạy như một file đơn lẻ, chưa build được | Dựng project Vite hoàn chỉnh + workflow tự deploy GitHub Pages |

Trạng thái hạng mục (`st`) được suy ra thông minh: nếu đã **quá Deadline VMP**
mà chưa hoàn thành → tự đánh **"Quá hạn"**, kể cả khi cột trạng thái trong
Sheet ghi khác.

---

## 2. Chạy thử ở máy (tuỳ chọn)

```bash
npm install
npm run dev
```

Mở `http://localhost:5173`. Đăng nhập demo: `admin / admin@123`.

---

## 3. Đẩy lên GitHub & bật GitHub Pages

### Bước 1 — Tạo repo & push code

```bash
# trong thư mục vmp-monitor
git init
git add .
git commit -m "VMP Monitor: Vite app + n8n adapter + Pages deploy"
git branch -M main
git remote add origin https://github.com/<TÊN_BẠN>/<TÊN_REPO>.git
git push -u origin main
```

### Bước 2 — Bật GitHub Pages bằng GitHub Actions

1. Vào repo trên GitHub → **Settings** → **Pages**.
2. Mục **Build and deployment** → **Source** → chọn **GitHub Actions**.
   (KHÔNG chọn "Deploy from a branch".)
3. Xong. File `.github/workflows/deploy.yml` sẽ tự chạy mỗi khi bạn push lên
   nhánh `main`. Theo dõi tiến trình ở tab **Actions**.

Sau ~1–2 phút, web của bạn sống ở:
`https://<TÊN_BẠN>.github.io/<TÊN_REPO>/`

> **Lưu ý `base`:** project đặt `base: './'` (đường dẫn tương đối) trong
> `vite.config.js` nên chạy được ngay với mọi tên repo. Nếu sau này bạn dùng
> **custom domain** hoặc **user page** (`<tên>.github.io`), có thể đổi thành `'/'`.

---

## 4. Kết nối app với n8n (phần quan trọng nhất)

App nói chuyện với 2 webhook trong workflow `VMP` của bạn:

| Webhook | Method | Đường dẫn | Vai trò |
|---|---|---|---|
| Webhook (đọc) | **GET** | `/webhook/vmp-read` | Trả danh sách hạng mục từ Google Sheet |
| Webhook1 (ghi) | **POST** | `/webhook/vmp-write` | Cập nhật ngày/trạng thái một hạng mục |

### Bước 1 — Kích hoạt workflow n8n

- Mở workflow `VMP` trong n8n → bật **Active** (góc trên bên phải).
- Lấy **Production URL** của 2 webhook (KHÔNG dùng Test URL). Dạng:
  - Đọc: `https://<tên-n8n>.app.n8n.cloud/webhook/vmp-read`
  - Ghi: `https://<tên-n8n>.app.n8n.cloud/webhook/vmp-write`

> Workflow của bạn đã đặt `allowedOrigins: "*"` ở cả 2 webhook → trình duyệt
> trên GitHub Pages gọi được (CORS OK). Không cần chỉnh thêm.

### Bước 2 — Nhập URL vào app

Cách A — Nhập trên web (đơn giản nhất):
1. Mở web đã deploy → đăng nhập → tab **"Kết nối dữ liệu"**.
2. Dán **URL đọc** vào ô ①, **URL ghi** vào ô ②.
3. Bấm **"Kết nối & tải dữ liệu"**. URL sẽ được lưu lại cho lần sau.
4. Bấm **"Kiểm tra ghi"** để thử kết nối ghi (app gửi `ping`, n8n trả `pong`).

Cách B — Nhúng sẵn URL lúc build (không phải nhập tay):
- Vào repo → **Settings** → **Secrets and variables** → **Actions** → tab
  **Variables** → **New repository variable**, tạo 2 biến:
  - `VITE_VMP_READ_URL` = URL đọc
  - `VITE_VMP_WRITE_URL` = URL ghi
- Push lại (hoặc chạy lại Actions). App sẽ tự kết nối khi mở trang.
- ⚠️ Biến `VITE_` bị **nhúng vào mã JS công khai**. URL webhook n8n không phải
  khoá bí mật, nhưng nếu muốn kín, hãy dùng Cách A.

---

## 5. Luồng dữ liệu

```
Google Sheet  ──►  n8n (Code: dịch cột → JSON rows)  ──►  GET /vmp-read
                                                              │
                                              adapter dịch rows → {objects, activities}
                                                              │
                                                              ▼
                                                        VMP Monitor (web)
                                                              │
                              khi cập nhật trạng thái/ngày  ──►  POST /vmp-write
                                                              │
                                  n8n (Code: updateRow theo ID)  ──►  ghi Google Sheet
```

---

## 6. Giới hạn hiện tại của phần GHI & cách mở rộng

Webhook ghi của bạn (`vmp-write`) hiện chỉ xử lý:

- `action: "ping"` → kiểm tra kết nối.
- `action: "updateRow"` → cập nhật **ngày & trạng thái** của 1 hạng mục theo
  `id` (cột "ID thẩm định"). Các trường nhận: `tt_vmp`, `ngay_vmp`,
  `tt_de_cuong`, `ngay_de_cuong`, `tt_tham_dinh`, `ngay_tham_dinh`,
  `tt_bao_cao`, `ngay_bao_cao`, `lich_td`.

Vì vậy việc **Thêm / Sửa / Xoá *đối tượng*** trong tab "Danh mục đối tượng"
hiện chỉ thay đổi **tại chỗ** (trên web), chưa ghi vào Sheet — app sẽ báo rõ
điều này. Lý do: Sheet của bạn dò theo "ID thẩm định" (mỗi dòng = 1 hạng mục
thẩm định), không phải theo mã đối tượng.

**Muốn ghi luôn cả metadata đối tượng?** Thêm nhánh xử lý vào node
`Code in JavaScript1` của workflow:

```js
// ...sau đoạn xử lý ping & updateRow hiện có:
if (p.action === 'upsertObject') {
  const r = p.row || {};
  return [{ json: {
    __mode: 'upsert',
    ma: r.code, ten: r.name, /* ...ánh xạ tiếp các cột bạn cần... */
  } }];
}
if (p.action === 'deleteObject') {
  return [{ json: { __mode: 'delete', ma: p.code } }];
}
```

rồi nối tới node Google Sheets thao tác **append/update/delete** tương ứng
(dò theo cột "Mã đối tượng"). Khi đó app sẽ tự ghi vào Sheet.

> App tự nhận biết nguồn: nếu backend trả `{objects, activities}` (kiểu Apps
> Script) thì các lệnh `upsertObject`/`deleteObject` được gửi luôn; nếu là
> webhook n8n thì chỉ lưu tại chỗ cho tới khi bạn bổ sung nhánh trên.

---

## 7. Cấu trúc thư mục

```
vmp-monitor/
├─ .github/workflows/deploy.yml   # tự build & deploy GitHub Pages
├─ n8n/VMP-workflow.json          # bản sao workflow n8n của bạn (để version)
├─ public/favicon.svg
├─ src/
│  ├─ App.jsx                     # toàn bộ giao diện (giữ nguyên thiết kế)
│  ├─ main.jsx
│  ├─ index.css
│  └─ lib/
│     ├─ config.js                # đọc .env + lưu localStorage
│     └─ n8nAdapter.js            # ★ cầu nối dữ liệu n8n ↔ app
├─ .env.example                   # mẫu biến môi trường
├─ index.html
├─ package.json
└─ vite.config.js
```

## 8. Tinh chỉnh ánh xạ dữ liệu

Nếu Sheet của bạn dùng giá trị khác (vd phân loại ghi "Equipment" thay vì
"Thiết bị"), chỉ cần sửa các hàm trong **`src/lib/n8nAdapter.js`**:
`mapClass`, `mapDept`, `mapCrit`, `normStatus`. Mọi quy tắc ánh xạ nằm gọn ở đó.

---

*✨ VMP Monitor · CPC1 HN · V/Q Team — QLCL · EU GMP Annex 15 · WHO · PIC/S ✨*
