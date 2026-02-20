# Karaoke Sáu Nhàn - Upgrade Plan

## Mục tiêu

Cho phép khách giữ chỗ không cần chọn bài, chọn bài khi tới lượt, đổi beat khi đang hát. Tất cả thao tác đều thực hiện được trên cả 3 màn hình: Host, Web khách, TV. Đồng bộ realtime qua Firebase.

---

## Firebase Schema Update

```javascript
// Queue item hiện tại
{
  name: "Anh Tư",
  song: "Muộn Rồi Mà Sao Còn",
  videoId: "abc123",
  // ... các field hiện có
}

// Queue item mới (thêm fields)
{
  name: "Anh Tư",
  song: null,                // null = chưa chọn bài
  videoId: null,             // null = chưa có video
  status: "waiting",         // waiting | ready | singing | skipped | done
  changingBeat: false,       // true khi đang trong quá trình đổi beat
  beatOptions: [],           // mảng [{videoId, title, thumbnail}, ...]
  createdAt: timestamp
}
```

**Quy tắc status:**
- `waiting`: có tên, chưa có bài
- `ready`: có tên + có bài, sẵn sàng hát
- `singing`: đang hát
- `skipped`: bị host skip vì chưa có bài, chờ khách chọn xong host phát sau
- `done`: hát xong

---

## Tính năng 1: Giữ chỗ không cần chọn bài

### Host
- Thêm nút "Thêm khách" chỉ cần nhập tên, không bắt buộc chọn bài
- Queue hiện 2 kiểu item:
  - Có bài: `Anh Tư - Muộn Rồi Mà Sao Còn` (màu xanh)
  - Chưa có bài: `Anh Tư - Chờ chọn bài` (màu vàng)
- Host có thể chọn bài hộ khách bất cứ lúc nào (search + gán vào slot)

### Web khách
- Tab "Hàng chờ": thêm nút "Giữ chỗ" ở trên cùng
- Bấm → nhập tên → vào queue với `status: "waiting"`
- Sau đó khách thấy slot của mình trong hàng chờ, có nút "Chọn bài" nổi bật
- Bấm "Chọn bài" → mở search → chọn bài → Firebase update `song`, `videoId`, `status: "ready"`

### TV (localhost/tv)
- Hiện queue list bên cạnh hoặc overlay
- Slot chưa có bài hiện: `3. Anh Tư - ⏳ Chờ chọn bài`
- Slot có bài hiện: `4. Chị Nam - Duyên Phận`

### Code changes
- Bỏ validate `song required` khi add queue item
- Thêm field `status` vào Firebase write
- Queue list component render theo status
- Web: thêm UI "Giữ chỗ" + "Chọn bài cho slot"

---

## Tính năng 2: Chọn bài khi tới lượt

### Logic xử lý khi bấm "Bài tiếp theo"

NGUYÊN TẮC: Không tự động skip, không tự động xóa. Host toàn quyền quyết định.

```
if (nextItem.status === "ready") {
  // Có bài → phát bình thường
  TTS("Mời {name} hát bài {song}")
  playVideo(nextItem.videoId)
  setStatus("singing")

} else if (nextItem.status === "waiting") {
  // Chưa có bài → DỪNG LẠI, CHỜ HOST QUYẾT ĐỊNH
  // App KHÔNG tự skip, KHÔNG đếm ngược, KHÔNG đẩy xuống cuối
  
  // Trên host hiện rõ:
  // ┌─────────────────────────────────────┐
  // │  ⏳ Anh Tư - Chưa chọn bài         │
  // │                                     │
  // │  [Chờ chọn bài]  [Chọn hộ]  [Skip] │
  // └─────────────────────────────────────┘
  //
  // Option 1: "Chờ chọn bài" 
  //   → TTS: "Mời Anh Tư chọn bài"
  //   → Chờ Firebase update, khi khách chọn xong → tự phát
  //   → Trong lúc chờ, host có thể bấm Skip bất cứ lúc nào
  //
  // Option 2: "Chọn hộ"
  //   → Mở search ngay trên host
  //   → Host search + chọn bài + chọn beat hộ khách
  //   → Xong → phát luôn
  //
  // Option 3: "Skip"
  //   → Giữ nguyên slot trong queue (KHÔNG XÓA)
  //   → Chuyển sang người tiếp theo
  //   → Slot Anh Tư vẫn nằm đó, khi nào chọn bài xong
  //     host quay lại phát cho Anh Tư sau
}
```

### Quan trọng: KHÔNG BAO GIỜ TỰ ĐỘNG XÓA

- Slot chờ bị skip → vẫn nằm trong queue, không bị xóa
- Slot chờ đã chọn bài xong → chuyển thành "ready", host phát khi nào tùy ý
- Chỉ host mới có quyền xóa slot (bấm nút xóa thủ công)
- Web khách KHÔNG có nút xóa

### Skip không phải xóa

