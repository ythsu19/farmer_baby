const { ccclass, property } = cc._decorator;

@ccclass
export default class CameraFollow extends cc.Component {

    @property(cc.Node)
    target: cc.Node = null;

    @property(cc.Node)
    uiCanvas: cc.Node = null;

    lateUpdate(dt: number) {
        if (!this.target) {
            cc.log("[CameraFollow] target is null");
            return;
        }

        // 取得 Player 的世界座標
        const worldPos = this.target.convertToWorldSpaceAR(cc.Vec2.ZERO);

        // 轉成 Camera 父節點的座標
        const cameraParent = this.node.parent;
        const localPos = cameraParent.convertToNodeSpaceAR(worldPos);

        // Camera 跟著 Player
        this.node.setPosition(localPos.x, localPos.y);

        // Canvas 跟著 Camera
        if (this.uiCanvas) {
            this.uiCanvas.setPosition(localPos.x, localPos.y);
        }
    }
}