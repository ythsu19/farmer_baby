// CameraShake — 畫面震動效果
//
// 掛在 Main Camera 節點上。提供 shake() 方法，會在一段時間內讓相機節點的位置
// 隨機抖動，振幅隨時間衰減到 0，結束後回到原位。
//
// 用法：
//   const cam = ...;  // Main Camera 節點
//   const shake = cam.getComponent('CameraShake');
//   if (shake) shake.shake();                 // 用預設強度
//   if (shake) shake.shake(0.4, 20);          // 自訂時長 / 振幅
//
// 也可以掛在任何節點上震那個節點（不限相機），原理一樣。
//
// 注意：震動是直接改 node.position，所以這個節點的位置不該同時被其他東西
// （例如跟隨玩家的相機腳本）每幀覆寫；若有跟隨腳本，請改成震它的子節點，
// 或讓跟隨腳本寫「基準位置」、由本元件在其上疊加抖動。本元件記錄 onLoad 當下
// 的位置當原位，shake 結束會回到該位置。

const { ccclass, property } = cc._decorator;

@ccclass
export default class CameraShake extends cc.Component {

    @property({ displayName: '預設持續時間 (s)', tooltip: 'shake() 不帶參數時用這個時長' })
    defaultDuration: number = 0.25;

    @property({ displayName: '預設振幅 (px)', tooltip: 'shake() 不帶參數時用這個最大位移；振幅會隨時間線性衰減到 0' })
    defaultMagnitude: number = 12;

    /** 原位（onLoad 當下的 position），shake 結束回到這裡 */
    private _origin: cc.Vec2 = null;
    private _timer: number = 0;
    private _duration: number = 0;
    private _magnitude: number = 0;
    private _shaking: boolean = false;

    onLoad() {
        this._origin = cc.v2(this.node.x, this.node.y);
    }

    /**
     * 開始震動。可重複呼叫，後一次會覆蓋前一次（重新計時，取較大振幅避免被弱的蓋掉）。
     * @param duration 持續秒數，省略 → defaultDuration
     * @param magnitude 最大位移 px，省略 → defaultMagnitude
     */
    public shake(duration?: number, magnitude?: number) {
        const d = (duration === undefined || duration === null || duration <= 0) ? this.defaultDuration : duration;
        const m = (magnitude === undefined || magnitude === null || magnitude <= 0) ? this.defaultMagnitude : magnitude;

        // 已在震動中又被呼叫 → 重新計時，振幅取較大者（強震不被弱震打斷）
        this._magnitude = this._shaking ? Math.max(this._magnitude, m) : m;
        this._duration = d;
        this._timer = d;
        this._shaking = true;
    }

    update(dt: number) {
        if (!this._shaking) return;

        this._timer = Math.max(0, this._timer - dt);
        if (this._timer <= 0) {
            // 結束 → 回原位
            this.node.x = this._origin.x;
            this.node.y = this._origin.y;
            this._shaking = false;
            return;
        }

        // 振幅隨剩餘時間線性衰減（剩越少抖越小）
        const ratio = this._timer / Math.max(0.0001, this._duration);
        const amp = this._magnitude * ratio;
        const dx = (Math.random() * 2 - 1) * amp;
        const dy = (Math.random() * 2 - 1) * amp;
        this.node.x = this._origin.x + dx;
        this.node.y = this._origin.y + dy;
    }

    onDisable() {
        // 被關掉時保險回原位，避免停在偏移狀態
        if (this._origin) {
            this.node.x = this._origin.x;
            this.node.y = this._origin.y;
        }
        this._shaking = false;
    }
}
