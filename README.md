# 數獨 Sudoku

安靜、乾淨、**無廣告**的數獨小網站。可以直接在瀏覽器玩，也可以「加到主畫面」當成 App 使用，離線也能玩。

A calm, clean, ad-free Sudoku web app. Play in the browser or install it as a PWA — works offline.

👉 **線上遊玩 Play:** `https://<你的 GitHub 帳號>.github.io/sudoku/`

---

## 功能 Features

- **四種難度**：簡單、中等、困難、專家，題目即時產生，每題保證唯一解
- **每日挑戰**：同一天全世界拿到同一題
- **筆記模式**：在格子裡標記候選數字；填入正確答案時，自動清掉同行、同列、同宮的相同筆記
- **復原、清除、提示**
- **錯誤上限 3 次**，有「再給一次機會」，也可以在設定裡關掉
- **計時器、暫停**，切到其他 App 時自動停止計時
- **高亮**：同行、同列、同宮，以及相同數字
- **統計**：記錄完成了幾局
- **進度自動保存**：關掉網頁再打開，可以接著玩
- **淺色、深色模式**，大字體選項
- **繁體中文、English**
- **PWA**：可以安裝到手機主畫面、離線遊玩
- **鍵盤操作**：方向鍵移動、`1`–`9` 填數字、`Backspace` 清除、`N` 切換筆記、`H` 提示、`Ctrl+Z` 復原、`空白鍵` 暫停

## 加到手機主畫面

- **iPhone（Safari）**：打開網址 → 點下方「分享」按鈕 → 「加入主畫面」
- **Android（Chrome）**：打開網址 → 右上角 ⋮ → 「加到主畫面」或「安裝應用程式」

安裝後就像一般 App，沒有網址列，也不會跳出任何廣告。

## 部署到 GitHub Pages

1. 在 GitHub 建立名為 `sudoku` 的 repository
2. 把這個資料夾推上去：
   ```bash
   git remote add origin https://github.com/<你的帳號>/sudoku.git
   git push -u origin main
   ```
3. 到 repo 的 **Settings → Pages**，Source 選 **Deploy from a branch**，Branch 選 `main`、資料夾選 `/ (root)`，按 Save
4. 等一兩分鐘，網站就會出現在 `https://<你的帳號>.github.io/sudoku/`

> 更新程式後，記得把 `sw.js` 裡的 `CACHE = 'sudoku-v1'` 版本號加 1（例如 `v2`），已安裝的使用者才會拿到新版本。

## 本機開發

不需要安裝任何套件或建置工具，只要一個靜態伺服器：

```bash
python -m http.server 8123
```

然後打開 <http://localhost:8123>。在 localhost 上不會啟用 Service Worker，改檔案後重新整理就能看到。

## 專案結構

```
├── index.html             # 頁面
├── css/style.css          # 樣式（黑白主題、RWD）
├── js/sudoku.js           # 題目產生、唯一解檢查、難度分級
├── js/i18n.js             # 中英文字串
├── js/app.js              # 遊戲狀態、畫面、操作
├── sw.js                  # Service Worker（離線快取）
├── manifest.webmanifest   # PWA 設定
└── icons/                 # App 圖示
```

## 題目怎麼產生的？

1. 用回溯法隨機填出一個完整的數獨解答
2. 以中心對稱的方式一對一對挖空，每挖一次都確認題目仍然**只有唯一解**
3. 用「只靠排除法能不能解完」來分級：
   - 簡單：只需要「唯一候選數」
   - 中等：需要「隱性唯一」
   - 困難、專家：需要更進階的技巧，提示數更少
4. 每日挑戰用日期當亂數種子，所以同一天每個人拿到的題目都一樣

## 授權 License

[MIT](LICENSE)：任何人都可以自由使用、修改、散布，只要保留版權聲明即可。

字型使用 [Noto Sans TC（思源黑體）](https://fonts.google.com/noto/specimen/Noto+Sans+TC)，採 SIL Open Font License。
