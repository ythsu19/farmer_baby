const { ccclass, property } = cc._decorator;

@ccclass
export default class FinalEnterArea extends cc.Component {

    @property(cc.Node)
    player: cc.Node = null;

    @property(cc.Node)
    finalButton: cc.Node = null;

    @property
    enterDistance: number = 500;

    @property
    finalSceneName: string = "Final";

    private canEnter: boolean = false;

    start() {
        if (this.finalButton) {
            this.finalButton.active = false;
        }

        cc.log("[FinalEnterArea] start");
        cc.log("player =", this.player ? this.player.name : "null");
        cc.log("finalButton =", this.finalButton ? this.finalButton.name : "null");
        cc.log("enter point =", this.node.name, this.node.position);
    }

    update(dt: number) {
        if (!this.player || !this.finalButton) return;

        const playerWorldPos = this.player.convertToWorldSpaceAR(cc.v2(0, 0));
        const pointWorldPos = this.node.convertToWorldSpaceAR(cc.v2(0, 0));

        const distance = playerWorldPos.sub(pointWorldPos).mag();

        if (distance <= this.enterDistance) {
            this.canEnter = true;
            this.finalButton.active = true;
        } else {
            this.canEnter = false;
            this.finalButton.active = false;
        }
    }

    public enterFinal() {
        if (!this.canEnter) return;

        cc.director.loadScene(this.finalSceneName);
    }
}