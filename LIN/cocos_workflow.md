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
| `bullet` | 子彈 prefab 的 group（Phase 4-A 新增） |
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

|         | player | bullet | ground | floor | wall | slope | coin | item | enemy |
|---------|:------:|:------:|:------:|:-----:|:----:|:-----:|:----:|:----:|:-----:|
| player  |   ❌   |   ❌   |   ✅   |  ✅   |  ✅  |  ✅   |  ✅  |  ✅  |  ✅   |
| bullet  |   ❌   |   ❌   |   ✅   |  ✅   |  ✅  |  ✅   |  —   |  —   |  ✅   |
| ground  |   ✅   |   ✅   |   —    |  —    |  —   |  —    |  —   |  —   |  ✅   |
| floor   |   ✅   |   ✅   |   —    |  —    |  —   |  —    |  —   |  —   |  ✅   |
| wall    |   ✅   |   ✅   |   —    |  —    |  —   |  —    |  —   |  —   |  ✅   |
| slope   |   ✅   |   ✅   |   —    |  —    |  —   |  —    |  —   |  —   |  ✅   |
| coin    |   ✅   |   —    |   —    |  —    |  —   |  —    |  —   |  —   |  —    |
| item    |   ✅   |   —    |   —    |  —    |  —   |  —    |  —   |  —   |  —    |
| enemy   |   ✅   |   ✅   |   ✅   |  ✅   |  ✅  |  ✅   |  —   |  —   |  —    |

主原則：
- 玩家跟所有東西碰，但不碰自己的子彈
- 子彈跟地形與敵人碰（撞牆回收、撞敵人傷害）
- 地形（ground/floor/wall/slope）跟 player + bullet + enemy 碰
- 收集物（coin/item）只跟 player 碰
- enemy 跟地形 / player / bullet 碰

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
  - [ ] 加 `PlayerInput.ts`（鍵盤輸入，Phase 3 抽出。沒掛就不會動，不會錯）
  - [ ] 加 `PlayerAnimator.ts`（逐幀切 spriteFrame + 翻面，Phase 3 抽出。沒掛 → 不會切貼圖、不會翻面，但物理仍正常）
    - [ ] Inspector：Target Sprite 留空 → 自動找同節點 cc.Sprite；想只動子節點 Sprite 就拉那個
    - [ ] Inspector：Flip Node 留空 → 翻 Player 節點；想只翻 Sprite 子節點就拉那個
    - [ ] Inspector：每個狀態的 frames 陣列拖入該狀態的所有 SpriteFrame（順序＝播放順序）
    - [ ] Inspector：每個狀態的 FPS 設值（IDLE 4、WALK 10、JUMP/FALL 8 起跳調）
    - [ ] Inspector：JUMP/FALL 視需要勾「停最後一張」（避免短跳一直循環）
    - [ ] 沒拉影格的狀態 → 進該狀態時保持上一張，不會錯
- [ ] Play 測試：掉到地面 / 走 / 跳 / 雙跳
- [ ] 微調 Player @property 找最爽手感
- [ ] Commit：`Tutorial.tmx`(+.meta) + `Tutorial.fire` + `Player.prefab`(+.meta) + `settings/project.json`

### Phase 4-A 收尾（滑鼠瞄準射擊：Combat + Weapon + Bullet）
- [ ] Cocos：Project Settings → Group Manager 加 `bullet` group
- [ ] Cocos：碰撞矩陣依上方表勾選（重點：bullet ↔ enemy / ground / floor / wall / slope）
- [ ] Cocos：做新 `Bullet.prefab`（位置可放 `assets/prefabs/`，舊的 `Bullet.prefab` 留著不動）
  - [ ] 節點 Group 設 `bullet`
  - [ ] 加 cc.Sprite（拉子彈素材圖，**素材畫朝右**；Bullet.ts 會旋轉節點對齊方向）
  - [ ] 加 cc.RigidBody（Type=**Kinematic**、Fixed Rotation、gravityScale=0、勾 Enabled Contact Listener）
  - [ ] 加 cc.PhysicsBoxCollider（勾 **Is Sensor**、Size 配子彈圖）
  - [ ] 加 `Bullet.ts`（speed/damage/lifetime 依手感調，預設 800/20/1.5）
