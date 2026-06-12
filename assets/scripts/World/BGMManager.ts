const { ccclass, property } = cc._decorator;

@ccclass
export default class BGMManager extends cc.Component {

    @property({
        type: cc.AudioClip,
        tooltip: "場景背景音樂"
    })
    bgm: cc.AudioClip = null;

    @property({
        tooltip: "音量 0 ~ 1"
    })
    volume: number = 0.5;

    private bgmId: number = -1;

    onLoad() {
        if (!this.bgm) {
            cc.warn("[BGMManager] 沒有設定 BGM");
            return;
        }

        // 播放背景音樂，true 代表循環播放
        this.bgmId = cc.audioEngine.playMusic(this.bgm, true);
        cc.audioEngine.setMusicVolume(this.volume);
    }

    onDestroy() {
        // 離開場景時停止音樂
        cc.audioEngine.stopMusic();
    }
}