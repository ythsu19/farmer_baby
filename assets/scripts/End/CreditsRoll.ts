const {ccclass, property} = cc._decorator;

@ccclass
export default class CreditsRoll extends cc.Component {

    @property({ type: cc.Node, tooltip: "SpecialThanksText 節點" })
    specialThanksText: cc.Node = null;

    @property({ type: cc.Node, tooltip: "People (人名) 節點" })
    peopleText: cc.Node = null;

    @property({ type: cc.Node, tooltip: "Scoreboard 按鈕節點" })
    scoreboardBtn: cc.Node = null;

    @property({ type: cc.Node, tooltip: "回到 World 按鈕節點" })
    worldBtn: cc.Node = null;

    @property({ tooltip: "跑馬燈滾動的時間（秒）" })
    rollDuration: number = 10;

    @property({ tooltip: "文字要往上升多少距離 (像素)" })
    moveDistance: number = 1200; 

    start () {
        // 🌟 只有 Scoreboard 按鈕一開始要藏起來！
        if (this.scoreboardBtn) this.scoreboardBtn.opacity = 0;

        // 先安靜 1 秒鐘，再開始播放動畫
        this.scheduleOnce(() => {
            this.startRolling();
        }, 1.0);
    }

    startRolling() {
        if (this.specialThanksText) {
            cc.tween(this.specialThanksText)
                .by(this.rollDuration, { y: this.moveDistance })
                .start();
        }

        if (this.peopleText) {
            cc.tween(this.peopleText)
                .by(this.rollDuration, { y: this.moveDistance })
                .call(() => {
                    // ====== 文字播完後，只有 Scoreboard 按鈕會浮現 ======
                    if (this.scoreboardBtn) {
                        cc.tween(this.scoreboardBtn).to(1.0, { opacity: 255 }).start();
                    }
                })
                .start();
        }
    }

    public onScoreboardBtnClicked() {
        console.log("切換到計分板場景！");
        // cc.director.loadScene("ScoreboardScene"); 
    }

    public onWorldBtnClicked() {
        console.log("切換回 World 場景！");
        cc.director.loadScene("World"); 
    }
}