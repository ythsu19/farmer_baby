// BossDefeatReporter — Boss 被打贏時：停計時 + 把通關時間提交到排行榜
//
// 掛在 Boss 節點上（跟 Boss.ts 同節點）。
// Boss 死亡會 emit 'died' 事件，本元件監聽它 → GameTimer.stop() → 提交成績。
//
// 為什麼獨立成一支，不寫進 Boss.ts？
//   Boss.ts 是戰鬥核心，計時/排行榜是另一個關注點。拆開 → Boss 不依賴 Firebase，
//   要不要上排行榜只看這支元件掛不掛，乾淨。
//
// 暱稱來源：優先用登入的 email（取 @ 前面那段），沒登入就用 playerName 欄位。

import GameTimer from './GameTimer';
import LeaderboardManager from './LeaderboardManager';
import AuthManager from './AuthManager';

const { ccclass, property } = cc._decorator;

@ccclass
export default class BossDefeatReporter extends cc.Component {

    @property({ tooltip: '沒登入時用的預設暱稱（有登入會用 email 名稱）' })
    fallbackName: string = '匿名玩家';

    @property({ tooltip: '打贏後要跳的場景（例如 Result / MainMenu）。留空 → 不跳場景' })
    nextSceneName: string = '';

    @property({ tooltip: '打贏後延遲幾秒才提交/跳場景（留時間給死亡動畫）' })
    delaySeconds: number = 1.5;

    private _reported: boolean = false;

    onLoad() {
        // 監聽同節點 Boss 的死亡事件
        this.node.on('died', this._onBossDied, this);
    }

    onDestroy() {
        this.node.off('died', this._onBossDied, this);
    }

    private _onBossDied() {
        if (this._reported) return;
        this._reported = true;

        // 停計時，拿到通關毫秒
        const ms = GameTimer.stop();
        cc.log('[BossDefeatReporter] 通關時間(ms)=', ms, '=', GameTimer.format(ms));

        // 延遲一下再提交（讓死亡動畫播完），用 scheduleOnce 不依賴 async
        this.scheduleOnce(() => {
            this._submit(ms);
        }, this.delaySeconds);
    }

    private async _submit(ms: number) {
        const name = this._resolveName();
        const res = await LeaderboardManager.submitTime(ms, name);
        if (res.ok) {
            cc.log('[BossDefeatReporter] 成績已提交:', name, GameTimer.format(ms), res.message || '');
        } else {
            cc.warn('[BossDefeatReporter] 提交失敗:', res.message);
        }

        // 提交後跳場景（不管成功失敗都跳，避免卡住）
        if (this.nextSceneName) {
            cc.director.loadScene(this.nextSceneName);
        }
    }

    /** 暱稱：有登入用 email @ 前面那段，否則用 fallbackName */
    private _resolveName(): string {
        const user = AuthManager.getCurrentUser();
        if (user && user.email) {
            const at = user.email.indexOf('@');
            return at > 0 ? user.email.substring(0, at) : user.email;
        }
        return this.fallbackName;
    }
}
