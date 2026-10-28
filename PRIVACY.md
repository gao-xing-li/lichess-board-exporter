# Privacy policy / 隐私说明

**Chess Position Exporter for Lichess** operates locally in the browser.

- It reads the visible chessboard, move list, and relevant puzzle page metadata on `https://lichess.org/*` to produce FEN text and a copyable review prompt.
- Board snapshots and move records are kept in the current page's memory only. They are not uploaded or synced by the extension.
- It does **not** collect personal information, account credentials, browsing history, or analytics. It has no extension-controlled network endpoint.
- It writes text to the system clipboard **only when you click a copy button**. What you subsequently paste into another site is governed by that site's own policies.
- Refreshing or closing the page clears the extension's in-page session state.

## Permissions

- `https://lichess.org/*`: read the chessboard and visible move list on Lichess.
- `activeTab` and `scripting`: enable the extension's reader on an already open Lichess tab if needed.
- `clipboardWrite`: copy FEN or a chess review prompt on request.

No affiliation with Lichess or OpenAI. Please avoid external assistance in competitive games when prohibited by site rules.

---

本扩展仅在浏览器本机读取 Lichess 页面展示的棋盘与棋谱；不上传、不收集账号密码或分析数据，也不进行用户跟踪。只有用户点击复制按钮时才会写入剪贴板；复制内容被粘贴到其他服务后的处理遵循该服务的隐私政策。刷新或关闭网页会清除本页内存中的记录。