Khi host bấm Skip trên slot chờ:
```
// KHÔNG xóa, chỉ đánh dấu đã bị skip
setStatus("skipped")  // waiting | ready | singing | skipped | done

// Queue vẫn hiện slot này nhưng mờ đi:
// 1. Chị Nam - Duyên Phận         ▶ (đang hát)
// 2. Anh Tư - Chờ chọn bài        ⏸ (đã skip, chờ chọn)
// 3. Bé Lan - Muộn Rồi Mà Sao Còn   (tiếp theo)

// Khi Anh Tư chọn bài xong → status chuyển thành "ready"
// Host thấy slot sáng lên, bấm phát khi nào tùy ý
```

### Host toàn quyền

| Hành động | Tự động | Host quyết định |
|---|:---:|:---:|
| Skip slot chờ | ❌ | ✅ |
| Xóa slot | ❌ | ✅ |
| Chờ khách chọn bài | ❌ | ✅ |
| Chọn bài hộ khách | - | ✅ |
| Sắp xếp lại queue | - | ✅ |
| Phát slot đã skip khi có bài | ❌ | ✅ |

### Nhắc trước khi tới lượt
- Khi bài đang phát còn ~30 giây + người tiếp theo chưa chọn bài:
  - TTS: "{name} ơi, sắp tới lượt, xin mời chọn bài"
  - Web: slot của khách flash/highlight
  - TV: hiện text nhắc nhở
- Đây chỉ là nhắc nhở, KHÔNG ép buộc, KHÔNG countdown

### Web khách
- Khi gần tới lượt + chưa chọn bài: banner "Sắp tới lượt bạn! Chọn bài ngay"
- Bấm → search → chọn bài + beat → queue update → host thấy ngay
- Khách KHÔNG có quyền skip hay xóa bất kỳ slot nào

---

## Tính năng 3: Chọn beat trước khi vào queue (QUAN TRỌNG)

Đây là bước chặn ngay từ đầu, giảm 90% trường hợp đổi beat khi đang hát.

### Flow chọn bài mới (thêm 1 bước chọn beat)

```
TRƯỚC:  Search → Bấm "+" → Nhập tên → Vào queue
SAU:    Search → Bấm "+" → Hiện danh sách beat → Chọn beat → Nhập tên → Vào queue
```

### Chi tiết

```
1. Khách search "Muộn Rồi Mà Sao Còn" → thấy kết quả như hiện tại
2. Bấm "+" trên bài muốn hát
3. App KHÔNG add vào queue ngay, mà:
   a. Lấy tên bài + ca sĩ từ kết quả
   b. Search thêm YouTube với nhiều query:
      - "{song} {artist} karaoke beat"
      - "{song} karaoke tone nữ"
      - "{song} karaoke tone nam"
      - "{song} karaoke phối mới"
   c. Gộp kết quả, loại trùng, sắp xếp theo view count
4. Hiện màn hình "Chọn beat" với 3-5 options:
   ┌──────────────────────────────────┐
   │  Chọn beat cho:                  │
   │  Muộn Rồi Mà Sao Còn - Sơn Tùng│
   │                                  │
   │  ┌─────┐ Beat gốc có bè    ✓   │
   │  │thumb│ SKYMTP · 1.1M views     │
   │  └─────┘                         │
   │                                  │
   │  ┌─────┐ Beat tone nữ           │
   │  │thumb│ KaraokeVN · 500K views  │
   │  └─────┘                         │
   │                                  │
   │  ┌─────┐ Beat phối mới          │
   │  │thumb│ MusicBox · 200K views   │
   │  └─────┘                         │
   │                                  │
   │  [    XÁC NHẬN    ]              │
   └──────────────────────────────────┘
5. Khách chọn beat → bấm xác nhận → nhập tên → vào queue
6. Queue item lúc này đã có đầy đủ: tên + bài + videoId (beat đúng ý)
```

### Mặc định chọn sẵn
- Beat đầu tiên (nhiều view nhất) được chọn sẵn
- Khách không muốn đổi thì bấm "Xác nhận" luôn, không mất thêm thời gian
- Chỉ ai kỹ tính mới lướt chọn beat khác

### Áp dụng cho cả Host
- Host chọn bài hộ khách → cũng hiện bước chọn beat
- Host chọn nhanh beat mặc định hoặc hỏi khách "beat nào?"

---

## Tính năng 4: Đổi beat khi đang hát (backup)

Vẫn giữ tính năng này nhưng ít khi cần dùng vì đã chọn beat từ trước.

### Flow đổi beat

```
1. Khách/Host bấm "Đổi beat" trên slot đang singing
2. Firebase update:
   - changingBeat: true
   - beatOptions: [lấy lại từ bước chọn beat ban đầu, hoặc search mới]
3. TV hiện overlay chọn beat (video đang phát mờ đi)
4. Khách/Host chọn beat mới
5. Firebase update:
   - videoId: newVideoId
   - changingBeat: false
   - beatOptions: []
6. TV tắt overlay, load video mới ngay lập tức
```

### TV - Overlay đổi beat

