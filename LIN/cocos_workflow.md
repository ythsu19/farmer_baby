# LIN 的 Cocos Creator 工作流程規定

> 這是給自己看的「**規定**」文件 — 每次開 Cocos 做事都照這走，避免漏步驟。
> 對應計畫：[character_plan.md](character_plan.md)
> 對應設定：[collision_setup.md](collision_setup.md)
> 對應團隊規範：[../TEAM_GUIDE.md](../TEAM_GUIDE.md)

---

## 通用規定

### 開 Cocos 前
1. `git status` 看現在乾不乾淨
2. 確認在自己的 branch（不是 `main`）：`git branch --show-current`
3. 如果有別人新合進來的東西 → `git pull --rebase origin main`，再 `git checkout my-branch && git rebase main`

### 關 Cocos 後
1. `git status` 看 Cocos 動了什麼
2. 出現一堆 `.meta` 變動是 Cocos 正常重新 import — **看 diff 確認沒有 UUID 被改**
3. CRLF 雜訊（沒有實質內容變化的 .meta）→ `git checkout -- <檔案>` 丟掉
4. 真正的改動（場景、prefab、新資源）→ 連 .meta 一起 `git add` → commit

### 絕對不要
- ❌ 在 Cocos 外（檔案總管）改名 / 搬資源 — 用 Cocos 的「資源管理器」
- ❌ 編輯 `.meta` 內的 UUID
- ❌ 同時開組員正在編的場景 / prefab（先在群組確認）
- ❌ commit 到 `main`

---

## Tiled 工作流程規定

### 1. 物件層命名
**每種地形類型一個獨立物件層**，命名規範：

| 物件層名稱 | 用途 |
|-----------|------|
| `ground` | 主要可踩地面 |
| `floor` | 次級平台 / 浮空板 |
| `wall` | 牆壁 |
| `ceiling` | 天花板（要時才加） |
| `death` | 死亡區（尖刺、毒水、墜落） |
| `trigger` | 教學提示 / checkpoint 觸發 |
| `pickup` | 道具 / 收集物 |
| `spawn` | 重生點 / 出生點（用點物件，type 標 player/enemy） |

不要把多種類型畫在同一層。

### 2. Collision Tag 慣例
給 `LayerSpec.tag` 用：

| Tag | 用途 | 是否 Sensor |
|-----|------|------------|
| 0 | 未分類 | — |
| 1 | ground | ❌ |
| 2 | floor | ❌ |
| 10 | wall | ❌ |
| 11 | ceiling | ❌ |
| 100 | death | ✅ |
| 200 | trigger | ✅ |
| 300 | pickup | ✅ |

> Sensor = trigger，不阻擋物理，只發 contact event。

### 3. Tiled Project 設定
- 第一次：`File → New → New Project`，資料夾選 `d:\farmer_baby\assets\map\`
- `Project → Custom Types`（Tiled 1.9+）建立 ground/floor/... 的群組，之後每個 .tmx 都能套用
- Project 檔（`.tiled-project`）也進 git，組員共用

---

## 加新地形類型的標準步驟

每次要在 Tiled 多加一種地形 → 都照這走：

### 步驟 1 — Tiled 編輯器
- [ ] 圖層 → 新增物件層，命名為 `<新類型名>`（依命名規範）
- [ ] 用矩形 / 多邊形 / 折線工具畫出碰撞區
- [ ] 儲存 .tmx

### 步驟 2 — Cocos Creator
- [ ] 確認 Tutorial scene 的 TiledMap 節點上有 `TiledColliderBuilder`
- [ ] 在 `Layers` 陣列點 **+**
- [ ] 新筆位填：
  - `Layer Name` = Tiled 內的名字
  - `Tag` = 對應上方 Tag 慣例的數字
  - `Sensor` = 看 Tag 慣例（死亡區 / trigger / pickup 都要勾）
- [ ] Play 測試
- [ ] 看 console 確認 `[TiledColliderBuilder] "<name>" → N 個碰撞器`

### 步驟 3 — Commit
- [ ] `git status`
- [ ] `git add assets/map/Tutorial.tmx*` + `git add assets/scenes/Tutorial.fire*`（如果有改 scene）
- [ ] `git commit -m "feat(map): 加入 <類型> 物件層"`

---

## 加新元件 / 腳本的標準步驟

每次寫新的 `.ts` → 都照這走：

### 步驟 1 — VS Code
- [ ] 確認分支正確
- [ ] 在 `assets/scripts/<適當資料夾>/` 內建 `<Name>.ts`
- [ ] 用 `const { ccclass, property } = cc._decorator;` 開頭
- [ ] `@ccclass` + `export default class X extends cc.Component`

### 步驟 2 — Cocos Creator
- [ ] 切回 Cocos，等它自動 import（會生 `.ts.meta`）
- [ ] 看資源管理器有看到新元件
- [ ] 在目標 prefab / scene 節點 → Add Component → 找到新元件
- [ ] 在 Inspector 把 `@property` 拉好引用

### 步驟 3 — Commit
- [ ] `git add` 連 `.ts` + `.ts.meta` 一起
- [ ] `git commit`

---

## 加新場景的標準步驟

### 步驟 1 — Cocos Creator
- [ ] `assets/scenes/` 右鍵 → New → Scene → 命名 `<Name>.fire`
- [ ] 雙擊進入編輯
- [ ] 加 Canvas + 必要管理器節點

### 步驟 2 — Build Settings
- [ ] Project → Build Settings → 把新場景加進 Scene Asset 清單
- [ ] 注意 `settings/project.json` 會變動 — 這算正常 commit

### 步驟 3 — Commit
- [ ] `git add assets/scenes/<Name>.fire*` + `settings/project.json`
- [ ] `git commit -m "feat(scenes): 加入 <名稱> 場景"`

---

## 目前 TODO（動態維護，做完就劃掉）

### Phase 1 收尾（基礎可玩）
- [ ] Cocos 內把 `Player.ts` 掛到 Player 節點
- [ ] Tutorial scene 拖入 Player 節點，Play 測試手感

### Phase 2 收尾（box2d 物理 + 多層碰撞）
- [ ] Tiled 內為 `Tutorial.tmx` 建 `ground` 物件層，畫基本地面
- [ ] （可選）建 `wall` 物件層 畫左右邊界
- [ ] （可選）開 Tiled Project 設定 Custom Types
- [ ] Tutorial scene 啟用 physicsManager + 設重力 `(0, -1800)`
- [ ] TiledMap 節點 Add `TiledColliderBuilder`
  - [ ] `Layers` 加一筆：`ground` / tag=1 / sensor=❌
- [ ] Player 節點 Add `cc.RigidBody`（Dynamic、Fixed Rotation）+ `cc.PhysicsBoxCollider`
- [ ] Play 測試：掉到地面 / 走 / 跳 / 雙跳全部正常
- [ ] 微調 Player @property 數值找出最爽的手感
- [ ] Commit 包含：Tutorial.tmx + Tutorial.fire + Player.prefab + settings/project.json

### 後續 Phase 開啟前的標準動作
- [ ] 翻開 [character_plan.md](character_plan.md) 看下個 Phase
- [ ] 對著該 Phase 的「LIN 要在 Cocos 做」項目走這份規定的「標準步驟」

---

## 修改紀錄

- `2026-05-29` 建立此規定文件，定義 Tiled 多物件層命名 + Tag 慣例 + 標準步驟
