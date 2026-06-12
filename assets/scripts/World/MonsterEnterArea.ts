const { ccclass, property } = cc._decorator;

@ccclass
export default class MonsterEnterArea extends cc.Component {

    @property(cc.Node)
    player: cc.Node = null;

    @property(cc.Node)
    monsterButton: cc.Node = null;

    @property
    enterDistance: number = 500;

    @property
    monsterSceneName: string = "Monster";

    private canEnter: boolean = false;

    start() {
        if (this.monsterButton) {
            this.monsterButton.active = false;
        }

        cc.log("[MonsterEnterArea] start");
        cc.log("player =", this.player ? this.player.name : "null");
        cc.log("monsterButton =", this.monsterButton ? this.monsterButton.name : "null");
        cc.log("enter point =", this.node.name, this.node.position);
    }

    update(dt: number) {
        if (!this.player || !this.monsterButton) return;

        const playerWorldPos = this.player.convertToWorldSpaceAR(cc.v2(0, 0));
        const pointWorldPos = this.node.convertToWorldSpaceAR(cc.v2(0, 0));

        const distance = playerWorldPos.sub(pointWorldPos).mag();

        if (distance <= this.enterDistance) {
            this.canEnter = true;
            this.monsterButton.active = true;
        } else {
            this.canEnter = false;
            this.monsterButton.active = false;
        }
    }

    public enterMonster() {
        if (!this.canEnter) return;

        cc.director.loadScene(this.monsterSceneName);
    }
}