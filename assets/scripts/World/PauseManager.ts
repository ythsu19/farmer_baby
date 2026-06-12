const { ccclass, property } = cc._decorator;

@ccclass
export default class PauseManager extends cc.Component {

    @property(cc.Node)
    pausePanel: cc.Node = null;

    private isPaused: boolean = false;

    onLoad() {
        if (this.pausePanel) {
            this.pausePanel.active = false;
        }
    }

    public togglePause() {
        if (this.isPaused) {
            this.resumeGame();
        } else {
            this.pauseGame();
        }
    }

    public pauseGame() {
        this.isPaused = true;

        if (this.pausePanel) {
            this.pausePanel.active = true;
        }

        cc.log("pause");
    }

    public resumeGame() {
        this.isPaused = false;

        if (this.pausePanel) {
            this.pausePanel.active = false;
        }

        cc.log("resume");
    }
}