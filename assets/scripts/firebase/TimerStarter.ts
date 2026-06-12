// TimerStarter — 進入場景時啟動通關計時（給排行榜算成績用）
//
// 掛在「計時起點場景」（例如 World 大世界）的任一節點上。
// onLoad 時呼叫 GameTimer.start()，整個通關計時就從這裡開始跑，
// 一路持續到打贏 Boss（BossDefeatReporter 會 stop + 提交成績）。
//
// onlyIfNotRunning：
//   玩家可能多次進出 World（打一半回 Hub 再出發）。如果每次進 World 都 start()，
//   計時會被重置歸零。勾這個 → 只有「目前沒在計時」時才啟動，
//   重複進 World 不會洗掉已經跑的時間。
//   想「每次進這個場景都重新計時」→ 取消勾選。
//
// 重新開始一輪（例如玩家死亡重玩）：
//   在重玩入口呼叫 GameTimer.reset()，下次進 World 就會重新計時。

import GameTimer from './GameTimer';

const { ccclass, property } = cc._decorator;

@ccclass
export default class TimerStarter extends cc.Component {

    @property({ tooltip: '只在「還沒開始計時」時才啟動（避免重複進場景把時間洗掉）。\n取消勾 → 每次進這個場景都重新計時。' })
    onlyIfNotRunning: boolean = true;

    onLoad() {
        if (this.onlyIfNotRunning && GameTimer.isRunning()) {
            cc.log('[TimerStarter] 已在計時中，不重置（onlyIfNotRunning）');
            return;
        }
        GameTimer.start();
    }
}