```
┌─────────────────────────────────────────────┐
│                                             │
│           (video đang phát mờ đi)           │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  Anh Tư đang đổi beat                │  │
│  │                                       │  │
│  │  ┌─────┐  1. Beat gốc có bè     ✓   │  │
│  │  │thumb│     SKYMTP · 1.1M views      │  │
│  │  └─────┘                              │  │
│  │                                       │  │
│  │  ┌─────┐  2. Beat tone nữ            │  │
│  │  │thumb│     Karaoke VN · 500K views  │  │
│  │  └─────┘                              │  │
│  │                                       │  │
│  │  ┌─────┐  3. Beat phối mới           │  │
│  │  │thumb│     Music Box · 200K views   │  │
│  │  └─────┘                              │  │
│  │                                       │  │
│  │  Chọn trên điện thoại hoặc nhờ host  │  │
│  └───────────────────────────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

- TV chỉ hiển thị, không có input
- Overlay hiện khi `changingBeat === true`
- Beat đang được chọn highlight xanh + dấu ✓
- Khi xác nhận → overlay biến mất, video mới load

### Host - UI đổi beat
- Trên queue item đang singing: nút "Đổi beat"
- Bấm → hiện panel beat options
- Chọn → Firebase update → TV + Web đồng bộ

### Web khách - UI đổi beat
- Slot đang hát của mình: nút "Đổi beat"
- Bấm → hiện danh sách beat
- Chọn → Firebase update → TV load video mới

---

## Quyền thao tác 3 màn hình

| Hành động | Host | Web khách | TV |
|---|:---:|:---:|:---:|
| Thêm khách (giữ chỗ) | ✅ | ✅ (tự thêm tên mình) | Hiện queue |
| Chọn bài cho slot | ✅ (cho bất kỳ ai) | ✅ (chỉ slot của mình) | Hiện update |
| Bấm "Bài tiếp theo" | ✅ | ❌ | Phát video |
| Đổi beat | ✅ | ✅ (chỉ slot mình) | Hiện overlay |
| Xóa/sắp xếp queue | ✅ | ❌ | Hiện update |

---

## Cách nhận diện "slot của mình" trên Web

Khi khách giữ chỗ hoặc thêm bài, lưu `queueItemId` vào localStorage. Web chỉ cho phép thao tác trên các slot có id trùng với localStorage. Đơn giản, không cần đăng nhập.

```javascript
// Khi khách add slot
const itemId = firebase.push(queueRef, { name, status: "waiting" }).key
localStorage.setItem("mySlots", JSON.stringify([
  ...existingSlots, 
  itemId
]))

// Khi render queue
const mySlots = JSON.parse(localStorage.getItem("mySlots") || "[]")
const isMySlot = mySlots.includes(item.id)
// Nếu isMySlot → hiện nút "Chọn bài" / "Đổi beat"
// Nếu không → chỉ hiện thông tin
```

---

## Thứ tự phát triển

### Ngày 1: Giữ chỗ + Chọn bài sau
1. Update Firebase schema: thêm `status` field (waiting | ready | singing | skipped | done)
2. Host: cho phép add queue item không có song (nút "Thêm khách")
3. Host: queue list render theo status (có bài / chưa có bài / đã skip)
4. Host: khi next gặp slot chờ → hiện 3 nút: Chờ / Chọn hộ / Skip
5. Host: skip không xóa, chỉ đánh dấu skipped, slot vẫn trong queue
6. Web: thêm nút "Giữ chỗ" trên tab Hàng chờ
7. Web: thêm nút "Chọn bài" trên slot chưa có bài
8. TV: render queue list với các trạng thái khác nhau

### Ngày 2: Chọn beat trước khi vào queue
1. Viết function search beat variants từ YouTube (3-4 query patterns)
2. UI màn hình "Chọn beat" sau khi bấm "+" (dùng chung cho Host + Web)
3. Beat mặc định chọn sẵn (nhiều view nhất)
4. Xác nhận → nhập tên → vào queue với đầy đủ info
5. Lưu beatOptions vào Firebase item để dùng lại nếu đổi beat sau

### Ngày 3: Đổi beat khi đang hát + Polish
1. Host + Web: nút "Đổi beat" trên slot singing
2. Firebase: update `changingBeat`, `beatOptions`
3. TV: overlay component hiện danh sách beat khi `changingBeat === true`
4. Chọn beat mới → Firebase update videoId → TV load video mới
5. TTS nhắc chọn bài khi gần tới lượt (chỉ nhắc, không ép)
6. Slot skipped tự sáng lên khi khách chọn bài xong → host phát khi nào tùy ý
7. Test toàn bộ flow trên 3 màn hình

---

## Không cần thay đổi

- Firebase project / config: giữ nguyên
- Search bài: giữ nguyên
- YouTube player: giữ nguyên
- TTS: giữ nguyên, chỉ thêm vài message mới
- Extend display + TV fullscreen: giữ nguyên
- PostMessage giữa host ↔ TV: giữ nguyên, thêm message type mới cho đổi beat
