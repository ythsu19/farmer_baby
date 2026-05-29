# Tiled + box2d 碰撞系統設定指南

> 這份是 LIN 設好 Player + 碰撞系統的「開 Cocos 要做什麼」備忘。
> 對應計畫：[character_plan.md](character_plan.md) Phase 2

---

## 1. 在 Tiled 編輯器內

### 1-1 開 `assets/map/Tutorial.tmx`

### 1-2 加一個物件層（Object Layer）
- 圖層 → 新增物件層 → 命名為 `collision`
- 這個名字要跟 `TiledColliderBuilder.objectLayerName` 一致

### 1-3 用矩形 / 多邊形工具畫地形

| 工具 | 用途 | 對應 Cocos collider |
|------|------|---------------------|
| 矩形工具 R | 平地、牆、台子 | `cc.PhysicsBoxCollider` |
| 多邊形工具 P | 斜坡、L 型平台 | `cc.PhysicsPolygonCollider` |
| 折線工具 L | 開放邊界（單向地板） | `cc.PhysicsChainCollider` |

### 1-4 （可選）為物件加 type 分類
- 想區分「地板」與「死亡區」等用途，在物件 Properties 設 `type`
- 然後在 Cocos 開多個 `TiledColliderBuilder`，各自的 `filterType` 設成 `floor` / `death` 等

### 1-5 儲存 .tmx

---

## 2. 在 Cocos Creator 內

### 2-1 啟用物理引擎
在 Tutorial scene 某個一定會 onLoad 的元件（例如 TutorialManager 或 Player）寫：

```ts
onLoad() {
    const physics = cc.director.getPhysicsManager();
    physics.enabled = true;
    physics.gravity = cc.v2(0, -1800);  // 想看碰撞框的話 ↓
    // physics.debugDrawFlags = cc.PhysicsManager.DrawBits.e_shapeBit;
}
```

> 重力建議跟 Player 的 `gravity` 屬性對齊（預設 1800）。box2d 接手後，Player.ts 的 `gravity` 屬性可移除。

### 2-2 把 TiledMap 節點掛上 TiledColliderBuilder
- 選 TiledMap 節點 → Add Component → `TiledColliderBuilder`
- `Object Layer Name` 填 `collision`（跟 Tiled 一致）
- 勾 `Debug` 看 log 確認有讀到物件

### 2-3 Player.prefab 加物理
- 選 Player 節點 → Add Component → `cc.RigidBody`
  - `Type` = `Dynamic`
  - `Fixed Rotation` = ✅（不要被撞到旋轉）
- 再加 `cc.PhysicsBoxCollider`
  - `Size` 跟 sprite 一樣大
  - `Density` = 1
  - `Friction` = 0（左右走滑順）
  - `Restitution` = 0（不要彈跳）

### 2-4 Play 測試
- 應該掉到 Tiled 物件層畫的地板上
- 左右走、跳、雙跳都能動
- 若一直穿透地板 → 物件層名字是否打對？開 debug 看 log

---

## 3. 除錯小抄

| 症狀 | 可能原因 |
|------|---------|
| Player 一直往下掉 | 沒啟用物理 / 物件層名字錯 / 沒掛 RigidBody |
| Player 站在地板上但會抖 | Player rigidbody friction 太大 / 地板有空隙 |
| 碰撞器位置怪 | Tiled 的物件 Y 軸跟 Cocos 不一致 — 看 [Coord notes](#tiled-vs-cocos-座標) |
| 跳不起來 | jumpVelocity 太小 / 重力太大 / 沒進 onBeginContact |

---

## Tiled vs Cocos 座標

- Tiled：左上 (0,0)，Y 往下
- Cocos：左下 (0,0)，Y 往上
- `cc.TiledMap.getObjectGroup().getObjects()` 已自動轉成 Cocos 座標，**通常不用手動翻 Y**
- 物件 `x, y` 是物件的「左下角」位置（轉換後）
- `TiledColliderBuilder` 已假設這個慣例，矩形碰撞器 `offset` 設成 `(w/2, h/2)`
- 若實測位置偏移，是 Cocos 版本差異 — 在 `_build` 內微調

---

## 4. 後續

碰撞系統就緒後，可以做：
- 死亡區（type=`death` 的物件 → 觸發 PlayerHealth.die）
- 重生點（type=`spawn` 的物件 → Player 出生位置）
- 觸發區（type=`trigger` → 跑教學提示）
- 收集物（type=`pickup` → 加分/補血）

這些都是同一套：在 Tiled 畫物件 + 在 Cocos 讀物件層 + 對應行為元件。
