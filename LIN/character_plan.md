# 角色開發計畫 — LIN

> 分支：`feature/pkboie-player_tutorial`
> 場景：`assets/scenes/Tutorial.fire`
> 開始日期：2026-05-28
> 最後更新：2026-05-29

> **設計思路**請看 [player_design.md](player_design.md)

---

## Phase 1：基礎可玩角色（✅ 主體完成）

> 目標：場景能跑、角色能左右走、能跳、感覺手感不錯。

- [x] **1-1** Tutorial scene 命名為 `Tutorial.fire`
- [x] **1-2** `assets/scripts/player/Player.ts`：含 coyote time + jump buffer + accel/decel + 明確 state machine + 對外 event
- [ ] **1-3** Cocos 內把 `Player.ts` 掛到一個 Player node（先用空白 Sprite 或色塊 placeholder） — **下次開 Cocos 要做**
- [ ] **1-4** 在 `Tutorial.fire` 放 Player 節點，設 `tempGroundY` 然後 Play
- [ ] **1-5** 手感調整：實測後微調 `maxWalkSpeed` / `jumpVelocity` / `coyoteTime` / `jumpBuffer`

**🛑 Commit point 1（已 commit 2 次）**：
- `feat(player): 全新 Player 控制器（移動/跳躍/面向）`
- `redesign(player): coyote time + jump buffer + accel/decel + 設計文件`

---

## Phase 2：Mario 模式碰撞系統（✅ 程式部分完成）

> 目標：仿 Mario — 單一 Tiled `objects` 物件層 + 物件 name → Cocos Group → Group Manager 矩陣決定碰撞。
> 工作流程規定 → [cocos_workflow.md](cocos_workflow.md)
> 設定步驟細節 → [collision_setup.md](collision_setup.md)

- [x] **2-1** Player.ts 切換到 box2d：`linearVelocity` 取代 transform 移動
- [x] **2-2** 落地判定用 `onBeginContact` + 法線 y（`groundNormalThreshold`）
- [x] **2-3** 移除 `gravity` 與 `tempGroundY`；改 `gravityScale` 控下落
- [x] **2-4** Player.ts 設 `fixedRotation` + `enabledContactListener`
- [x] **2-5** `TiledColliderBuilder` v3：單一物件層 + name 驅動 Cocos Group（Mario 模式）
- [x] **2-6** Tiled：建 `objects` 物件層 + 拉 ground、floor 物件
- [ ] **2-7** Cocos：Project Settings → Group Manager 加 group 與碰撞矩陣（依 [cocos_workflow.md](cocos_workflow.md)）
- [ ] **2-8** Cocos：啟用物理 + Tutorial.tmx 拖入場景 + TiledMap 掛 TiledColliderBuilder + Player 設 group 與 RigidBody/Collider
- [ ] **2-9** Play 測試：掉到 ground / 走 / 跳 / 雙跳

**🛑 Commit point 2（已 commit 4 次）**：
- `feat(level): Tiled 物件層 → box2d 靜態碰撞器`
- `feat(player): 切換到 box2d 物理`
- `refactor(level): TiledColliderBuilder 改用多物件層架構`
- `redesign(level): Mario 模式 — name-driven Cocos Group`

---

## Phase 3：拆出 PlayerInput + PlayerAnimator

> 目標：把 Player.ts 變薄；輸入和動畫獨立元件。

- [x] **3-1** 新建 `PlayerInput.ts`：監聽鍵盤，發 `input:move`、`input:jump-down` event（`input:attack` 等 Phase 4 再加）
- [x] **3-2** Player.ts SECTION 2 改成接 event
- [x] **3-3** 新建 `PlayerAnimator.ts`：監聽 `state-changed` **逐幀切 spriteFrame**（每狀態獨立 frames 陣列 + FPS）
- [x] **3-4** 處理面向翻轉（聽 `facing-changed`，scaleX 翻面從 Player 移到 PlayerAnimator）
- [ ] **3-5** 等角色貼圖素材就位 → Inspector 拉影格進 `idleFrames` / `walkFrames` / `jumpFrames` / `fallFrames`，調 FPS

**🛑 Commit point 3**：`refactor(player): 拆出 PlayerInput + PlayerAnimator`

---

## Phase 4：PlayerCombat + PlayerHealth

> 目標：補上射擊系統與 HP 系統。
> 順序：Combat 先（4-A）、Health 後（4-B）— LIN 的角色設計是「拿槍射擊」，視覺即時性優先。

### 4-A 射擊系統（Combat + 武器 + 子彈，滑鼠瞄準版）

