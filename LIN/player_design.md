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
├── Player.ts          ← 主元件 + 組裝者；剩下移動 / 物理 / 狀態機
├── PlayerInput.ts     ← ✅ Phase 3：鍵盤 → 發 input:move / input:jump-down / input:attack-down/up
├── PlayerMovement.ts  ← 之後抽：移動 + 跳躍物理 + 落地判定
├── PlayerHealth.ts    ← HP、受傷、無敵時間、死亡（Phase 4-B）
├── PlayerCombat.ts    ← ✅ Phase 4-A：訂閱 input:attack → 從槍口 spawn 子彈（NodePool 池化）
├── Bullet.ts          ← ✅ Phase 4-A：box2d sensor 子彈（speed / damage / lifetime + onBeginContact）
├── PlayerAnimator.ts  ← ✅ Phase 3：訂閱 state-changed / facing-changed → 逐幀切 spriteFrame + 翻 scaleX
└── types.ts           ← 共用 enum / interface
```

> 舊的 `assets/scripts/characters/Bullet.ts` + `PlayerShooter.ts` 用 `cc.Collider`（碰撞系統），跟 box2d 不相容；新場景一律用 `assets/scripts/player/` 下的新版。

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
| `input:attack-down` | PlayerInput | — | 攻擊鍵按下瞬間 |
| `input:attack-up` | PlayerInput | — | 攻擊鍵放開瞬間（PlayerCombat 用來停連射） |
| `state-changed` | Player | `{ from, to }` | 動作狀態切換 |
| `jumped` | Player | `{ fromCoyote, double }` | 跳起來的瞬間（給音效） |
| `landed` | Player | — | 落地瞬間（給音效 + 灰塵特效） |
| `facing-changed` | Player | `right: boolean` | 面向翻轉 |
| `shot` | PlayerCombat | `{ dir: -1\|1 }` | 每發子彈瞬間（音效 / 後座力 / 鏡頭抖） |
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
| `fallGravityMul` | 1.1× | 下落略快於上升，但保留空中操控時間給二段跳；1.0 = 完全對稱拋物線；2026-06-01 由 1.6 調降 |

數值來源：Celeste、Hollow Knight、Super Mario 等平台動作的常見配置範圍。實際看遊戲調。

---

## 物理系統（Phase 2 已切到 box2d）

目前狀態：
- `node.x += vx*dt` → `rigidBody.linearVelocity` ✅
- 自製重力 → `cc.PhysicsManager.gravity` + `rigidBody.gravityScale`（下落倍率） ✅
- `_checkGround` 硬寫 Y → `onBeginContact` 法線 y 判定 ✅
- `tempGroundY` 屬性已移除 ✅
- 落地法線門檻獨立 `groundNormalThreshold` 屬性（預設 -0.5），避免側撞牆被當落地 ✅
- 設了 `fixedRotation` 不被撞翻、`enabledContactListener` 才會觸發 contact 事件 ✅

地形碰撞器透過 `assets/scripts/level/TiledColliderBuilder.ts` 從 Tiled 物件層自動生：
- 矩形 → BoxCollider
- 多邊形 → PolygonCollider（斜坡、L 型平台）
- 折線 → ChainCollider（單向地板、開放邊界）

設定步驟見 [collision_setup.md](collision_setup.md)。

---

## 武器 / 子彈架構（Phase 4-A）

```
Player 節點 (group: player)
├─ Player.ts / PlayerInput.ts / PlayerAnimator.ts / PlayerCombat.ts
├─ Sprite (player 本體圖，或交給 PlayerAnimator 切影格)
└─ Weapon 子節點 (純視覺，掛 cc.Sprite 用武器圖)
   └─ Muzzle 子節點 (空節點，標記槍口位置)
                ↑ PlayerCombat 的 muzzle 拉這個

Bullet.prefab (group: bullet)
├─ cc.Sprite                    ← 子彈圖
├─ cc.RigidBody                 ← Kinematic, Fixed Rotation, gravityScale=0, contactListener=on
├─ cc.PhysicsBoxCollider        ← Is Sensor, size 配子彈圖
└─ Bullet.ts                    ← speed / damage / lifetime
```

設計取捨：
- **武器當 Player 子節點而非獨立 prefab**：90% 的平台動作只有「角色拿一把槍朝面向方向射」，做太複雜浪費；之後要做換武器再抽成 `Weapon.ts` 即可。
- **子彈 spawn 後 parent = Player.node.parent（兄弟層級）**：避免子彈跟 Player 翻 scaleX 時連帶被翻，導致速度方向錯誤。
- **方向用 Player.facingRight 而不是 input dir**：射擊跟「角色面向」綁，玩家放開方向鍵也能保持原方向射；靜止瞄前方而不是亂飛。
- **連射靠 PlayerCombat 自己 tick**：PlayerInput 只發 attack-down/up 兩個 edge event，PlayerCombat 自己存 `_attackHeld` 在 update 裡判 cooldown。比靠 OS auto-repeat 穩定。
- **傷害是「鴨子型別」**：Bullet 不認識 enemy 類別，只要對方有 `takeDamage(damage, attacker?)` 就掉血。Monster / EnemyBase / PlayerHealth 都可實作，未來新敵人實作這個介面就接入。

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

1. ~~單檔 Player.ts，已分 SECTION，可直接執行~~ ✅
2. ~~Phase 2：升級物理（box2d + Tiled）~~ ✅
3. ~~Phase 3：抽 PlayerInput、PlayerAnimator~~ ✅
4. **Phase 4**：PlayerCombat + Bullet（4-A ✅）、PlayerHealth（4-B 待做）
5. **Phase 5**：可選 — 拆 PlayerStateMachine 出來

每個 Phase 都要保持 Tutorial 場景可玩。
