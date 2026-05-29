# 角色開發計畫 — LIN

> 分支：`feature/pkboie-test`
> 場景：`assets/scenes/Toturial.fire`（注意：拼字是 Toturial 少一個 u，待 Cocos 內改名）
> 開始日期：2026-05-28

---

## ⚠️ 必須先做的事 — Phase 0：協調分工

組員 `feature/characters-player` 分支已存在 `assets/scripts/characters/PlayerController.ts`。
**在動角色程式前必須先確認：**

- [ ] 在群組問清楚：那條分支的 PlayerController 負責什麼？
- [ ] 我這邊負責的是？
  - [ ] (A) 教學關卡專用的引導角色 / NPC？
  - [ ] (B) Player 本身的控制器（會跟組員撞車）？
  - [ ] (C) 角色的動畫狀態機？
  - [ ] (D) 角色的能力/技能系統？
- [ ] 確認後在這份文件記下分工結論

**結論**（待填）：

```
我負責：
組員 X 負責：
共用介面：
```

---

## Phase 1：教學關卡骨架（場景組裝，無邏輯）

> 目標：場景能跑起來，看到角色站在地圖上能左右移動。
> 不寫任何業務邏輯，只驗證資源齊全 + 場景組裝。

- [ ] **1-1** Tutorial scene 改名：`Toturial.fire` → `Tutorial.fire`（**用 Cocos 資源管理器改**，不要用檔案總管）
- [ ] **1-2** Tutorial scene 加入 Canvas + 必要節點（Camera, AudioListener）
- [ ] **1-3** 確認 Tiled map (`Toturial.tmx`) 在場景內能渲染
- [ ] **1-4** 建立 `assets/prefabs/characters/` 資料夾（如果組員還沒建）
- [ ] **1-5** 建立暫時的 Player.prefab（單一 Sprite + 暫時用色塊）
- [ ] **1-6** 建立 `assets/scripts/managers/TutorialManager.ts`（教學關卡入口）
- [ ] **1-7** `TutorialManager` 用 `@property(cc.Prefab)` 引用 Player prefab 並 instantiate

**🛑 Commit point 1**：`feat: 教學關卡骨架（場景 + Player prefab + TutorialManager）`

---

## Phase 2：角色基礎移動

> 目標：方向鍵 / 觸控能控制角色移動。

- [ ] **2-1** 決定移動方式：鍵盤 / 觸控 / 虛擬搖桿（看遊戲是手機還是 PC）
- [ ] **2-2** 在 `assets/scripts/characters/` 寫 `PlayerMovement.ts`（或整合到 PlayerController，看 Phase 0 分工結論）
- [ ] **2-3** 接 `cc.SystemEvent.EventType.KEY_DOWN / KEY_UP` 或 touch 事件
- [ ] **2-4** 用 `cc.RigidBody` + `cc.PhysicsBoxCollider` 處理碰撞（如果是物理）
- [ ] **2-5** 限制角色不能走出地圖邊界
- [ ] **2-6** 在 Tutorial scene 測試

**🛑 Commit point 2**：`feat: 角色基礎移動`

---

## Phase 3：角色動畫狀態

> 目標：角色根據移動狀態切換動畫（idle / walk / run）。

- [ ] **3-1** 蒐集 / 製作角色動畫資源（.anim 或 frame animation）
- [ ] **3-2** 在 Player prefab 掛 `cc.Animation`
- [ ] **3-3** 寫 `PlayerAnimator.ts` 監聽移動狀態切片段
- [ ] **3-4** 處理面向（左右翻轉 `node.scaleX *= -1`）
- [ ] **3-5** Tutorial scene 測試

**🛑 Commit point 3**：`feat: 角色動畫狀態切換`

---

## Phase 4：教學引導流程

> 目標：教學關卡有引導 UI、步驟提示、完成判定。

- [ ] **4-1** 設計教學步驟（列在下方「教學腳本」區）
- [ ] **4-2** 做 `TutorialHint.prefab`（顯示提示文字 + 箭頭）
- [ ] **4-3** `TutorialManager` 用 step machine 控制流程
- [ ] **4-4** 每完成一步觸發下一個 hint
- [ ] **4-5** 全部完成後可進入正式關卡（Game.fire）

**🛑 Commit point 4**：`feat: 教學引導流程`

---

## Phase 5：角色互動能力（看分工調整）

> 此 phase 視 Phase 0 結論決定要不要做。

- [ ] **5-1** 角色互動（拾取、對話、攻擊？看遊戲玩法）
- [ ] **5-2** 與道具系統 / NPC 系統的介面
- [ ] **5-3** Tutorial 內加入互動教學步驟

**🛑 Commit point 5**：`feat: 角色互動能力`

---

## 教學腳本（草稿，待 Phase 4 填）

| 步驟 | 提示文字 | 完成條件 |
|------|---------|---------|
| 1 |  |  |
| 2 |  |  |
| 3 |  |  |

---

## 待解 / 阻塞清單

- [ ] **BLOCKER**：與 `feature/characters-player` 分工尚未確認（Phase 0）
- [ ] Toturial → Tutorial 改名（需 Cocos 內操作）
- [ ] 角色美術素材尚未確認來源
- [ ] 移動方式尚未確認（PC / 手機 / 跨平台）

---

## 開發紀錄

每次 commit 完在這裡記一行：

- `2026-05-28` 建立此計畫文件