- [ ] Cocos：Player 節點底下加結構
  - [ ] 子節點 `Weapon`（加 cc.Sprite 拉武器素材圖；**位置設在胸口/手前方**；武器素材畫朝右；不用碰撞器）
  - [ ] `Weapon` 底下加空節點 `Muzzle`（位置設在**槍口前端**；無視覺、無碰撞器）
- [ ] Cocos：Player 節點 Add `PlayerCombat.ts`
  - [ ] Inspector：`Bullet Prefab` 拉新 Bullet.prefab
  - [ ] Inspector：`Muzzle` 拉 `Player/Weapon/Muzzle` 節點
  - [ ] Inspector：`Fire Cooldown` 預設 0.18 / `Pool Size` 預設 16
- [ ] Cocos：Player 節點 Add `WeaponAim.ts`
  - [ ] Inspector：`Weapon Node` 拉 `Player/Weapon` 節點
  - [ ] Inspector：`Facing Deadzone` 預設 8（滑鼠跨過角色中線 8px 才翻面，避免抖動）
- [ ] Play 測試：
  - [ ] 滑鼠移動 → 武器跟著轉
  - [ ] 滑鼠移到左半邊 → 武器上下翻、角色 sprite 翻面
  - [ ] 按住滑鼠左鍵 → 連射往滑鼠方向；放開 → 停
  - [ ] 走 A/D 邊射 → 移動跟射擊獨立（背向走可瞄前方）
  - [ ] 鏡頭跟隨時也對：玩家走遠後滑鼠不動，武器仍指向滑鼠世界座標位置
- [ ] 微調 fireCooldown / bullet speed / damage / facingDeadzone
- [ ] Tutorial 場景拉一個臨時靶子節點驗證 takeDamage（之後 4-B 才正式做敵人）
- [ ] Commit：新 `Bullet.prefab` + `Player.prefab`(+.meta) + `Tutorial.fire` + `settings/project.json`

### Phase 4-B 收尾（HP 系統 + 受傷流程測試）
- [ ] Cocos：Player 節點 Add `PlayerHealth.ts`
  - [ ] Inspector：`Max Hp` 預設 100；`Invincibility Duration` 預設 0.8
  - [ ] Inspector：`Flash Node` 拉角色本體 Sprite 節點（受傷會閃爍）；不拉就不閃
  - [ ] Inspector：`Disable On Death` 勾起 → HP 0 時 Player / PlayerInput / PlayerCombat / WeaponAim 都會被 disable
- [ ] Tutorial 場景：拉一個「刺陷阱」節點測接觸傷害
  - [ ] Group 設 `enemy`
  - [ ] 加 cc.Sprite（暫時用色塊或刺圖）
  - [ ] 加 cc.RigidBody（Type=**Static**）
  - [ ] 加 cc.PhysicsBoxCollider（Size 配視覺；solid 或 sensor 都行 — sensor 可走過去，solid 會撞牆）
  - [ ] 加 `Damager.ts`（damage=20；continuous 不勾 → 進去打一次；勾起 → 站在上面持續被打）
- [ ] Tutorial 場景：拉一個「測試靶子」節點測子彈
  - [ ] Group 設 `enemy`
  - [ ] 加 cc.Sprite
  - [ ] 加 cc.RigidBody（Type=Static）
  - [ ] 加 cc.PhysicsBoxCollider（solid，size 配視覺）
  - [ ] 加 `Damageable.ts`（maxHp=30；HP 0 會 destroy）
- [ ] Play 測試：
  - [ ] 走到刺上 → 玩家扣 20 HP + 角色閃爍 0.8s + 期間再碰不會扣
  - [ ] 朝靶子射擊 → 靶子吃子彈傷害（預設 Bullet damage=20）→ 第二發後 HP 0 → destroy
  - [ ] 連續被打到 0 HP → 玩家不能移動 / 不能射 / 不能跳（died event 被吃進）
