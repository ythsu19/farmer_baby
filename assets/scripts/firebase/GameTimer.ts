// GameTimer — 全域通關計時（跨場景持續，給排行榜算成績用）
//
// 計時方式：記「開始時間戳」（Date.now()），停止時算差值。
//   用時間戳而非每幀累加 → 不受場景切換、節點銷毀、fps 影響，最準確。
//   資料是 static（存在記憶體），跨場景不會歸零。
//
// 用法：
//   遊戲開始（例如第一個關卡場景載入時）：
//     GameTimer.start();
//   打贏 Boss（Boss died 事件）時：
//     const ms = GameTimer.stop();           // 回傳總毫秒數
//     LeaderboardManager.submitTime(ms, 暱稱);
//   想中途看目前時間：
//     GameTimer.getElapsedMs();
//
// 注意：這是純計時工具，不是 cc.Component，不用掛在節點上，直接 import 呼叫。

export default class GameTimer {

    /** 開始的時間戳（毫秒）。0 = 還沒開始 */
    private static _startMs: number = 0;
    /** 停止時記下的最終時間（毫秒）。停止後 getElapsedMs 回傳這個 */
    private static _finalMs: number = 0;
    /** 是否正在計時中 */
    private static _running: boolean = false;

    /** 開始計時（會重置之前的紀錄）。整場遊戲開始時呼叫一次。 */
    public static start(): void {
        this._startMs = Date.now();
        this._finalMs = 0;
        this._running = true;
        cc.log('[GameTimer] 開始計時');
    }

    /** 停止計時，回傳總共花費的毫秒數。打贏 Boss 時呼叫。 */
    public static stop(): number {
        if (this._running) {
            this._finalMs = Date.now() - this._startMs;
            this._running = false;
            cc.log('[GameTimer] 停止計時，總時間(ms)=', this._finalMs);
        }
        return this._finalMs;
    }

    /** 目前已經過的毫秒數（計時中 → 即時計算；已停止 → 回傳最終時間；沒開始 → 0） */
    public static getElapsedMs(): number {
        if (this._running) return Date.now() - this._startMs;
        return this._finalMs;
    }

    /** 是否正在計時 */
    public static isRunning(): boolean {
        return this._running;
    }

    /** 重置（回到沒計時狀態）。重玩時可呼叫。 */
    public static reset(): void {
        this._startMs = 0;
        this._finalMs = 0;
        this._running = false;
    }

    /** 把毫秒格式化成 mm:ss.SS（跟 LeaderboardManager.formatTime 一致） */
    public static format(ms: number): string {
        const m = Math.floor(ms / 60000);
        const s = Math.floor((ms % 60000) / 1000);
        const cs = Math.floor((ms % 1000) / 10);
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${pad(m)}:${pad(s)}.${pad(cs)}`;
    }
}
