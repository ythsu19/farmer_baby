// Platform — 單向可踩平台（only-from-top）
//
// 為什麼不用 PhysicsCollider？
//   PlayerController 沒有用 box2d 物理引擎，它自己手算重力 + 座標，落地只認一條
//   固定高度線 groundY。所以平台也用同一套「比座標」邏輯：每塊平台就是一條
//   有左右範圍、有高度的線段，PlayerController 每幀去比對。
//
// 單向（只能從上面踩）：
//   玩家從下往上跳 → 穿過平台（不擋）。
//   玩家從上往下落 → 落在平台頂面停住。
//   判定在 PlayerController._applyPosition 裡做，這支只提供「這塊平台的範圍」。
//
// 用法：
//   1. 在場景拖一個節點（可掛 Sprite 當平台圖），掛這支 Platform.ts。
//   2. 設 width / topY 對齊圖的左右寬度與頂面高度（topY 是相對節點原點往上的偏移）。
//   3. PlayerController 的 platforms 陣列把這些節點拖進去（或留空 → 自動抓場景所有 Platform）。

const { ccclass, property } = cc._decorator;

@ccclass
export default class Platform extends cc.Component {

    @property({ tooltip: '平台寬度 (px)：玩家 x 落在 [中心-寬/2, 中心+寬/2] 內才算踩得到' })
    width: number = 200;

    @property({ tooltip: '平台頂面相對節點原點的 Y 偏移 (px)：玩家會停在這個高度。\n節點原點在圖正中央時，這通常填「圖高的一半」；原點在底部就填圖高。' })
    topY: number = 0;

    /** 平台頂面的世界 Y（玩家踩上去會停在這個高度） */
    public getTopWorldY(): number {
        return this.node.y + this.topY;
    }

    /** 玩家的世界 x 是否落在這塊平台的左右範圍內 */
    public isXInRange(worldX: number): boolean {
        const half = this.width * 0.5;
        return worldX >= this.node.x - half && worldX <= this.node.x + half;
    }
}
