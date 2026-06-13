const { ccclass, property } = cc._decorator;

@ccclass
export default class PauseManager extends cc.Component {

    @property(cc.Node)
    pausePanel: cc.Node = null;

    public static isPaused: boolean = false;

    onLoad() {
        PauseManager.isPaused = false;

        if (this.pausePanel) {
            this.pausePanel.active = false;
        }
    }

    public togglePause() {
        if (PauseManager.isPaused) {
            this.resumeGame();
        } else {
            this.pauseGame();
        }
    }

    public pauseGame() {
        PauseManager.isPaused = true;

        if (this.pausePanel) {
            this.pausePanel.active = true;
        }

        cc.log("pause");
    }

    public resumeGame() {
        PauseManager.isPaused = false;

        if (this.pausePanel) {
            this.pausePanel.active = false;
        }

        cc.log("resume");
    }
}