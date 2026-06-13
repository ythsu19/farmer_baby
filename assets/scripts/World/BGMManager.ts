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

        // 讀取之前存的音量
        let savedVolume = cc.sys.localStorage.getItem("gameVolume");
        if (savedVolume !== null) {
            this.volume = parseFloat(savedVolume);
        }

        // 限制音量在 0 ~ 1
        this.volume = this.clampVolume(this.volume);

        // 播放背景音樂，true 代表循環播放
        this.bgmId = cc.audioEngine.playMusic(this.bgm, true);

        // 設定音量
        cc.audioEngine.setMusicVolume(this.volume);
        cc.audioEngine.setEffectsVolume(this.volume);
    }

    public setVolume(volume: number) {
        this.volume = this.clampVolume(volume);

        cc.audioEngine.setMusicVolume(this.volume);
        cc.audioEngine.setEffectsVolume(this.volume);

        cc.sys.localStorage.setItem("gameVolume", this.volume.toString());

        cc.log("[BGMManager] Volume set to " + Math.round(this.volume * 100) + "%");
    }

    public getVolume(): number {
        return this.volume;
    }

    private clampVolume(volume: number): number {
        if (isNaN(volume)) return 0.5;
        if (volume < 0) return 0;
        if (volume > 1) return 1;
        return volume;
    }

    onDestroy() {
        cc.audioEngine.stopMusic();
    }
}