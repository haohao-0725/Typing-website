// Static, readable content in both interfaces; no client-side fetch is needed.
export function appendixMarkup(ui = 'zh') {
  if (ui === 'en') return `<details class="help-details site-appendix" id="appendix">
<summary>About &amp; scoring</summary><div class="appendix-content">
<section><h2>A place to just type</h2>
<p>ZIJIAN is a free place to practice Chinese and English typing. It started with a simple idea: when trying a new keyboard, sometimes all you want is a place to start typing right away.</p>
<p>Choose words or passages, set a duration, and type. No account or payment is required. The timer starts with your first input, including Chinese IME composition. Words focus on short prompts; passages include punctuation, case and spaces.</p></section>
<section><h2>How results are calculated</h2>
<dl class="appendix-formulas"><dt>Chinese · CPM</dt><dd>Correct characters ÷ elapsed minutes.<small>300 correct characters in 3 minutes = 100 CPM.</small></dd>
<dt>English · WPM</dt><dd>Correct characters ÷ 5 ÷ elapsed minutes.<small>750 correct characters in 3 minutes = 50 WPM. A standard word means five characters, not one submitted word.</small></dd>
<dt>Accuracy</dt><dd>Correct characters ÷ (correct characters + errors) × 100%.<small>90 correct characters and 10 errors = 90% accuracy. Before any characters are scored, there is no accuracy sample.</small></dd></dl>
<p>Punctuation, digits and spaces within sentences count. Comparison distinguishes substitutions, omissions and extra characters. Enter submits the full answer, so missing text counts as an error. At timeout or an early finish, only the attempted prefix is scored; unfinished IME composition is excluded. Elapsed time includes time spent in another tab.</p>
<p>Compare results using the same language, mode and input method; different tests can have different difficulty.</p></section>
<section><h2>Your practice stays in this browser</h2>
<p>The last 50 tests are stored in this browser, including final answers and aggregate key-position counts for Analysis. Your input is not uploaded. You can clear history or download an individual result. There is no cross-device sync; clearing site data removes saved results. Sources, licenses and hosting details are available in the footer.</p></section>
</div></details>`;
  return `<details class="help-details site-appendix" id="appendix">
<summary>說明附錄</summary><div class="appendix-content">
<section><h2>一個打開就能開始打字的地方</h2>
<p>字間是免費、無償提供的中文與英文打字練習網站。起點很簡單：有時候只是想試用一下新鍵盤，希望有個功能簡單、順手，打開就能開始打字的地方。</p>
<p>選好單字或文章、設定時間，就可以開始，不需要註冊或付費。輸入第一個字後開始計時，中文組字開始也會計時。單字適合短詞練習；文章則包含標點、大小寫與句內空格。</p></section>
<section><h2>速度與正確率怎麼算？</h2>
<dl class="appendix-formulas"><dt>中文速度 · CPM</dt><dd>正確字元數 ÷ 實際練習分鐘。<small>例如：3 分鐘輸入 300 個正確字元，速度就是每分鐘 100 字。</small></dd>
<dt>英文速度 · WPM</dt><dd>正確字元數 ÷ 5 ÷ 實際練習分鐘。<small>例如：3 分鐘輸入 750 個正確字元，就是 50 WPM。每 5 個字元折算一個標準單字，不是以送出幾個單字計算。</small></dd>
<dt>正確率</dt><dd>正確字元數 ÷（正確字元數 ＋ 錯誤字元數）× 100%。<small>例如：90 個正確、10 個錯誤，正確率就是 90%。尚未比對任何字元時，沒有可計算的正確率樣本。</small></dd></dl>
<p>標點、數字與句內空格也算字元，比對會區分錯字、漏字與多打的字。按 Enter 視為送出整題，少打的部分算漏字；時間到或提前結束，只結算已輸入的部分，未完成的中文組字不計分。切換分頁仍會繼續計時。</p>
<p>建議在相同語言、模式與輸入法下比較自己的成績；不同題目與模式的難度可能不同。</p></section>
<section><h2>練習紀錄留在你的瀏覽器</h2>
<p>此瀏覽器保留最近 50 次測驗，包含最終答案與分析室使用的鍵位累計次數，不會上傳輸入內容。你可以清除紀錄或下載單次結果；目前沒有跨裝置同步，清除網站資料也會移除已儲存的成績。題庫來源、授權與代管服務說明可從頁尾查看。</p></section>
</div></details>`;
}
