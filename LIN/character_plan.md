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
- [ ] **3-3** 新建 `PlayerAnimator.ts`：監聽 `state-changed` 切 `cc.Animation` clip
- [ ] **3-4** 處理面向翻轉（聽 `facing-changed`）
- [ ] **3-5** 等動畫素材就位後接上實際 clip

**🛑 Commit point 3**：`refactor(player): 拆出 PlayerInput + PlayerAnimator`

---

## Phase 4：PlayerHealth + PlayerCombat

> 目標：補上 HP 系統與攻擊/射擊。

- [ ] **4-1** `PlayerHealth.ts`：maxHp / 受傷 / 無敵時間 / 死亡 event
- [ ] **4-2** `PlayerCombat.ts`：攻擊判定（近戰 hitbox 或 射擊 + 子彈池）
- [ ] **4-3** 在 Tutorial 加靶子驗證攻擊判定
- [ ] **4-4** 在 Tutorial 加陷阱驗證受傷流程

**🛑 Commit point 4**：`feat(player): HP + Combat 系統`

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