- [ ] 微調 maxHp / invincibilityDuration / Damager damage 看手感
- [ ] Commit：`Tutorial.fire` + `settings/project.json`（若有改 group）

### Phase 5 收尾（教學引導流程 — Checkpoint Node 版）

> 設計思路：5 個 hint 都用「玩家走過 Checkpoint Node」觸發。
> 場景設計只要在動線上擺 5 個 sensor Checkpoint，就能精準控節奏。
> 程式架構（TutorialManager / TutorialHint / TutorialBeacon / steps.ts）已寫好；這份是 Cocos 端從 0 到能 Play 的完整流程。

#### 步驟 1：做 `TutorialHint.prefab`

放 `assets/prefabs/TutorialHint.prefab`

| 子節點 | 元件 | 設定 |
|---|---|---|
| TutorialHint（根） | `TutorialHint.ts` | Fade In / Out = 0.2、Arrow Radius = 60 |
| └ Background | `cc.Sprite` | 半透明面板素材（如 `PanelFrame02_Demo.Png`），尺寸視文字長度 |
| └ Label | `cc.Label` | 字型 / 字級依美術；Inspector 拉到 TutorialHint.label |
| └ Arrow | `cc.Sprite` | 箭頭素材**畫朝右**；Inspector 拉到 TutorialHint.arrowNode（不拉就只剩純文字提示） |

#### 步驟 2：Tutorial.fire 拉場景動線（左 → 右）

```
[Spawn]  →  [小障礙物] → [超高障礙物]  →  [尖刺 Damager]  →  [擋路怪 Damageable]
      ↑                  ↑                    ↑                ↑
      C_Walk             C_Jump              C_DoubleJump     C_Spike  → C_Shoot
```

- [ ] **障礙物 1（小）**：Static RigidBody + PhysicsBoxCollider，高度約 50–80px（一段跳能跨）
- [ ] **障礙物 2（超高）**：同上，高度約 150–200px（一段跳跨不過，要雙跳）
- [ ] **尖刺**：沿用 Phase 4-B Damager 設定（group=enemy + Static RigidBody + PhysicsBoxCollider + `Damager` damage=20）
- [ ] **擋路怪**：沿用 Phase 4-B 靶子設定（group=enemy + Static RigidBody + PhysicsBoxCollider + `Damageable` maxHp=30）；位置放走道**正中央**讓玩家必須打掉才能過

#### 步驟 3：拉 5 個 Checkpoint Node（每個設定相同）

每個都是「空節點 + Sensor」結構：

| 節點名稱 | 擺放位置 | Inspector |
|---|---|---|
| `Checkpoint_Walk` | Spawn 右側 100–200px（玩家走幾步就會碰到） | TutorialBeacon: `beaconId=walk`、`mode=contact`、`oneShot=勾` |
| `Checkpoint_Jump` | 小障礙物**右側落地點** | TutorialBeacon: `beaconId=jump`、其餘同 |
| `Checkpoint_DoubleJump` | 超高障礙物**右側落地點** | TutorialBeacon: `beaconId=double-jump`、其餘同 |
| `Checkpoint_Spike` | 尖刺**右側走道** | TutorialBeacon: `beaconId=spike`、其餘同 |
| `Checkpoint_Shoot` | 擋路怪**右側走道** | TutorialBeacon: `beaconId=shoot`、其餘同 |

每個 Checkpoint Node 的元件：

- [ ] **不**加 cc.Sprite（純邏輯、玩家看不到）
- [ ] `cc.RigidBody`：Type = **Static**、勾 **Enabled Contact Listener**
- [ ] `cc.PhysicsBoxCollider`：**勾 Is Sensor**、size 設「玩家經過時必然會碰到」的範圍（高度建議跟玩家差不多，寬度 30–60px 就夠）
- [ ] `TutorialBeacon.ts`：依上表設 `beaconId`、`mode=contact`、`oneShot` 勾

