<!--
請完整填寫此模板，未填寫的 PR 會被退回。
詳細規範請見 TEAM_GUIDE.md
-->

## 這個 PR 做了什麼？

<!-- 一兩句話說明這次改動的目的，不是列檔案 -->



## 改動類型

<!-- 勾選一個或多個 -->

- [ ] `feat` 新功能
- [ ] `fix` 修 bug
- [ ] `refactor` 重構（行為不變）
- [ ] `chore` 雜項（資源整理、設定調整）
- [ ] `docs` 文件
- [ ] `style` 格式（不影響邏輯）

## 主要改動

<!-- 條列你改了什麼，例如：
- 新增 ShopPanel.prefab
- 新增 ShopPanelController.ts（負責商品列表 + 購買流程）
- GameSceneManager 增加 ShopPanel 的 instantiate
-->



## 如何測試？

<!-- 一步步寫出你測過的流程，例如：
1. 從 MainMenu 進入 Game
2. 點右上角金幣圖示開啟 Shop
3. 點任一商品 → 應該扣金幣並加入背包
-->



## 截圖 / 錄影（UI 改動必填）

<!-- 拖曳圖片到這裡就會自動上傳 -->



## 自我檢查清單

<!-- 全部勾完才可以送出 review -->

### 基本
- [ ] 我有先 `git pull --rebase origin main`
- [ ] 本機能跑起來，沒有 console error / warning
- [ ] 沒有 commit 到 `library/`、`temp/`、`local/`、`build/`

### `.meta` 檔案
- [ ] 所有新增資源都有對應 `.meta`
- [ ] 改名 / 刪除資源是用 Cocos Creator 的「資源管理器」操作的（不是檔案總管）

### 場景與 Prefab
- [ ] 我沒有編輯 `Main.fire`（或任何主場景）
- [ ] 如果有動主場景，我有在群組事先公告
- [ ] 新增的 prefab 放在對應的 `assets/prefabs/<分區>/` 底下

### 程式碼
- [ ] 我的腳本沒有用 `cc.find`（或我有在 PR 內說明為何必須用）
- [ ] 跨 prefab 的引用是用 `@property` 注入或 `cc.systemEvent` 事件，不是抓節點路徑
- [ ] 沒有寫 `console.log` 或 `debugger` 等除錯殘留

### 共用區（`shared/`）
- [ ] 如果有改 `assets/scripts/shared/` 或 `assets/prefabs/shared/`，我有事先在群組告知
- [ ] 改動沒有破壞既有 API（或我有列出所有需要連動修改的地方）

## 給 reviewer 的話

<!-- 任何想特別提醒 reviewer 注意的地方，例如：
- 第 X 個方法有重構需要特別 review
- 還沒做 Y 功能，會在下一個 PR 補
-->


