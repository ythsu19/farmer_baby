const { ccclass, property } = cc._decorator;

@ccclass
export default class PauseButtonFollowCamera extends cc.Component {

    @property(cc.Camera)
    mainCamera: cc.Camera = null;

    @property(cc.Node)
    pausePanel: cc.Node = null;

    @property(cc.EditBox)
    volumeInput: cc.EditBox = null;

    @property(cc.Node)
    bgmManagerNode: cc.Node = null;

    @property
    offsetX: number = 70;

    @property
    offsetY: number = 70;

    private isPaused: boolean = false;

    onLoad() {
        if (this.pausePanel) {
            this.pausePanel.active = false;
        }

        let savedVolume = cc.sys.localStorage.getItem("gameVolume");
        let volume = savedVolume !== null ? parseFloat(savedVolume) : 0.5;

        this.setGameVolume(volume);

        if (this.volumeInput) {
            this.volumeInput.string = Math.round(volume * 100).toString();

            // 按 Enter 後套用音量
            this.volumeInput.node.on("editing-return", this.applyVolume, this);
            this.volumeInput.node.on("editing-did-ended", this.applyVolume, this);
        }

        this.node.on(cc.Node.EventType.TOUCH_END, this.onPauseButtonClicked, this);
    }

    onDestroy() {
        this.node.off(cc.Node.EventType.TOUCH_END, this.onPauseButtonClicked, this);

        if (this.volumeInput) {
            this.volumeInput.node.off("editing-return", this.applyVolume, this);
            this.volumeInput.node.off("editing-did-ended", this.applyVolume, this);
        }
    }

    lateUpdate() {
        if (!this.mainCamera) return;

        const visibleSize = cc.view.getVisibleSize();

        const screenPos = cc.v2(
            visibleSize.width - this.offsetX,
            visibleSize.height - this.offsetY
        );

        const worldPos = this.mainCamera.getScreenToWorldPoint(screenPos);

        const parent = this.node.parent;
        const localPos = parent.convertToNodeSpaceAR(worldPos);

        this.node.setPosition(localPos);
    }

    private onPauseButtonClicked(event: cc.Event.EventTouch) {
        event.stopPropagation();

        if (this.isPaused) {
            this.resumeGame();
        } else {
            this.pauseGame();
        }
    }

    private pauseGame() {
        this.isPaused = true;

        if (this.pausePanel) {
            this.pausePanel.active = true;
        }

        cc.log("Game paused");
    }

    private resumeGame() {
        this.isPaused = false;

        if (this.pausePanel) {
            this.pausePanel.active = false;
        }

        cc.log("Game resumed");
    }

    public applyVolume() {
        cc.log("applyVolume triggered");
        if (!this.volumeInput) return;

        let value = parseFloat(this.volumeInput.string);

        if (isNaN(value)) {
            value = 50;
        }

        if (value < 0) value = 0;
        if (value > 100) value = 100;

        this.volumeInput.string = value.toString();

        const volume = value / 100;

        this.setGameVolume(volume);

        cc.sys.localStorage.setItem("gameVolume", volume.toString());

        cc.log("Volume set to " + value + "%");
    }

    private setGameVolume(volume: number) {
        // 給 cc.audioEngine 用
        cc.audioEngine.setMusicVolume(volume);
        cc.audioEngine.setEffectsVolume(volume);

        // 給你們的 BGMManager 腳本用
        if (this.bgmManagerNode) {
            const bgmManager: any = this.bgmManagerNode.getComponent("BGMManager");

            if (bgmManager) {
                bgmManager.volume = volume;

                if (bgmManager.audioId !== undefined) {
                    cc.audioEngine.setVolume(bgmManager.audioId, volume);
                }

                if (bgmManager.setVolume) {
                    bgmManager.setVolume(volume);
                }
            }
        }
    }
}