> ⚠️ **不用設 Group**（也不用加進 Group Matrix）— `TutorialBeacon` 用 `other.node.group === 'player'` 自己判定，跟著 group matrix 默認設定就行。實務上把節點 group 留 default 即可，玩家會跟它互動。
> 💡 想要視覺除錯：暫時加一個半透明 cc.Sprite 看 collider 位置對不對，正式版再 disable。

#### 步驟 4：Tutorial.fire / Canvas 下加 `TutorialManager` 空節點

- [ ] 掛 `TutorialManager.ts`
- [ ] 把 `TutorialHint.prefab` 拖進 Canvas 下（建議擺**畫面上方中央**固定位置；Widget 元件可以鎖住），改名 `TutorialHint`
- [ ] Inspector 設定：

| 欄位 | 拉什麼 |
|---|---|
| Player Node | 場景的 Player 節點 |
| Hint | 場景的 TutorialHint 實例 |
| Arrow Target Ids（陣列） | `walk`、`jump`、`double-jump`、`spike`、`shoot`（**順序要跟下面對齊**） |
| Arrow Target Nodes（陣列） | Checkpoint_Walk、Checkpoint_Jump、Checkpoint_DoubleJump、Checkpoint_Spike、Checkpoint_Shoot |
| Start Delay | 0.5 |
| Next Step Delay | 0.8 |

#### 步驟 5：Play 測試（驗收清單）

- [ ] 場景進來 0.5s 後出現 hint 1「按 A / D 走動」+ 箭頭指向 Checkpoint_Walk
- [ ] 走過 C_Walk → ✓ 0.8s → hint 2「跳起來」+ 箭頭指 C_Jump
- [ ] 跳過小障礙物到 C_Jump → ✓ → hint 3「雙跳」+ 箭頭指 C_DoubleJump
- [ ] 雙跳跨超高障礙物到 C_DoubleJump → ✓ → hint 4「小心尖刺」+ 箭頭指 C_Spike
- [ ] 繞過 / 跨過尖刺到 C_Spike → ✓ → hint 5「滑鼠左鍵射擊」+ 箭頭指 C_Shoot
- [ ] 射爆擋路怪、走過 C_Shoot → hint 淡出、全部完成

#### 微調 + Commit

- [ ] 哪一步太快 / 太慢 → 調 `Next Step Delay`、或 Checkpoint 位置
- [ ] 箭頭離 hint 太遠 / 太近 → 調 TutorialHint.prefab 的 `Arrow Radius`
- [ ] hint 文字想改 → 改 `assets/scripts/tutorial/steps.ts`（**不用** 動 Inspector）
- [ ] 教學步驟想增刪 → 同上改 `steps.ts` + 對應 Checkpoint Node 新增 / 刪除
- [ ] Commit：`TutorialHint.prefab` + `Tutorial.fire` + `assets/scripts/tutorial/` 四檔（+.meta）

### Phase 5-C 收尾（鏡頭跟隨）

> 為什麼穿插這個：教學動線拉長後，沒鏡頭跟隨會看不到下一個 Checkpoint。橫向卷軸常規做法。

- [ ] Cocos：Tutorial.fire 找 **Main Camera 節點**（Canvas 下預設那顆；場景樹大概是 `Canvas/Main Camera`）
- [ ] Main Camera Add `CameraFollow.ts`
- [ ] Inspector：
  - [ ] `Target` 拉 **Player 節點**
  - [ ] `Smooth Time` 預設 0.15（手感太黏 → 改 0.08；太鬆 → 改 0.25）
  - [ ] `Follow Y` **不勾**（跳躍時鏡頭不晃）
  - [ ] `Offset X` 0（之後想讓鏡頭比角色靠前看 → 設正值，例如 80）
  - [ ] `Left Bound` / `Right Bound` 都先 0（=不限制；之後加關卡邊界再設）
- [ ] Play 測試：
  - [ ] 左右走 → 鏡頭平滑跟
  - [ ] 跳起來 → 鏡頭 y 不動、不暈
  - [ ] 站著不動 → 鏡頭穩定不抖
  - [ ] 滑鼠瞄準（Phase 4-A）：鏡頭移動後子彈仍朝滑鼠世界座標飛（cc.Camera.main.getScreenToWorldPoint 自帶補正）
