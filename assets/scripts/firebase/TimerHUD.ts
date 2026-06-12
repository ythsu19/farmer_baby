// TimerHUD — 即時顯示通關計時（讀 GameTimer，每幀更新 Label）
//
// 用途：
//   遊玩中在畫面角落顯示計時器（像競速遊戲）。計時停止後（打贏 Boss）會停在最終時間，
//   所以結算/排行榜畫面也可以用同一支顯示「最終通關時間」。
//
// 掛法：
//   - 掛在 Canvas 下的一個節點上（建議 Widget 對齊角落，例如右上）
//   - timeLabel 拖一顆 cc.Label
//   - 想加前綴（例如 "時間 "）填 prefix
//
// 資料來源：GameTimer.getElapsedMs()
//   - 計時中 → 即時跳動
//   - 已停止 → 停在最終時間
//   - 沒開始 → 顯示 00:00.00
//
// 效能：每幀更新文字字串。手機上若在意，可改成每 0.1 秒更新一次（見 updateInterval）。

import GameTimer from './GameTimer';

const { ccclass, property } = cc._decorator;

@ccclass
export default class TimerHUD extends cc.Component {

    @property({ type: cc.Label, tooltip: '顯示時間的 Label' })
    timeLabel: cc.Label = null;

    @property({ tooltip: '時間前面的前綴文字（例如「時間 」）；留空 → 只顯示數字' })
    prefix: string = '';

    @property({ tooltip: '多久更新一次顯示（秒）。0 = 每幀更新。0.05 約等於每秒 20 次，夠順又省效能' })
    updateInterval: number = 0.05;

    private _accum: number = 0;

    onLoad() {
        this._render();   // 一進場景先顯示一次
    }

    update(dt: number) {
        if (!this.timeLabel) return;
        if (this.updateInterval > 0) {
            this._accum += dt;
            if (this._accum < this.updateInterval) return;
            this._accum = 0;
        }
        this._render();
    }

    private _render() {
        if (!this.timeLabel) return;
        const ms = GameTimer.getElapsedMs();
        this.timeLabel.string = this.prefix + GameTimer.format(ms);
    }
}
