const { ccclass, property } = cc._decorator;

@ccclass
export default class BrianCamera extends cc.Component {

    @property({ type: cc.Node, tooltip: '要追蹤的目標 (請把 Player1 拖進來)' })
    target: cc.Node = null;

    @property({ tooltip: '鏡頭跟隨的滑順度 (0~1之間，越小越平滑/有延遲感，1為瞬間死硬跟上)' })
    smoothness: number = 0.1;

    @property({ tooltip: 'X 軸偏移量 (例如想讓玩家偏畫面左邊一點，可設為正數或負數)' })
    offsetX: number = 0;

    // (因為 Y 軸固定了，所以我們不再需要 offsetY 這個屬性)

    lateUpdate(dt: number) {
        if (!this.target) return;

        // 1. 只計算 X 軸的預期位置
        let targetX = this.target.x + this.offsetX;

        // 2. X 軸使用線性插值 (lerp) 產生平滑過渡效果
        let currentX = cc.misc.lerp(this.node.x, targetX, this.smoothness);

        // 3. Y 軸直接鎖死為攝影機「當前的高度」，完全不理會玩家的 y 座標
        let currentY = this.node.y;

        // 4. 更新攝影機位置
        this.node.setPosition(currentX, currentY);
    }
}