- [ ] 微調：
  - [ ] 想限關卡邊界 → 設 `Left Bound` / `Right Bound`（兩值不同就生效，相同 = 不限制）
  - [ ] 想要前方視野多 → 設 `Offset X` 正值
- [ ] Commit：`Tutorial.fire`（Main Camera 多了元件）+ `CameraFollow.ts`(+.meta)

### 後續 Phase 開啟前的標準動作
- [ ] 翻開 [character_plan.md](character_plan.md) 看下個 Phase
- [ ] 對著該 Phase 的「LIN 要在 Cocos 做」項目走這份規定的「標準步驟」

---

## 修改紀錄

- `2026-05-29` 建立此規定文件，定義 Tiled 多物件層命名 + Tag 慣例 + 標準步驟
- `2026-05-29` 改成 Mario 模式：單一 `objects` 物件層 + 物件 name 對應 Cocos Group + Group Manager 矩陣決定碰撞；移除 Tag 慣例，改用 Group 命名
- `2026-06-01` Phase 3：Player 節點除了 Player.ts 之外要再掛 PlayerInput.ts（輸入翻譯成 input:* event）
- `2026-06-01` Phase 3：再加 PlayerAnimator.ts（state-changed → 切 clip、facing-changed → 翻 scaleX）；Player.ts 不再碰 node.scaleX
- `2026-06-01` PlayerAnimator 改逐幀貼圖：Inspector 各狀態 frames 陣列 + FPS（不用 Animation 編輯器）
- `2026-06-01` Phase 4-A 新增 `bullet` group 與碰撞矩陣（bullet 跟 enemy/地形碰、不跟 player/coin/item 碰）；Player 節點加 PlayerCombat.ts + Weapon 子節點 + Muzzle 子節點；新 Bullet.prefab 結構（cc.Sprite + cc.RigidBody Kinematic + cc.PhysicsBoxCollider sensor + Bullet.ts）
- `2026-06-01` Phase 4-A 改為滑鼠瞄準：射擊改滑鼠左鍵（按住連射）；Player 節點再加 WeaponAim.ts（Inspector 拉 Weapon Node）；武器素材畫朝右（WeaponAim 會旋轉、滑鼠在左會翻 scaleY）；子彈素材也畫朝右（Bullet 會旋轉對齊方向）；Player 不再用 update 判面向 → 由 WeaponAim 依滑鼠決定（含 facingDeadzone）
- `2026-06-02` Phase 4-B：Player 節點加 PlayerHealth.ts（flashNode 拉角色本體 Sprite 受傷時會閃）；Tutorial 場景拉刺陷阱（enemy group + Static RigidBody + PhysicsBoxCollider + Damager）跟測試靶子（enemy group + Static RigidBody + PhysicsBoxCollider + Damageable）驗證完整受傷流程
- `2026-06-02` Phase 5：做 TutorialHint.prefab + Tutorial.fire 加 TutorialManager 節點；拉小刺/大刺平台 + Beacon_Spike1/Spike2（Sensor PhysicsBoxCollider，TutorialBeacon mode=contact）；靶子節點再加一個 TutorialBeacon mode=host-died；Inspector 把 Arrow Target Ids / Nodes 兩個平行陣列配對
- `2026-06-02` Phase 5 改版：教學腳本全部統一用 5 個 Checkpoint Node（contact）觸發 — 不再混 player event / host-died。動線：Spawn → C_Walk → 小障礙 → C_Jump → 超高障礙 → C_DoubleJump → 尖刺 → C_Spike → 擋路怪 → C_Shoot → 完成。場景設計者只要擺 Checkpoint Node 就能控節奏
- `2026-06-02` Phase 5-C：Main Camera 節點掛 CameraFollow.ts，Inspector 拉 target=Player；followY 不勾（跳躍不晃）；之後關卡有邊界再設 leftBound/rightBound
