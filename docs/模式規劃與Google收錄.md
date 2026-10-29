# 現行介面、分析室與搜尋設定

本文件取代上一輪的模式擴充提案。使用者已決定不做錯字複習，改為鍵盤熱圖分析；Google Search Console 所有權驗證由使用者手動完成。

## 已實作

- 中英文各 5,000 個唯一詞彙、各十篇文章。
- 單字六格單列：上一題、目前題目、後續四題。
- 介面語言與練習語言分開；繁體中文與英文介面皆有實體靜態 HTML。
- 主畫面移除裝飾標語、重複註解與額外入口，保留必要操作與成績。
- 分析室依最近五十次已儲存測驗，分開呈現字元錯誤位置及實體鍵位的錯題關聯。
- 示範熱圖不混入個人資料；每鍵可查看樣本、次數與比例，小樣本以虛線標示。

## 分析室的限制

英文最終錯字可以對應 US QWERTY 的字元位置；這不代表曾按下對應實體鍵，尤其大小寫不能推斷 Shift。

中文不由錯誤漢字反推注音、倉頡或其他輸入法。新版只在測驗輸入框累計 KeyboardEvent.code，每題每個鍵位至多貢獻一個樣本。比例為「使用該鍵且答案有錯的題數／使用該鍵的題數」。這是關聯資料，不能證明該鍵導致錯誤。舊紀錄、未提供 code 的裝置與未送出的部分答案不補值。參考：[MDN KeyboardEvent.code](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code)。

不存逐次按鍵順序，不做全域鍵盤監聽，不上傳答案或鍵位資料。完整規則、資料範圍與公式在分析室的可展開說明中。

## Google 與平台

現行 GitHub Pages 架構可以提供 HTTP 200、可供索引的靜態 HTML、適當標題、canonical、雙語 hreflang 與 sitemap，沒有為了收錄而更換平台的技術必要。搜尋資格與關鍵字排名是不同問題；目前不能保證「打字練習」的特定排名。[Google 技術需求](https://developers.google.com/search/docs/essentials/technical)

本次網站端提供十個實體頁面（含兩個首頁別名）、八個主要模式網址、WebApplication 結構化資料，以及可直接讀取的 FAQ。原本四個網址不變，英文介面使用 en-ui/ 子路徑。

使用者手動新增 Search Console 網址前置字元資源：
`https://haohao-0725.github.io/Typing-website/`

HTML 標記的 content 值可填入 site.config.json 的 googleSiteVerification 後 push。HTML 驗證檔也可放在 public/，建置會將合法的 google….html 複製到網站根目錄。沒有 Google 提供的真實內容時不產生假驗證資訊。

驗證後提交 `https://haohao-0725.github.io/Typing-website/sitemap.xml`，再用網址檢查確認 Google 自己回報的索引狀態。Google 可能需要時間抓取，提交不保證收錄或排名。[Google 所有權驗證](https://support.google.com/webmasters/answer/9008080?hl=en)、[要求抓取](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl)

若未來需要會員、跨裝置同步、可信排行榜或伺服器功能，再依需求評估具備後端能力的部署服務；更換靜態託管商本身不會保證搜尋排名。
