# Chess Position Exporter for Lichess v1.2.1

First public release · 首个公开版本

### 功能 Features
- 从 Lichess 页面直接读取棋盘并导出 FEN、棋子坐标。
- 手动保存战术谜题的起始局面，避免解题完成后丢失起点。
- 优先读取 Lichess 页面原生 SAN 主线棋谱，必要时使用棋盘变化记录并标注缺失步骤。
- 一键复制简洁的 ChatGPT 复盘提示词；更多诊断信息折叠在高级选项中。
- 修正黑方先走时的棋谱回合编号，新增扩展图标。

### 安装 Installation
1. 下载下方 **`lichess-board-exporter-extension-v1.2.1.zip`** 并解压。
2. Chrome 打开 `chrome://extensions/`（Edge 打开 `edge://extensions/`）。
3. 开启开发者模式 → **加载已解压的扩展程序** → 选择含 `manifest.json` 的目录。
4. 打开或刷新 Lichess 页面，点击插件图标使用。

### 注意 Notes
- 这是非官方扩展，不属于 Lichess 或 OpenAI。
- 不计算最佳着法；不要在禁止外部辅助的对局中使用。
- 部分 FEN 状态字段无法仅从棋盘 DOM 验证。
- 已通过模拟 Lichess DOM 测试；真实网页兼容性可能随 Lichess 更新发生变化。
- 插件本地处理棋盘数据；详见仓库 [PRIVACY.md](https://github.com/gao-xing-li/lichess-board-exporter/blob/main/PRIVACY.md)。

Full source code is available in this repository under the MIT License.