- [x] **4-A-1** `PlayerInput.ts` 加滑鼠：左鍵 → `input:attack-down/up`、滑鼠移動 → 內部記 aim、`aimWorldPos()` 公開方法（Camera 換算）
- [x] **4-A-2** `Bullet.ts`：box2d sensor 子彈、`init(dirVec, pool)` 收任意方向、視覺隨方向旋轉
- [x] **4-A-3** `PlayerCombat.ts`：每發子彈方向 = normalize(滑鼠世界座標 − 槍口世界座標)、cooldown 控射速、NodePool、按住連射
- [x] **4-A-4** `WeaponAim.ts`：每幀讀滑鼠世界座標、旋轉武器節點、滑鼠在左翻 scaleY、emit facing-changed（含死區）
- [x] **4-A-5** `Player.ts` 改面向：移除速度判定，改為被動接 facing-changed 同步 `_facingRight` 給 getter
- [ ] **4-A-6** Cocos：做新 `Bullet.prefab`（拉子彈圖、子彈素材畫朝右 + RigidBody Kinematic + PhysicsBoxCollider Sensor + Bullet.ts + group=bullet）
- [ ] **4-A-7** Cocos：Player 節點下加 `Weapon` 子節點（cc.Sprite 拉武器圖，位置設在胸口/手前方），再下加 `Muzzle` 空節點（位置設在槍口前端）
- [ ] **4-A-8** Cocos：Player 節點 Add `PlayerCombat.ts`，Inspector 拉 `bulletPrefab` 跟 `muzzle`
- [ ] **4-A-9** Cocos：Player 節點 Add `WeaponAim.ts`，Inspector 拉 `weaponNode`（Weapon 子節點）
- [ ] **4-A-10** Cocos：Group Manager 加 `bullet` group，矩陣：bullet ↔ enemy / ground / floor / wall / slope 勾，其他不勾
- [ ] **4-A-11** Tutorial 場景拉一個靶子節點（Group=enemy、PhysicsBoxCollider、掛簡單測試元件實作 `takeDamage`）測試射擊
- [ ] **4-A-12** Play 測試：滑鼠移動 → 武器跟著轉；按住左鍵 → 連射往滑鼠方向；走著射 → 一邊移動一邊瞄；遮蔽角度時面向跟著翻
- [ ] **4-A-13** 微調 fireCooldown / bullet speed / damage / facingDeadzone

**🛑 Commit point 4-A**：`feat(player): PlayerCombat + Bullet 射擊系統`

### 4-B HP 系統 + 受傷流程

- [x] **4-B-1** `PlayerHealth.ts`：maxHp / 無敵時間 / 死亡 event / 受傷閃爍 / 死亡時自動 disable 其他 Player 元件
- [x] **4-B-2** `takeDamage(damage, attacker?) → boolean` 介面（鴨子型別，任何來源呼叫；無敵期被擋回 false）
- [x] **4-B-3** `Damager.ts`：接觸 player → 對方 PlayerHealth.takeDamage（陷阱／接觸傷害敵人通用）；支援 continuous 模式（火坑/酸池）
- [x] **4-B-4** `Damageable.ts`：通用敵人 HP（測試靶子用，介面跟 PlayerHealth 對稱；HP 歸零 → destroy）
- [x] **4-B-5** `Bullet.ts` 鴨子型別清單加入 `Damageable`
- [ ] **4-B-6** Cocos：Player 節點 Add `PlayerHealth.ts`，Inspector 拉 `flashNode`（角色本體 Sprite）、調 `maxHp` / `invincibilityDuration`
- [ ] **4-B-7** Tutorial 場景拉一個刺陷阱節點（Group=`enemy`、RigidBody Static + PhysicsBoxCollider + `Damager`，damage=20）測接觸傷害
- [ ] **4-B-8** Tutorial 場景拉一個靶子節點（Group=`enemy`、RigidBody Static + PhysicsBoxCollider + `Damageable` maxHp=30）測子彈打靶
- [ ] **4-B-9** Play 測試：靠近刺 → 扣血 + 閃爍 + 0.8s 無敵；打靶子 → 靶子扣血 → HP 0 後 destroy；HP 0 後玩家不能動 / 不能射

### 4-B 之後可選（不一定要這個 Phase 做）

- [ ] HUD：HP bar prefab + 訂閱 hp-changed 更新
- [ ] HurtSound：訂閱 hurt event 播音效
- [ ] 受傷擊退：訂閱 hurt event 給 Player 一個反向 impulse
- [ ] 死亡重啟：訂閱 died event → 延遲 1s → cc.director.loadScene 重載 Tutorial

**🛑 Commit point 4-B**：`feat(player): PlayerHealth + Damager + Damageable`

---

## Phase 5：教學引導流程

> 目標：教學關卡有引導 UI、步驟提示、完成判定。

