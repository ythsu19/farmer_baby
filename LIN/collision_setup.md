# Tiled + box2d 碰撞系統設定指南

> 對應計畫：[character_plan.md](character_plan.md) Phase 2
> 對應規定：[cocos_workflow.md](cocos_workflow.md)
> 對應程式：[TiledColliderBuilder.ts](../assets/scripts/level/TiledColliderBuilder.ts)

LIN 的工作流程：
- **Tiled 內**：每種地形類型 = 一個獨立物件層（ground / floor / wall ...）
- **Tiled Project**：用 Group 集中管理這些層
- **Cocos 內**：一個 `TiledColliderBuilder` 元件，`layers` 陣列填上每一層

---

## 1. Tiled 編輯器內

### 1-1 開 Tiled Project（一次性）
- 第一次：File → New → New Project → 選 `d:\farmer_baby\assets\map\` 當資料夾
- 之後：File → Open Project → 選 `.tiled-project` 檔
- Project 的好處：物件類型、屬性、Group 設定會跨檔保留

### 1-2 開 `assets/map/Tutorial.tmx`

### 1-3 為每種地形建獨立物件層
不要全部畫在同一層。按用途切分：

| 物件層名稱 | 對應的地形 | Tag 慣例 |
|-----------|----------|---------|
| `ground` | 主要可踩的地面 | 1 |
| `floor` | 次級平台 / 浮空板 | 2 |
| `wall` | 牆壁、不可穿越的垂直阻擋 | 10 |
| `death` | 死亡區 / 尖刺 / 落水區 | 100 |
| `trigger` | 觸發區（教學提示、checkpoint） | 200 |
| `pickup` | 收集物 / 道具 | 300 |

Tag 規範看 [cocos_workflow.md](cocos_workflow.md)。

### 1-4 用對應工具畫
| Tiled 工具 | 用途 | 對應 Cocos collider |
|-----------|------|---------------------|
| 矩形 (R) | 平地、牆、台子 | `cc.PhysicsBoxCollider` |
| 多邊形 (P) | 斜坡、L 型平台 | `cc.PhysicsPolygonCollider` |
| 折線 (L) | 單向地板、開放邊界 | `cc.PhysicsChainCollider` |

### 1-5 Project 內設 Group（一次性，可選）
- Edit → Preferences → Object Types（舊版）/ Project → Custom Types（新版 1.9+）
- 為 ground / floor / wall... 預先設好「群組」/類型定義
- 之後在每個 .tmx 內可直接套用，省事

### 1-6 儲存 .tmx

---

## 2. Cocos Creator 內

### 2-1 啟用物理引擎
在 Tutorial scene 一定會 `onLoad` 的元件（例如 TutorialManager 或 Player）內：

```ts
onLoad() {
    const physics = cc.director.getPhysicsManager();
    physics.enabled = true;
    physics.gravity = cc.v2(0, -1800);
    // 想看碰撞框：
    // physics.debugDrawFlags = cc.PhysicsManager.DrawBits.e_shapeBit;
}
```

> 重力建議跟 Player 的 jumpVelocity 配套調整。

### 2-2 TiledMap 節點掛 TiledColliderBuilder
- 選 TiledMap 節點 → Add Component → `TiledColliderBuilder`
- 在 `Layers` 陣列點 **+** 為每個 Tiled 物件層加一筆：
  - Layer Name：跟 Tiled 內名字一致（如 `ground`）
  - Tag：對應 Tag 慣例（如 ground=1）
  - Sensor：地形類 (ground/floor/wall) 不勾；trigger/pickup 勾起來
- 勾 `Debug` 看 console 確認每層讀到幾個物件

### 2-3 Player.prefab 加物理
- 選 Player 節點 → Add Component → `cc.RigidBody`
  - `Type` = `Dynamic`
  - `Fixed Rotation` = ✅
- Add Component → `cc.PhysicsBoxCollider`
  - `Size` 跟 sprite 一樣大
  - `Density` = 1
  - `Friction` = 0
  - `Restitution` = 0

### 2-4 Play 測試
- 掉到 ground 層畫的地板上
- 左右走、跳、雙跳
- 一直穿透 → debug 看 log，物件層名字是否打對？

---

## 3. 除錯小抄

| 症狀 | 可能原因 |
|------|---------|
| Player 一直往下掉 | 沒啟用物理 / 物件層名字打錯 / Player 沒掛 RigidBody |
| Console 看到 `找不到物件層 "xxx"` | Tiled 物件層名稱跟 LayerSpec 不一致 |
| Player 站著會抖 | Friction 太大 / 地板有縫 |
| 跳不起來 | jumpVelocity 太小 / Player 沒接觸到任何 ground |
| 一碰 trigger 就被擋住 | 該層忘記勾 `Sensor` |

---

## Tiled vs Cocos 座標

- `cc.TiledMap.getObjectGroup().getObjects()` 已自動轉成 Cocos 座標，**通常不用手動翻 Y**
- 物件 `x, y` 是物件的左下角（已轉換）
- `TiledColliderBuilder` 假設這個慣例
- 若實測位置偏移 → 在 `_build` 內微調 offset

---

## 4. 後續延伸

碰撞系統就緒後可以做：
- **死亡判定**：Player 監聽 `onBeginContact`，發現 `other.tag === 100`（death）→ 呼叫 PlayerHealth.die
- **重生點**：spawn 物件層的物件位置 → Player 出生位置
- **教學觸發**：trigger 物件層 → TutorialManager 切下一步
- **收集物**：pickup 物件層 → 接觸時刪節點 + 加分

都是同一套：Tiled 畫物件 + Cocos `TiledColliderBuilder` 加一筆 LayerSpec + 對應行為元件監聽 tag。
