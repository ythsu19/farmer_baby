// SfxOnEvent — 通用「事件觸發音效」元件
//
// 設計：每個音效不寫一支元件。一個 SfxOnEvent 配一個 event name + 一個 clip，
// 同節點要幾個音效就掛幾次。Inspector 看起來像：
//   Player1 節點
//     ├─ SfxOnEvent  event='shot'        clip=shoot.mp3
//     ├─ SfxOnEvent  event='dash:start'  clip=dash.mp3
//   Player2 節點
//     ├─ SfxOnEvent  event='skill-cast'  clip=skill.mp3
//     ├─ SfxOnEvent  event='dash:start'  clip=dash.mp3
//
// 為什麼不在 PlayerCombat / PlayerDash / Player2Combat 各自塞 cc.audioEngine.play？
//   邏輯元件 & 表現元件分開 — 換音效不用動戰鬥/dash 邏輯，
//   也方便策劃 / 美術自己在 Inspector 改 clip / 音量，不開 ts。
//
// 為什麼掛在發 event 的「同節點」就好，不需要設目標節點？
//   專案的事件詞彙統一是 `this.node.emit(...)` — 戰鬥 / dash 元件都掛在 Player 節點上，
//   所以 SfxOnEvent 跟它們同節點就能 on 到。
//   要監聽子節點 / 別人節點的 event 才需要拉 targetNode；目前沒這需求，先不加複雜度。
//
// 為什麼預設不擋疊播？
//   shot 本身有發射 cooldown、dash 有 0.6s 冷卻、skill 一次只 emit 一次 — 都不會爆。
//   疊播也是「連射感」— 通常想要。
//
// 防疊播：minInterval > 0 時，距上次播放未滿 minInterval 秒會跳過該次。
//   適用 hurt — 同幀多次接觸 / 連續受傷不會把音效堆疊變鋸齒聲。
//   建議值：hurt 0.15–0.2；不需要擋就留 0。

const { ccclass, property } = cc._decorator;

@ccclass
export default class SfxOnEvent extends cc.Component {

    @property({ displayName: '事件名稱', tooltip: "例：shot / skill-cast / dash:start / jumped / hurt" })
    eventName: string = '';

    @property({ type: cc.AudioClip, displayName: '音效 Clip' })
    clip: cc.AudioClip = null!;

    @property({ displayName: '音量 (0–1)', range: [0, 1, 0.05] })
    volume: number = 1.0;

    @property({ displayName: '最小間隔 (s)', tooltip: '距上次播放未滿這秒數就跳過；0=不擋。hurt 建議 0.15–0.2' })
    minInterval: number = 0;

    // 用 cc.director.getTotalTime() 拿單調遞增的毫秒戳，
    // 不用 Date.now() — 系統時間被改也不會炸；不用 dt 累積 — 不需要 update tick。
    private _lastPlayMs: number = -Infinity;

    onLoad() {
        if (!this.eventName) {
            cc.warn('[SfxOnEvent] eventName 沒設定，這個元件不會做任何事');
            return;
        }
        this.node.on(this.eventName, this._play, this);
    }

    onDestroy() {
        if (!this.eventName) return;
        this.node.off(this.eventName, this._play, this);
    }

    private _play() {
        if (!this.clip) return;
        if (this.minInterval > 0) {
            const now = cc.director.getTotalTime();
            if (now - this._lastPlayMs < this.minInterval * 1000) return;
            this._lastPlayMs = now;
        }
        // loop=false — SFX 都是 one-shot；clip 結束 audioEngine 自己回收 audioId
        cc.audioEngine.play(this.clip, false, this.volume);
    }
}
