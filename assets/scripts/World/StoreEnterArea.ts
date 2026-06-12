const { ccclass, property } = cc._decorator;

@ccclass
export default class StoreEnterArea extends cc.Component {

    @property(cc.Node)
    player: cc.Node = null;

    @property(cc.Node)
    storeButton: cc.Node = null;

    @property
    enterDistance: number = 500;

    @property
    storeSceneName: string = "Store";

    private canEnter: boolean = false;

    start() {
        if (this.storeButton) {
            this.storeButton.active = false;
        }

        cc.log("[StoreEnterArea] start");
        cc.log("player =", this.player ? this.player.name : "null");
        cc.log("storeButton =", this.storeButton ? this.storeButton.name : "null");
        cc.log("enter point =", this.node.name, this.node.position);
    }

    update(dt: number) {
        if (!this.player || !this.storeButton) return;

        // 轉成世界座標，避免 parent 不同造成距離錯誤
        const playerWorldPos = this.player.convertToWorldSpaceAR(cc.v2(0, 0));
        const pointWorldPos = this.node.convertToWorldSpaceAR(cc.v2(0, 0));

        const distance = playerWorldPos.sub(pointWorldPos).mag();

        
        if (distance <= this.enterDistance) {
            this.canEnter = true;
            this.storeButton.active = true;
        } else {
            this.canEnter = false;
            this.storeButton.active = false;
        }
    }

    public enterStore() {
        if (!this.canEnter) return;

        cc.director.loadScene(this.storeSceneName);
    }
}