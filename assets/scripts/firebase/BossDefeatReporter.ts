// BossDefeatReporter — Boss 被打贏時：把玩家剩餘血量提交到排行榜
//
// 掛在 Boss 節點上（跟 Boss.ts 同節點）。
// Boss 死亡會 emit 'died' 事件，本元件監聽它 → 讀玩家血量 → 提交成績（血量越高排越前）。
//
// 為什麼獨立成一支，不寫進 Boss.ts？
//   Boss.ts 是戰鬥核心，排行榜是另一個關注點。拆開 → Boss 不依賴 Firebase，
//   要不要上排行榜只看這支元件掛不掛，乾淨。
//
// 暱稱來源：優先用登入的 email（取 @ 前面那段），沒登入就用 fallbackName。

import GameTimer from './GameTimer';
import LeaderboardManager from './LeaderboardManager';
import AuthManager from './AuthManager';

const { ccclass, property } = cc._decorator;

@ccclass
export default class BossDefeatReporter extends cc.Component {

    @property({ type: [cc.Node], tooltip: '玩家節點（掛 PlayerHealth 的那些）。單人拖 1 個、雙人拖 2 個。\n打贏時把所有玩家的剩餘血量「加總」當成績。' })
    playerNodes: cc.Node[] = [];

    @property({ tooltip: '沒登入時用的預設暱稱（有登入會用 email 名稱）。留空也會 fallback 成 test' })
    fallbackName: string = 'test';

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

        // 停計時（時間仍記著，之後若要顯示通關時間可用），這裡排行榜用血量
        GameTimer.stop();

        // 在 Boss 死亡「當下」就把需要的資料抓成「區域變數」。
        // ⚠️ 關鍵：Boss 節點會在 destroyDelay 後被 destroy，之後 this（本元件）上的屬性不可靠。
        //    所以 hp / name / 場景名都先存區域變數，下面的 setTimeout callback 完全不碰 this。
        const hp = this._readPlayerHp();
        const name = this._resolveName();
        const sceneName = this.nextSceneName;
        cc.log('[BossDefeatReporter] 打贏時玩家剩餘血量=', hp, '暱稱=', name, '目標場景=', sceneName);

        // 延遲提交+跳場景。
        // 不用 this.scheduleOnce（綁節點，Boss destroy 會取消它）→ 改 setTimeout（瀏覽器全域）。
        const ms = Math.max(0, this.delaySeconds) * 1000;
        setTimeout(() => {
            // 提交成績是背景工作，包 try/catch，絕不能擋住跳場景
            try {
                LeaderboardManager.submitHp(hp, name)
                    .then((res) => cc.log('[BossDefeatReporter] 提交結果:', res.ok, res.message || ''))
                    .catch((e) => cc.warn('[BossDefeatReporter] 提交例外:', e));
            } catch (e) {
                cc.warn('[BossDefeatReporter] 提交同步例外:', e);
            }

            // 跳場景：用區域變數 sceneName，不碰已被銷毀的 this
            if (sceneName) {
                cc.log('[BossDefeatReporter] 切換場景到:', sceneName);
                cc.director.loadScene(sceneName);
            } else {
                cc.warn('[BossDefeatReporter] nextSceneName 是空的，不跳場景');
            }
        }, ms);
    }

    /** 加總所有玩家當前血量（各自從 PlayerHealth 讀）。沒綁定回 0。 */
    private _readPlayerHp(): number {
        if (!this.playerNodes || this.playerNodes.length === 0) {
            cc.warn('[BossDefeatReporter] 未綁定 playerNodes，血量讀不到，提交 0');
            return 0;
        }
        let total = 0;
        for (const node of this.playerNodes) {
            if (!node) continue;
            const ph = node.getComponent('PlayerHealth') as any;
            if (ph && typeof ph.hp === 'number') {
                total += ph.hp;
            } else {
                cc.warn('[BossDefeatReporter]', node.name, '上找不到 PlayerHealth，該玩家算 0');
            }
        }
        return total;
    }

    /** 暱稱：有登入用 email @ 前面那段；否則用 fallbackName；都沒有 → 預設 'test'（保證不回空字串） */
    private _resolveName(): string {
        const user = AuthManager.getCurrentUser();
        if (user && user.email) {
            const at = user.email.indexOf('@');
            const fromEmail = at > 0 ? user.email.substring(0, at) : user.email;
            if (fromEmail && fromEmail.trim()) return fromEmail.trim();
        }
        // 沒登入 / email 取不到 → 用 fallbackName，連 fallbackName 也空 → 'test'
        const fb = (this.fallbackName || '').trim();
        return fb || 'test';
    }
}
