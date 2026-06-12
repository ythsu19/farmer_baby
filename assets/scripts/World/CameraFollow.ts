const { ccclass, property } = cc._decorator;

@ccclass
export default class CameraFollow extends cc.Component {

    @property(cc.Node)
    target: cc.Node = null;

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

        this.node.setPosition(localPos.x, localPos.y);

        cc.log("[CameraFollow] camera =", this.node.x, this.node.y);
    }
}