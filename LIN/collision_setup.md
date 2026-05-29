# Tiled + box2d 碰撞系統設定指南（Mario 模式）

> 對應計畫：[character_plan.md](character_plan.md) Phase 2
> 對應規定：[cocos_workflow.md](cocos_workflow.md)
> 對應程式：[TiledColliderBuilder.ts](../assets/scripts/level/TiledColliderBuilder.ts)

LIN 的工作流程（仿 Mario）：
- **Tiled 內**：單一物件層（叫 `objects`），用 **物件 name** 標類別（ground / floor / coin / player_spawn ...）
- **Cocos 內**：`Project Settings → Group Manager` 設 group + 碰撞矩陣
- **程式**：`TiledColliderBuilder` 自動把 `obj.name` 設成 `node.group`，Cocos 用 Group Manager 矩陣決定誰跟誰碰撞

---

## 1. Tiled 編輯器內

### 1-1 開 `assets/map/Tutorial.tmx`

### 1-2 建一個物件層 `objects`（只要一層）
- 圖層 → 新增物件層 → 命名為 `objects`（跟 `TiledColliderBuilder.objectLayerName` 一致）

### 1-3 在這層拉物件，依用途**命名**

| 物件 name | 用途 | 工具 |
|-----------|------|------|
| `ground` | 主要地面 | 矩形 |
| `floor` | 次級平台 | 矩形 |
| `wall` | 牆壁 | 矩形 |
| `slope` | 斜坡 | 多邊形 |
| `coin` | 收集物（sensor） | 矩形 |
| `item` | 道具（sensor） | 矩形 |
| `trigger` | 教學提示觸發區（sensor） | 矩形 |
| `goal` | 通關點（sensor） | 矩形 |
| `player_spawn` | Player 出生點（不建碰撞器） | 點工具 |
| `enemy_spawn` | 敵人出生點 | 點工具 |

> Tiled 物件 Properties → Name 設名稱。Type 留空。

| Tiled 工具 | 對應 Cocos collider |
|-----------|---------------------|
| 矩形 (R) | `cc.PhysicsBoxCollider` |
| 多邊形 (P) | `cc.PhysicsPolygonCollider` |
| 折線 (L) | `cc.PhysicsChainCollider` |
| 點 (I) | 純位置點（給 spawn 用） |

### 1-4 儲存 .tmx

---

## 2. Cocos Creator 內

### 2-1 設定 Group Manager（**最關鍵的一步**）
`Project → Project Settings → Group Manager`

#### 加 group（與 Tiled 物件 name 對齊）
- `player`
- `ground`
- `floor`
- `wall`
- `slope`
- `coin`
- `item`
- `enemy`

> 命名要跟 Tiled 物件 name **完全一致**（大小寫敏感）。

#### 設碰撞矩陣
勾起的格子 = 兩個 group 會碰撞。建議：

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

主要規則：
- 玩家跟所有東西碰
- 地形（ground/floor/wall/slope）跟 player + enemy 碰
- 收集物（coin/item）只跟 player 碰
- enemy 跟地形碰

> 設好後 `settings/project.json` 會自動更新，要 commit 進去。

### 2-2 啟用物理引擎
在 Tutorial scene 一定會 `onLoad` 的元件內（暫時可放 Player.ts）：

```ts
onLoad() {
    const pm = cc.director.getPhysicsManager();
    pm.enabled = true;
    pm.gravity = cc.v2(0, -1800);
    // 看碰撞框（除錯用）：
    // pm.debugDrawFlags = cc.PhysicsManager.DrawBits.e_shapeBit;
}
```

### 2-3 TiledMap 節點 Add TiledColliderBuilder
- Add Component → `TiledColliderBuilder`
- `Object Layer Name` = `objects`（預設值）
- `Spawn Keyword` = `spawn`（預設）
- `Sensor Names` = `[coin, item, pickup, trigger, goal]`（預設可不改）
- 勾 `Debug`，第一次跑時 console 會印每個 name 的數量

### 2-4 Player 節點
- 階層管理器選 Player 節點
- Inspector 上方 **Group** 下拉 → 選 `player`
- Add Component → `cc.RigidBody`：Type=Dynamic、Fixed Rotation=✅
- Add Component → `cc.PhysicsBoxCollider`：Size 配 Sprite、Density=1、Friction=0、Restitution=0
- Add Component → `Player.ts`

### 2-5 Play 測試
- Player 掉到 ground / floor 上
- A/D 走、Space 跳
- 走到 coin 上 → 觸發 `onBeginContact`（之後實作 Pickup 邏輯）

---

## 3. 除錯小抄

| 症狀 | 可能原因 |
|------|---------|
| Player 一直往下掉 | 沒啟用物理 / Group Manager 矩陣 player↔ground 沒勾 / Player.group 沒選 |
| Console 看到 `找不到物件層 "objects"` | Tiled 物件層名稱拼錯，要跟 `objectLayerName` 一致 |
| Console 看到 `跳過未命名物件` | Tiled 物件 Name 空著沒填 |
| 碰到 coin 直接被擋住 | `sensorNames` 沒包含 coin / coin group 跟 player 在矩陣裡是「碰撞」不是 sensor |
| 跑得起來但摸不到 player_spawn 位置 | 用 `tiledColliderBuilder.getSpawnPoint('player_spawn')` 取 |

---

## 4. 後續延伸

碰撞系統就緒後：
- **死亡**：碰到 group=`death` 的 collider → PlayerHealth.die
- **重生**：用 `getSpawnPoint('player_spawn')` 在 PlayerHealth.die 後重新定位
- **教學觸發**：trigger sensor → TutorialManager 切下一步
- **收集物**：coin/item sensor → 接觸時刪節點 + 加分

都是同一套：Tiled 拉物件命名 + Cocos Group Manager 加 group + 對應行為元件聽 `onBeginContact`。
