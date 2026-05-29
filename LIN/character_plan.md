# 角色開發計畫 — LIN

> 分支：`feature/pkboie-player_tutorial`（從最新 main 切出，含組員 PR #8/#9 內容）
> 場景：`assets/scenes/Tutorial.fire`（已改正拼字）
> 開始日期：2026-05-28
> 最後更新：2026-05-29

---

## Phase 0：分工結論（已決定）

組員（`feature/characters-player` → 已合進 main）做的 `assets/scripts/characters/PlayerController.ts`（313 行 god class）+ `PlayerShooter.ts` 設計有問題：
- 一個元件包山包海（輸入/移動/跳/閃躲/射擊/受傷/死/動畫狀態），難擴充也難測
- 自製重力+硬寫地板 Y，無法跟 Tiled 地形互動

**LIN 的決定**：
- ✅ 在 `assets/scripts/player/` 重寫**全新**的 Player 系統，採組合式設計
- ✅ 之後評估 OK 就把 `assets/scripts/characters/PlayerController.ts`、`PlayerShooter.ts` 廢掉（同時要處理 `Player.prefab` 對舊腳本的引用）
- ⚠️ `Bullet.ts`、`Monster.ts`、`MonsterManager.ts` 是組員的責任範圍，**不要動**

### 新架構（`assets/scripts/player/`）

| 檔案 | 職責 | 狀態 |
|------|------|------|
| `Player.ts` | 主元件（這次先做：移動 + 跳躍 + 面向） | ✅ Done |
| `PlayerInput.ts` | 把輸入從 Player.ts 抽出來，發 event 給其他元件 | ⏳ Pending |
| `PlayerHealth.ts` | HP / 受傷 / 死亡 / 無敵時間 | ⏳ Pending |
| `PlayerShooter.ts` | 射擊 + 子彈池（參考組員的 NodePool 設計） | ⏳ Pending |
| `PlayerAnimator.ts` | 聽 `player-state-changed` event 切動畫 | ⏳ Pending |

---

## Phase 1：基礎移動骨架（✅ 部分完成）

> 目標：場景能跑、角色能左右走、能跳、面向會翻。

- [x] **1-1** Tutorial scene 改名為 `Tutorial.fire`（用 Cocos 改的）
- [x] **1-2** 建 `assets/scripts/player/Player.ts`：keyboard 輸入 + 移動 + 跳躍 + 面向 + state event
- [ ] **1-3** Cocos 內把 `Player.ts` 掛到 `Player.prefab`（或新建 prefab） — **下次開 Cocos 要做**
- [ ] **1-4** 在 `Tutorial.fire` 拖入 Player，設 `tempGroundY` 然後 Play
- [ ] **1-5** 確認移動 / 跳躍 / 雙跳 / 面向翻轉都正常

**🛑 Commit point 1（已 commit）**：`feat(player): 全新 Player 控制器 (移動/跳躍/面向)`

---

## Phase 2：用 Tiled 物理取代暫用地板

> 目標：用真實物理跟 Tiled map 互動，丟掉 `tempGroundY` 硬寫。

- [ ] **2-1** Tiled 地形碰撞層在 Cocos 內設好（TiledMap collider）
- [ ] **2-2** Player.prefab 加 `cc.RigidBody` (type=Dynamic) + `cc.PhysicsBoxCollider`
- [ ] **2-3** 改寫 `Player.ts` 改用 `rigidBody.linearVelocity` 移動，重力交給 box2d
- [ ] **2-4** 落地判定改用 `onBeginContact` 法線方向
- [ ] **2-5** 移除 `tempGroundY` 屬性

**🛑 Commit point 2**：`feat(player): 用 box2d 物理 + Tiled 地形`

---

## Phase 3：拆出 PlayerInput + PlayerAnimator

> 目標：把 Player.ts 變薄；輸入和動畫各自獨立元件。

- [ ] **3-1** 新建 `PlayerInput.ts`：監聽鍵盤，發 `move`、`jump`、`shoot` event
- [ ] **3-2** Player.ts 改成接 event，不再直接讀鍵盤
- [ ] **3-3** 新建 `PlayerAnimator.ts`：監聽 `player-state-changed` 切 `cc.Animation` clip
- [ ] **3-4** 美術素材（動畫 frame）—— 等素材就位

**🛑 Commit point 3**：`refactor(player): 拆出 PlayerInput + PlayerAnimator`

---

## Phase 4：PlayerHealth + PlayerShooter

> 目標：補上 HP 和射擊。

- [ ] **4-1** `PlayerHealth.ts`：maxHp / 受傷 / 無敵時間 / 死亡 event
- [ ] **4-2** `PlayerShooter.ts`：搬組員的 NodePool 設計過來，但接 PlayerInput 的 `shoot` event
- [ ] **4-3** 廢棄 `assets/scripts/characters/PlayerController.ts` 和 `PlayerShooter.ts`（要先確認 Player.prefab 的 component 引用都換掉）

**🛑 Commit point 4**：`feat(player): HP + Shooter + 廢棄 characters/Player*`

---

## Phase 5：教學引導流程

> 目標：教學關卡有引導 UI、步驟提示、完成判定。

- [ ] **5-1** 設計教學步驟（列在下方「教學腳本」區）
- [ ] **5-2** 做 `TutorialHint.prefab`（顯示提示文字 + 箭頭）
- [ ] **5-3** `TutorialManager` 用 step machine 控制流程
- [ ] **5-4** 每完成一步觸發下一個 hint
- [ ] **5-5** 全部完成後可進入正式關卡（Game.fire）

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

- [ ] `assets/Toturial.tmx`（root 舊名）vs `assets/map/Tutorial.tmx`（新位置）—— LIN 自己處理
- [ ] `assets/map/Tutorial.tmx` 還沒 .meta（要開 Cocos 讓它 import）
- [ ] `settings/builder.json` 還沒 commit（看是否需要進團隊版控）
- [ ] 角色美術素材尚未確認來源
- [ ] 行動裝置支援未定（目前只做鍵盤）
- [ ] Player.prefab 對 `characters/PlayerController` 的 component 引用，Phase 4 廢棄前要先換成新的 Player.ts

---

## 開發紀錄

每次 commit 完在這裡記一行：

- `2026-05-28` 建立此計畫文件
- `2026-05-29` 切到 `feature/pkboie-player_tutorial` 分支（從 main 含 PR #8/#9）；清理 main 上 CRLF 雜訊與空資料夾雜訊；commit Tutorial.fire；建 `assets/scripts/player/Player.ts`（移動/跳躍/面向）
