# 字間 ZIJIAN

安靜、俐落的中英文打字練習室。

**網站：[字間 ZIJIAN](https://haohao-0725.github.io/Typing-website/)** · [原始碼](https://github.com/haohao-0725/Typing-website) · [部署狀態](https://github.com/haohao-0725/Typing-website/actions/workflows/pages.yml)

## 在本機開啟

需要 Node.js 22 以上。不需要安裝 npm 套件。

```powershell
cd Z:\VScode\typing_website
npm run dev
```

開啟 <http://127.0.0.1:5173/>。修改檔案後重新整理頁面；本機伺服器只監聽 127.0.0.1。

```powershell
npm test          # 計分、題目佇列、組字事件、倒數、儲存與靜態頁面檢查
npm run build    # 輸出至 dist/，只會重建這個輸出資料夾
npm run preview  # 在 http://127.0.0.1:4173/ 檢查 dist/
```

## 第一版功能

- 中文單字、中文文章、英文單字、英文文章四種練習。
- 中文採繁體字，單字為日常詞彙；英文區分大小寫。
- 1、3、5 分鐘，或自訂 1–60 整數分鐘；第一個字或中文組字開始時才啟動倒數。
- 單字固定顯示 10 題，按 Enter 送出後補題；英文也可按空白送出。
- 文章來自維基百科，包含標點與句內空格。逐句輸入、Enter 送出，打完一篇接續下一篇，直到時間結束。
- 輸入錯誤仍可送出；送出前可修正，紀錄保留每題最終輸入。
- 即時速度、正確率、正確／錯誤字元；測驗結束可逐題查看、下載 JSON。
- 瀏覽器保留最近 50 次測驗。儲存受限或容量不足時顯示提示，仍可下載當次結果。
- 中文輸入法的選字 Enter 與送出 Enter 分開處理；未完成組字不計分。
- 切換分頁仍依實際時間倒數，不接受貼上或拖入文字。
- 響應式排版、原生可用鍵盤操作的對話框、減少動態效果設定、跳至主要內容連結。

## 計分規則

中文 CPM＝正確字元／實際分鐘；英文 WPM＝正確字元／5／實際分鐘。

使用 Unicode grapheme 與 NFC 正規化，例如組合重音只算一字。字元包含標點、數字和句內空格；全形與半形、大小寫視為不同。單字間 Enter、文章換句不算字元。

逐題使用 Levenshtein 文字對齊，將替換、漏字與多打分別記錄，避免一個漏字讓後面全部算錯。正確率＝正確字元／（正確＋錯誤）×100%。相同最短編輯距離的比對採固定順序，因此少數重複文字可能有多種同樣合理的對齊。

按 Enter 視為提交整題，缺少的文字算漏字；時間到或提前結束只比對目前已輸入的部分，不把未打到的句尾算錯。這是本站的練習規則，與其他測驗的扣分方式可能不同。不同模式、不同語言的成績應分開比較。

## 專案結構

| 檔案 | 用途 |
| --- | --- |
| `index.html` | 共用靜態 HTML 模板，包含可讀介紹與完整對話框 |
| `src/main.js` | 測驗流程、中文組字、計時與介面 |
| `src/engine.js` | 文字對齊、計分、單字佇列 |
| `src/storage.js` | 本機歷史紀錄與儲存失敗處理 |
| `src/words.js` | 自行編選的中英文單字題庫 |
| `src/articles.json` | 六篇維基百科節錄及逐篇版本、來源、授權 |
| `src/style.css` | 暖白、墨綠與朱紅的文字介面 |
| `scripts/site.mjs` | 五個可獨立讀取的靜態頁面與 SEO 資訊 |
| `scripts/build.mjs` | 本地建置；正式網址設定後產生 sitemap、canonical |
| `scripts/import-wikipedia.mjs` | 手動更新維基百科節錄，更新後需檢閱內容 |
| `docs/架站研究.md` | 架站方案、Google 收錄方式與官方參考 |

## 文章來源與授權

目前中文：茶、自行車、圖書館；英文：Coffee、Bicycle、Library。

文章於 2026-10-29 透過 Wikimedia API 取得，節錄導言前兩段、移除註腳與換行並合併空白；中文以臺灣繁體顯示。API 偶爾僅有一段導言，此時取該段。每筆資料包含永久版本連結與作者編輯歷史，使用介面也提供來源。

文章由 Wikipedia contributors 撰寫，節錄內容依 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) 提供，沿用相同授權。此授權適用於文章內容，並不表示其他程式碼自動採用相同授權。程式碼尚未選擇公開授權，正式公開 repository 前可再決定。

可手動執行 `npm run content:refresh` 更新題庫。這不是建置或測驗的必要步驟；正式上線前應人工檢閱新版本文字，避免 Wikipedia 編輯造成題目突然變動。測驗時讀取已收錄的本地文章，不呼叫 Wikimedia API。

## GitHub Pages 自動部署

正式網址為 `https://haohao-0725.github.io/Typing-website/`。Pages 使用 GitHub Actions 作為發佈來源，每次 push 到 `main` 或手動執行 `Deploy GitHub Pages`，會自動：

1. 使用 Node.js 24 執行測試。
2. 從 Pages 設定讀取正式網址，透過 `SITE_URL` 建置靜態 HTML、canonical 與 sitemap。
3. 上傳 `dist/`，測試與建置成功後部署至 `github-pages` 環境。

流程位於 `.github/workflows/pages.yml`，官方 Actions 固定至已確認的 commit。無須手動維護 `gh-pages` 分支，也不用把 `dist/` 加進 Git。若要在本機檢查正式網址設定：

```powershell
$env:SITE_URL = 'https://haohao-0725.github.io/Typing-website/'
npm test
npm run build
```

將 `dist/` 作為 GitHub Pages 發佈成品。所有資源與導覽使用相對路徑，可放在根網域或 repository 子目錄。首頁 canonical 指向 `/zh/words/`，避免和中文單字頁重複；sitemap 收錄四種主要模式。

網站 sitemap 位於 [sitemap.xml](https://haohao-0725.github.io/Typing-website/sitemap.xml)。Google Search Console 的所有權驗證與提交尚未設定；網站公開後 Google 可能自行發現，仍不保證收錄時間或排名。

## 隱私與現階段限制

無登入、後台、遠端排行榜、第三方分析或跨裝置同步。輸入與測驗紀錄僅存在瀏覽器 localStorage；清除網站資料會移除。瀏覽器儲存空間不足時不會繼續寫入歷史，介面會提示下載。

目前字型透過 Google Fonts 載入，因此初次開啟需要向 Google 字型服務請求字型；失敗時使用本機備援字型，練習功能不受影響。若要完全不依賴第三方資源，可將字型轉為自託管。網站透過 GitHub Pages 託管，GitHub 會為安全用途記錄訪客 IP 位址。

輸入法已包含瀏覽器組字事件的防護與自動事件測試；仍應在你實際使用的注音、倉頡、嘸蝦米或其他輸入法上確認選字手感。手機能操作，但軟體鍵盤的自動改字可能影響測驗，比較成績時建議使用同一裝置與輸入法。