- [ ] **5-1** 設計教學步驟（列在下方「教學腳本」區）
- [ ] **5-2** 做 `TutorialHint.prefab`（提示文字 + 箭頭）
- [ ] **5-3** `TutorialManager` 用 step machine 控制流程
- [ ] **5-4** 每完成一步觸發下一個 hint
- [ ] **5-5** 全部完成後可進入正式關卡（`Game.fire`）

**🛑 Commit point 5**：`feat: 教學引導流程`

---

## 教學腳本（草稿，待 Phase 5 填）

| 步驟 | 提示文字 | 完成條件 |
|------|---------|---------|
| 1 |  |  |
| 2 |  |  |
| 3 |  |  |

---

## 待解 / 阻塞清單

- [ ] `assets/Toturial.tmx`（root 舊名）vs `assets/map/Tutorial.tmx`（新位置）— LIN 自己處理
- [ ] `assets/map/Tutorial.tmx` 還沒 .meta（要開 Cocos 讓它 import）
- [ ] `settings/builder.json` 還沒 commit（看是否需要進團隊版控）
- [ ] 角色美術素材尚未確認來源
- [ ] 行動裝置支援未定（目前只做鍵盤）

---

## 開發紀錄

每次 commit 完在這裡記一行：

- `2026-05-28` 建立此計畫文件
- `2026-05-29` 切到 `feature/pkboie-player_tutorial` 分支；清理 main 上 CRLF 雜訊與空資料夾雜訊；commit `Tutorial.fire`；建 `Player.ts`（基礎移動/跳躍/面向）
- `2026-05-29` 重新設計：寫 `player_design.md`；`Player.ts` 升級加入 coyote time + jump buffer + accel/decel + 明確 state machine + event 詞彙
- `2026-05-29` Phase 2：寫 `TiledColliderBuilder.ts`（Tiled 物件層 → box2d 碰撞器）；`Player.ts` 切換到 box2d 物理（linearVelocity + onBeginContact + gravityScale）；寫 `collision_setup.md` 設定備忘
- `2026-05-29` 重構：`TiledColliderBuilder` 改用多物件層 LayerSpec 架構（ground/floor/wall 各一層）；新增 `cocos_workflow.md` LIN 個人的 Cocos 工作流程規定 + 標準步驟 + 動態 TODO 清單
- `2026-05-29` 重新設計：改成 Mario 模式 — 單一 `objects` 物件層 + 物件 name 直接對應 Cocos node.group + Group Manager 矩陣處理碰撞；移除 LayerSpec / Tag 慣例；docs 全面更新
- `2026-06-01` Phase 3 第一步：抽出 `PlayerInput.ts`（鍵盤 → event），Player.ts SECTION 2 改成接 event；輸入和行為解耦，之後換觸控 / 手把 / AI 都不用動 Player.ts
- `2026-06-01` Phase 3 第二步：新建 `PlayerAnimator.ts`，訂閱 `state-changed` 切 clip、訂閱 `facing-changed` 翻 scaleX；Player.ts 不再碰 node.scaleX，純剩物理與狀態；clip 名稱 @property 化，動畫素材未就位也不會錯
- `2026-06-01` PlayerAnimator 改為**逐幀貼圖**版（frame array + FPS），不用 cc.Animation 編輯器；Inspector 直接拉 SpriteFrame 進每狀態陣列、設 FPS；JUMP/FALL 可設「停最後一張」避免循環觀感
- `2026-06-01` Phase 4-A：新建 `Bullet.ts`（box2d sensor 版，跟舊 `characters/Bullet.ts` 區隔）+ `PlayerCombat.ts`（NodePool + 按住連射）；`PlayerInput.ts` 加攻擊事件
- `2026-06-01` Phase 4-A 改寫成「滑鼠瞄準射擊」：射擊鍵改滑鼠左鍵（按住連射）、武器跟著滑鼠轉向（新 `WeaponAim.ts`，滑鼠在左翻 scaleY 讓槍管朝外）、子彈方向 = normalize(滑鼠 − 槍口)、`Bullet.init` 改收 `Vec2` 並隨方向旋轉視覺、Player 面向改由 WeaponAim 決定（依滑鼠 x 相對武器中心，含 8px 死區），Player.ts 移除速度判面向邏輯
- `2026-06-02` Phase 4-B：新建 `PlayerHealth.ts`（HP / 0.8s 無敵 / 死亡 disable 移動射擊 / flashNode 透明度閃爍）+ `Damager.ts`（陷阱接觸 player → takeDamage，可選持續傷害模式由 PlayerHealth 無敵節流）+ `Damageable.ts`（通用敵人 HP，介面對稱方便靶子測試 / 之後換成正式敵人）；Bullet 鴨子型別清單加 Damageable；統一 `takeDamage(damage, attacker?) → boolean` 介面，呼叫端不用知道對方 class
