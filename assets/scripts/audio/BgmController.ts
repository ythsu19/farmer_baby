// BgmController — 背景音樂控制元件（場景級）
//
// 用法：
//   把這個元件掛到場景內某個「跟著場景生死」的節點（最自然是 Canvas）。
//   在 Inspector 把 mp3 拖到 clip property。
//   playOnLoad = true → onLoad 自動 play loop。
//   場景切換 → 該節點 destroy → onDestroy 自動 stop，下一個場景不會有殘留 BGM。
//
// 為什麼不用內建 cc.AudioSource 元件？
//   AudioSource 把 audioId 藏在內部、跨 component lifecycle 不一定能保證精準 stop。
//   走 cc.audioEngine.play 自己保存 audioId → onDestroy 一定能 stop 對的那首，
//   也方便之後加 fadeIn / fadeOut / 跨場景接續 BGM 之類。
//
// 為什麼用 cc.audioEngine 不直接 new Audio()？
//   cc.audioEngine 在 web / 微信小遊戲 / 原生 build 都有對應實作，
//   專案目前是 web build，但走 Cocos 抽象之後換平台不用改。
//
// 之後要做 fade / mute / 全域音量總控時，把邏輯加在這裡而不是場景每首歌各自重寫。

const { ccclass, property } = cc._decorator;

@ccclass
export default class BgmController extends cc.Component {

    @property({ type: cc.AudioClip, displayName: 'BGM Clip', tooltip: '拖 mp3 進來' })
    clip: cc.AudioClip = null!;

    @property({ displayName: 'Loop', tooltip: '通常 BGM 都要 loop' })
    loop: boolean = true;

    @property({ displayName: '音量 (0–1)', range: [0, 1, 0.05] })
    volume: number = 0.6;

    @property({ displayName: 'onLoad 自動播放', tooltip: '關掉的話需要其他元件 call play()' })
    playOnLoad: boolean = true;

    // -1 = 還沒播 / 已 stop。cc.audioEngine.play 回傳 audioId (number)，
    // 拿來在 stop / pause / setVolume 時精準對到這首歌。
    private _audioId: number = -1;

    onLoad() {
        if (this.playOnLoad) {
            this.play();
        }
    }

    onDestroy() {
        // 場景切換 → Canvas destroy → 走這裡把 BGM 收掉。
        // 不收的話下個場景一進去還在響、再掛新的 BgmController 兩首疊在一起。
        this.stop();
    }

    /** 開始播放 BGM。若已經在播會先 stop 舊的再重播，避免疊聲。 */
    play() {
        if (!this.clip) {
            cc.warn('[BgmController] clip 沒設定，跳過 play');
            return;
        }
        if (this._audioId !== -1) {
            cc.audioEngine.stop(this._audioId);
            this._audioId = -1;
        }
        this._audioId = cc.audioEngine.play(this.clip, this.loop, this.volume);
    }

    /** 停止 BGM。已經停了再 call 也沒事。 */
    stop() {
        if (this._audioId === -1) return;
        cc.audioEngine.stop(this._audioId);
        this._audioId = -1;
    }

    /** 即時改音量（不重播）。e.g. settings UI 滑桿。 */
    setVolume(v: number) {
        this.volume = cc.misc.clampf(v, 0, 1);
        if (this._audioId !== -1) {
            cc.audioEngine.setVolume(this._audioId, this.volume);
        }
    }
}
