# 字間 ZIJIAN

[網站](https://haohao-0725.github.io/Typing-website/) · [English interface](https://haohao-0725.github.io/Typing-website/en-ui/zh/words/) · [部署紀錄](https://github.com/haohao-0725/Typing-website/actions/workflows/pages.yml)

純靜態中英文打字練習工具，無帳號、無後台；測驗與分析在瀏覽器完成。

## 本機執行

需要 Node.js 22 以上，不需要安裝 npm 套件。

```powershell
npm run dev      # http://127.0.0.1:5173/
npm test
npm run build
npm run preview  # http://127.0.0.1:4173/
```

修改後重新整理。開發伺服器僅監聽 127.0.0.1；修改產頁腳本後需重啟 dev。preview 讀取 dist/，更新後重新 build 即可。

## 功能

- 中文／英文練習，各 5,000 個去重詞彙與 10 篇維基百科文章。
- 介面提供繁體中文／英文，與練習語言獨立切換。
- 1、3、5 或自訂 1–60 分鐘；第一個字或中文組字開始時啟動計時。
- 單字一列六格：上一題、目前目標、後續四題。輸入目標固定第二格，左側只保留最近一題的對錯。
- Enter 送出，英文單字也可用空白鍵；打錯仍可送出。文章逐句練習、完成後接續。
- 成績、逐題紀錄、JSON 下載與瀏覽器最近 50 次測驗。
- 分析室：字元錯誤位置與實體鍵位的錯題關聯熱圖，支援次數／比例與可檢查的計算方式。沒有錯字複習功能。
- 主畫面僅保留功能資訊；完整規則與隱私說明收在對話框。

## 熱圖如何解讀

**字元錯誤位置**：最終答案以編輯距離對齊。錯字、漏字計入「應輸入字元」的 US QWERTY 位置，多打的字計入其輸出位置；分母為該鍵對應的所有已比對字元。它是字元分布，不是觀察到的實體按鍵。大小寫共用字母鍵，不推斷 Shift。

**錯題關聯鍵位**：新版測驗在輸入框內累計 KeyboardEvent.code，不保存按鍵順序。每道完整送出的題目，每個使用過的鍵位只貢獻一個樣本；分子是答案有錯的題數，分母是使用該鍵的題數。這只能說鍵位與錯題同時出現，不能證明該鍵打錯。中文輸入法不由錯誤漢字反推注音／倉頡；舊紀錄、缺少 code 的裝置及未送出的部分答案不補值。

樣本少於五次以虛線標示。示範資料與個人資料分開，不會儲存為成績。鍵位圖採 US QWERTY 位置；其他鍵盤配置與手機提供的 code 可能不同。

## 題庫與授權

原題庫去重後為中文 298、英文 371 個。目前兩者各 **5,000** 個。

- 中文以 CC-CEDICT 正體詞條搭配 wordfreq 詞頻選取，優先保留自行編選詞；過濾部分專名、異體與不適合詞條。
- 英文以 wordfreq 詞頻選取 2–14 字母的小寫詞彙，去重並排除部分網頁雜訊與粗俗詞。
- 產生的詞庫**資料**依 CC BY-SA 4.0 提供；來源、改作方式、原始版本與校驗碼見 [word-sources.json](public/word-sources.json) 與 [授權資料](public/licenses/)。資料授權與應用程式碼分開管理。
- 文章由 Wikipedia contributors 撰寫，採 CC BY-SA 4.0。每篇保存永久版本、作者歷史與節錄修改說明，介面「來源」可查。

已產生的詞庫隨 Git 保存；部署不需要 Python 或外部 API。重新產生時：

```powershell
python -m pip install --target artifacts/word-tools wordfreq==3.1.1
npm run content:words
```

CC-CEDICT 官方下載若過慢，腳本會中止；可將官方壓縮檔放到 artifacts/word-sources/cedict.u8.gz 後再執行。來源快取不進 Git。

文章更新用 `npm run content:refresh`；只追加題目並保留已收錄版本用 `npm run content:refresh -- --append`。更新後需檢閱內容。

## 部署與搜尋設定

main 的每次 push 會執行測試、建置並部署到 GitHub Pages。原本四個練習網址保留，英文介面新增在 en-ui/ 下。

網站提供十個實體 HTML（含兩個首頁別名）、八個主要測驗頁的 canonical 與 hreflang、WebApplication 結構化資料、可讀標題與說明，以及 [sitemap](https://haohao-0725.github.io/Typing-website/sitemap.xml)。網站屬於能被搜尋引擎索引的靜態架構，無須為了收錄更換平台；這些設定不保證任何關鍵字排名。

Google Search Console 由網站擁有者手動操作：
1. 新增網址前置字元資源：`https://haohao-0725.github.io/Typing-website/`。
2. 若選 HTML 標記驗證，把提供的 content 值填入 site.config.json 的 googleSiteVerification，commit/push 後驗證。預設為空，不會生成假的驗證標記。
3. 若選 HTML 檔案驗證，把 Google 提供的 google….html 原檔放入 public/；建置會另複製到網站根目錄與現有 `/zh/words/` 資源目錄，保留完整檔名與內容。驗證成功後仍需保留檔案。
4. 驗證後提交 sitemap.xml，使用網址檢查工具檢查主要測驗頁。

專案子目錄的 robots.txt 不取代網域根目錄 robots.txt。Google 實際選定的索引與排名應以 Search Console 報告為準。

## 計分與隱私

中文 CPM＝正確字元／實際分鐘；英文 WPM＝正確字元／5／實際分鐘。正確率＝正確／（正確＋錯誤）。使用 Unicode grapheme、NFC 與文字對齊，區分錯字、漏字與多打。

按 Enter 視為提交完整題目；時間到或提前結束只結算已輸入前綴，未完成的中文組字不計分。不同模式與輸入法的速度不宜直接相比。

輸入內容、答案與鍵位累計只儲存在此瀏覽器，不上傳。儲存受限時仍可練習與下載當次結果，但不保留歷史。Google Fonts 提供字型；GitHub Pages 可能為安全用途記錄 IP。清除瀏覽器網站資料會移除歷史。

## 主要程式

- src/main.js：測驗、組字、計時與介面。
- src/engine.js：計分、佇列與句子切分。
- src/analytics.js、src/analysis-ui.js：熱圖計算與分析室。
- src/i18n.js：介面翻譯；scripts/site.mjs 產生各語系 HTML。
- src/words.js：產生的詞庫資料；scripts/import-words.py 為匯入工具。
- site.config.json：正式網址與選用的 Google 驗證值。
