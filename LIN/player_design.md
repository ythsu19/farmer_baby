# Player 設計文件 — LIN

> 目的：為 farmer_baby 設計一個**手感好、可維護、可擴充**的 2D 平台動作角色。
> 寫於 2026-05-29

---

## 設計原則

| 原則 | 為什麼 |
|------|--------|
| **組合，不繼承** | 一個元件做一件事，方便獨立測試、互換、移除 |
| **事件驅動** | 元件間用 cc event 通訊，HUD / Audio / Tutorial 可旁聽，不耦合 |
| **資料驅動** | 所有數值在 `@property` 給設計師調，不寫死 |
| **物理整合** | 從第一天就規劃用 box2d，不靠硬寫地板 Y |
| **手感優先** | 加入 coyote time + jump buffer + accel/decel，動作遊戲必備 |
| **可分階段擴充** | 程式碼用 `── SECTION ──` 標記未來抽出元件的邊界 |

---

## 元件規劃

```
assets/scripts/player/
├── Player.ts          ← 主元件。目前先全部塞這，已用 SECTION 標好邊界
├── PlayerInput.ts     ← Phase 抽出：鍵盤 / 觸控 → 發 input event
├── PlayerMovement.ts  ← Phase 抽出：移動 + 跳躍物理 + 落地判定
├── PlayerHealth.ts    ← HP、受傷、無敵時間、死亡
├── PlayerCombat.ts    ← 攻擊 / 射擊 / 子彈池
├── PlayerAnimator.ts  ← 訂閱 state event → 切 cc.Animation clip
└── types.ts           ← 共用 enum / interface
```

職責邊界很嚴格：
- **PlayerInput** 不知道角色會做什麼，只說「使用者按了什麼」
- **PlayerMovement** 不知道輸入來源，只接 event 算物理
- **PlayerAnimator** 不改遊戲邏輯，只訂閱狀態切動畫
- **Player** 是組裝者 + 對外公開 API

---

## 事件詞彙

所有事件都在 `player.node` 上發。命名規則：
- `input:*` — 私有，元件間通訊用，前綴避免汙染外部
- 其他都是公開事件，HUD / Tutorial / Audio 可訂閱

| 事件 | 發送者 | 載荷 | 用途 |
|------|--------|------|------|
| `input:move` | PlayerInput | `{ dir: -1\|0\|1 }` | 水平移動意圖 |
| `input:jump-down` | PlayerInput | — | 跳躍按下（進緩衝） |
| `input:attack` | PlayerInput | — | 攻擊意圖 |
| `state-changed` | Player | `{ from, to }` | 動作狀態切換 |
| `jumped` | Player | `{ fromCoyote, double }` | 跳起來的瞬間（給音效） |
| `landed` | Player | — | 落地瞬間（給音效 + 灰塵特效） |
| `facing-changed` | Player | `right: boolean` | 面向翻轉 |
| `hp-changed` | PlayerHealth | `{ hp, maxHp, delta }` | HUD 用 |
| `hurt` | PlayerHealth | `{ damage, from }` | 受傷瞬間 |
| `died` | PlayerHealth | — | 死亡（結算用） |

---

## 狀態機

```
                  ┌─ landed ──┐
                  ▼            │
┌─────┐  vx≠0  ┌──────┐  vy>0 │
│IDLE │◀─────▶│ WALK │───────▼
└──┬──┘        └──┬───┘    ┌──────┐
   │ vy>0         │ vy>0   │ JUMP │
   └─────────────▶▼        └──┬───┘
              ┌──────┐        │ vy<0
              │ JUMP │◀───────┘
              └──┬───┘
                 │ vy<0
                 ▼
             ┌──────┐
             │ FALL │
             └──┬───┘
                │ landed
                ▼
            (IDLE / WALK 看 vx)
```

未來會加：`ATTACK`、`HURT`、`DODGE`、`DEAD`。

---

## 手感參數（為什麼這些值）

| 參數 | 預設 | 為什麼 |
|------|------|--------|
| `coyoteTime` | 0.1s | 跳台邊緣掉下時還能跳 — 玩家不會懊惱「我明明還在邊緣」 |
| `jumpBuffer` | 0.1s | 落地前按跳，落地瞬間自動執行 — 玩家不會懊惱「我明明有按」 |
| `acceleration` | 1800 px/s² | 走起來不會瞬間滿速，但 ~0.13s 達速，反應夠快 |
| `deceleration` | 1400 px/s² | 比加速度小一點，鬆開後有滑行感 |
| `fallGravityMul` | 1.6× | 下落比上升快 — 經典「太空狗」式跳躍弧線 |

數值來源：Celeste、Hollow Knight、Super Mario 等平台動作的常見配置範圍。實際看遊戲調。

---

## 為什麼不直接用 box2d

第一階段先用 transform-based + `tempGroundY` 是因為：
- Player.prefab 還不一定有 RigidBody 設好
- Tiled map 碰撞層還沒在 Cocos 內配
- 先讓「按鍵能動」可玩，再升級到物理

Phase 2 會切到 box2d：
- `node.x += vx*dt` → `rigidBody.linearVelocity = ...`
- `_checkGround` → `onBeginContact` 法線判定
- 重力交給 box2d，移除 `gravity` 屬性

---

## 對外公開 API

```typescript
class Player {
    readonly state: PlayerState;
    readonly facingRight: boolean;
    readonly velocity: cc.Vec2;
    readonly isGrounded: boolean;
}
```

不開放 setter — 想改狀態請發 event 或呼叫具名方法（未來：`takeDamage`、`forceJump` 等）。

---

## 為什麼這樣設計（決策紀錄）

- **為什麼不用繼承 / mixin**：Cocos 元件本身就是組合模型，硬套繼承會跟生命週期打架
- **為什麼用 `node.emit` 而不是 `cc.systemEvent`**：systemEvent 是全域，多個 Player（雙人模式 / NPC）會打架。`node.emit` 範圍限定在那個 player
- **為什麼 `input:` 前綴**：避免外部誤訂閱輸入事件 — 那是內部實作細節
- **為什麼 `_checkGround` 不抽出**：目前耦合 transform 位置，box2d 化之後整段會替換，現在拆反而麻煩
- **為什麼 facing 用 velocity 判斷**：用 input dir 會在加速期間就翻面、太靈敏；用 velocity 比較自然

---

## 後續演進路徑

1. **現在**：單檔 Player.ts，已分 SECTION，可直接執行
2. **Phase 2**：升級物理（box2d + Tiled）
3. **Phase 3**：抽 PlayerInput、PlayerAnimator
4. **Phase 4**：加 PlayerHealth、PlayerCombat
5. **Phase 5**：可選 — 拆 PlayerStateMachine 出來

每個 Phase 都要保持 Tutorial 場景可玩。
