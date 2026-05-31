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
- ❌ 同節點混用 `cc.BoxCollider` 跟 `cc.PhysicsBoxCollider`（兩套系統不相容，詳見 [collision_setup.md §0](collision_setup.md#0-先搞懂cc-boxcollider-vs-cc-physicsboxcollider)）

### 碰撞器選擇規定
farmer_baby 統一用 **`cc.PhysicsBoxCollider` + `cc.RigidBody`（box2d 物理系統）**，不要用 `cc.BoxCollider`（碰撞系統）。混用會無聲失敗。原因詳見 [collision_setup.md §0](collision_setup.md#0-先搞懂cc-boxcollider-vs-cc-physicsboxcollider)。

---

## Tiled + Cocos Group 工作流程規定（Mario 模式）

### 1. Tiled 物件層
**只用一個物件層**，命名為 `objects`。不再為每種類型開一層。

### 2. Tiled 物件命名規則
物件的 **Name** 屬性 = 類別名稱，也會直接變成 Cocos 內的 group 名稱。

| 物件 name | 用途 | 工具 |
|-----------|------|------|
| `ground` | 主要可踩地面 | 矩形 |
| `floor` | 次級平台 / 浮空板 | 矩形 |
| `wall` | 牆壁 | 矩形 |
| `slope` | 斜坡 | 多邊形 |
| `coin` | 金幣（sensor） | 矩形 |
| `item` | 道具（sensor） | 矩形 |
| `trigger` | 教學提示 / checkpoint（sensor） | 矩形 |
| `goal` | 通關點（sensor） | 矩形 |
| `player_spawn` | Player 出生點（不建碰撞器） | 點 |
| `enemy_spawn` | 敵人出生點（不建碰撞器） | 點 |

規則：
- 名稱**含 "spawn" 字串** → `TiledColliderBuilder` 視為出生點，不建碰撞器，只存位置
- 名稱在 `sensorNames`（coin/item/pickup/trigger/goal）→ sensor collider
- 其他名稱 → solid collider

### 3. Cocos Group Manager
`Project → Project Settings → Group Manager` 必須有對應 group：

| Group | 對應 Tiled 物件 name |
|-------|---------------------|
| `player` | Player 節點本身（Tiled 內無對應，是 Cocos 內 Player.prefab 的 group） |
| `ground` | `ground` |
| `floor` | `floor` |
| `wall` | `wall` |
| `slope` | `slope` |
| `coin` | `coin` |
| `item` | `item` |
| `enemy` | enemy / monster 節點群 |
| `trigger` | `trigger` |
| `goal` | `goal` |

**Group name 跟 Tiled 物件 name 必須完全一致（大小寫敏感）。**

### 4. Cocos 碰撞矩陣建議
`Group Manager` 內勾選：

|         | player | ground | floor | wall | slope | coin | item | enemy |
|---------|:------:|:------:|:-----:|:----:|:-----:|:----:|:----:|:-----:|
| player  |   ❌   |   ✅   |  ✅   |  ✅  |  ✅   |  ✅  |  ✅  |  ✅   |
| ground  |   ✅   |   —    |  —    |  —   |  —    |  —   |  —   |  ✅   |
| floor   |   ✅   |   —    |  —    |  —   |  —    |  —   |  —   |  ✅   |
| wall    |   ✅   |   —    |  —    |  —   |  —    |  —   |  —   |  ✅   |
| slope   |   ✅   |   —    |  —    |  —   |  —    |  —   |  —   |  ✅   |
| coin    |   ✅   |   —    |  —    |  —   |  —    |  —   |  —   |  —    |
| item    |   ✅   |   —    |  —    |  —   |  —    |  —   |  —   |  —    |
| enemy   |   ✅   |   ✅   |  ✅   |  ✅  |  ✅   |  —   |  —   |  —    |

主原則：
- 玩家跟所有東西碰
- 地形（ground/floor/wall/slope）跟 player + enemy 碰
- 收集物（coin/item）只跟 player 碰
- enemy 跟地形與 player 碰

> 設好後 `settings/project.json` 會自動更新，要 commit 進去。

---

## 加新 Tiled 物件類別的標準步驟

### 步驟 1 — Tiled 編輯器
- [ ] 在 `objects` 層拉新物件
- [ ] 設 **Name** 為新類別名稱（依命名規則）
- [ ] 儲存 .tmx

### 步驟 2 — Cocos Project Settings
- [ ] `Project → Project Settings → Group Manager`
- [ ] 確認新類別已是 group；沒有 → 加 group
- [ ] 在矩陣勾選與 player（及其他必要 group）的碰撞關係
- [ ] 儲存

### 步驟 3 — 程式（若需要 sensor 而非 solid）
- [ ] 開 [TiledColliderBuilder.ts](../assets/scripts/level/TiledColliderBuilder.ts) 的 `sensorNames` 預設值，或在 Inspector 內手動加
- [ ] 加進 `sensorNames` 陣列

### 步驟 4 — 測試 + Commit
- [ ] Play 測試 Tutorial scene
- [ ] `git add assets/map/Tutorial.tmx* settings/project.json`
- [ ] `git commit -m "feat(map): 加入 <類別> 物件"`

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

### Phase 2 收尾（Mario 模式：Tiled name → Cocos Group）
- [x] Tiled：建 `objects` 物件層
- [x] Tiled：拉物件命名為 ground、floor
- [ ] Tiled：（可選）多拉 `wall`、`coin`、`player_spawn`、`enemy_spawn`
- [ ] Cocos：**Project Settings → Group Manager** 加 group：`player`, `ground`, `floor`, `wall`, `coin`, `item`, `enemy`
- [ ] Cocos：Group Manager 矩陣依上方表勾選（最重要：player ↔ ground/floor 要勾）
- [ ] Cocos：Tutorial scene 啟用 physicsManager + 設重力 `(0, -1800)`（暫放 Player.ts onLoad）
- [ ] Cocos：把 `Tutorial.tmx` 拖到場景 → TiledMap 節點
- [ ] Cocos：TiledMap 節點 Add `TiledColliderBuilder`
  - [ ] `Object Layer Name` = `objects`
  - [ ] 勾 `Debug`
- [ ] Cocos：Player 節點
  - [ ] Inspector 上方 **Group** 下拉 → 選 `player`
  - [ ] 加 `cc.RigidBody`（Dynamic、Fixed Rotation）
  - [ ] 加 `cc.PhysicsBoxCollider`（Size 配 Sprite、Density=1、Friction=0、Restitution=0）
  - [ ] 加 `Player.ts`
- [ ] Play 測試：掉到地面 / 走 / 跳 / 雙跳
- [ ] 微調 Player @property 找最爽手感
- [ ] Commit：`Tutorial.tmx`(+.meta) + `Tutorial.fire` + `Player.prefab`(+.meta) + `settings/project.json`

### 後續 Phase 開啟前的標準動作
- [ ] 翻開 [character_plan.md](character_plan.md) 看下個 Phase
- [ ] 對著該 Phase 的「LIN 要在 Cocos 做」項目走這份規定的「標準步驟」

---

## 修改紀錄

- `2026-05-29` 建立此規定文件，定義 Tiled 多物件層命名 + Tag 慣例 + 標準步驟
- `2026-05-29` 改成 Mario 模式：單一 `objects` 物件層 + 物件 name 對應 Cocos Group + Group Manager 矩陣決定碰撞；移除 Tag 慣例，改用 Group 命名
