# Chess Position Exporter for Lichess · 棋盘助手

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

一个简洁的 Chrome / Edge 浏览器扩展：**直接读取 Lichess 网页棋盘**，生成 FEN，保存战术谜题起始局面，并复制棋谱与复盘提示词。无需截图识别或登录其他服务。

**非 Lichess、OpenAI 官方产品。** 本扩展不会计算最佳着法；请勿在禁止外部辅助的对局中使用。

## 三个按钮

| 按钮 | 用途 |
| --- | --- |
| **复制当前局面** | 导出当前显示棋盘的 FEN 与棋子坐标。 |
| **设当前为起点** | 在解题前手动固定起始局面。 |
| **复制复盘记录** | 导出保存的起点与网页棋谱，方便复盘。 |

行棋方修正、FEN 检查和记录诊断都收在 **更多选项** 内。

## 安装

1. 从仓库下载源码 ZIP（或从 Releases 下载发布包）并解压。
2. Chrome 输入 `chrome://extensions/`，Edge 输入 `edge://extensions/`。
3. 开启开发者模式，选择 **加载已解压的扩展程序**。
4. 指向含 `manifest.json` 的文件夹。若安装过旧版，先禁用旧版并刷新 Lichess 页面。

## 日常使用

开始 Lichess 战术题之前，点击 **设当前为起点**。正常下棋后点击 **复制复盘记录**，把文字粘贴到 ChatGPT 即可；想只讨论盘面则使用 **复制当前局面**。

- 在棋盘显示解题完成后，扩展**不会自动推断**起始局面；请以你保存的快照为准。
- 优先读取 Lichess 页面提供的原生主线 SAN 棋谱，无法读取时退回棋盘变化记录并标注断点。
- SAN 来源于网页，不保证是引擎最佳解；棋子坐标也不自动保证王车易位、吃过路兵和真实回合计数。未知行棋方会用 `?` 提示用户核查（这不是合法的 FEN 行棋方）。
- 插件只在 `lichess.org` 页面运行；刷新或关闭页面后本页内存的记录会清除。

## 本地测试

需要 Python、Playwright 和 Chromium（参考测试脚本中的浏览器路径）。

```bash
python -m pip install playwright
python -m playwright install chromium
python tests/test_extension.py
```

测试基于模拟 Lichess DOM；实际网页结构变化仍可能影响兼容性。欢迎提交 Issue 并附上操作步骤（请勿提交账号隐私数据）。

## 源码与隐私

- `board-core.js`：读取棋盘棋子与坐标；
- `tree-reader.js`：读取原生棋谱主线；
- `monitor.js`：起点快照、记录状态与断点；
- `popup.*`：简洁弹窗、复制提示词。

详见 [隐私说明](PRIVACY.md)、[更新日志](CHANGELOG.md)。项目使用 [MIT License](LICENSE)。