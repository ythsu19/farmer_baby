const {ccclass, property} = cc._decorator;

@ccclass
export default class CreditsRoll extends cc.Component {

    @property({ type: cc.Node, tooltip: "SpecialThanksText 節點" })
    specialThanksText: cc.Node = null;

    @property({ type: cc.Node, tooltip: "People (人名) 節點" })
    peopleText: cc.Node = null;

    @property({ type: cc.Node, tooltip: "Scoreboard 按鈕節點" })
    scoreboardBtn: cc.Node = null;

    @property({ tooltip: "跑馬燈滾動的時間（秒）" })
    rollDuration: number = 10;

    @property({ tooltip: "文字要往上升多少距離 (像素)" })
    moveDistance: number = 1200; // 建議先設 1200 試試看

    start () {
        // 一開始先把按鈕藏起來 (透明度設為 0)
        if (this.scoreboardBtn) {
            this.scoreboardBtn.opacity = 0;
        }

        // 先安靜 1 秒鐘，再開始播放動畫
        this.scheduleOnce(() => {
            this.startRolling();
        }, 1.0);
    }

    startRolling() {
        // 讓標題往上滾動
        if (this.specialThanksText) {
            cc.tween(this.specialThanksText)
                .by(this.rollDuration, { y: this.moveDistance })
                .start();
        }

        // 讓人名往上滾動
        if (this.peopleText) {
            cc.tween(this.peopleText)
                .by(this.rollDuration, { y: this.moveDistance })
                .call(() => {
                    // ====== 文字播完後，按鈕浮現 ======
                    if (this.scoreboardBtn) {
                        cc.tween(this.scoreboardBtn)
                            .to(1.0, { opacity: 255 }) // 花 1 秒鐘漸漸浮現
                            .start();
                    }
                })
                .start();
        }
    }

    // 這個函數等一下要綁定給按鈕的 Click Events
    public onScoreboardBtnClicked() {
        console.log("切換到計分板場景！");
        // 把裡面的 "ScoreboardScene" 換成你們實際計分板場景的名稱
        // cc.director.loadScene("ScoreboardScene"); 
    }
}