// Player2Input — P2 專用鍵盤輸入（同台雙人）
//
// 為什麼跟 PlayerInput.ts 分開？
//   PlayerInput 邊讀滑鼠邊讀鍵盤，鍵位是 P1 的（箭頭 + 滑鼠）。
//   P2 完全不用滑鼠，鍵位是 WASD + Space/W 跳 + E 技能。
//   兩支元件各讀各的鍵 → 同台雙人不會互相干擾。
//
// 鍵位設計：
//   A / D       水平移動（不吃方向鍵 — 那組留給 P1）
//   Space / W   跳（兩鍵等價）
//   E           技能（觸發 Player2Combat 的 5 連發追蹤子彈）
//   Left Shift  衝刺（dash）
//
// 事件（發在 this.node 上，前兩個跟 PlayerInput 同詞彙）：
//   input:move          { dir: -1|0|1 }   — 水平方向意圖改變（edge-driven）
//   input:jump-down                       — 按 Space 或 W 那一瞬間
//   input:skill-down                      — 按 E 那一瞬間（P2 專用）
//   input:dash-down                       — 按 Left Shift 那一瞬間（PlayerDash 監聽）
//
// 為什麼 Left Shift 要走 DOM keydown 不走 cc.systemEvent？
//   cc.Event.EventKeyboard 只暴露 keyCode；左右 Shift 都是 16，無法區分。
//   DOM KeyboardEvent.code === 'ShiftLeft' 才能精準只認左邊那顆，避免 P1 P2 dash 互相觸發。
//
// 詞彙跟 PlayerInput 對齊 → Player.ts 不用改就能吃 P2 的移動 / 跳；
// Player2Combat 監聽新的 input:skill-down 觸發技能。

const { ccclass } = cc._decorator;

@ccclass
export default class Player2Input extends cc.Component {

    private _keys: Set<number> = new Set();
    private _dir = 0;

    onLoad() {
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this._onKeyDown, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_UP, this._onKeyUp, this);
        // Left Shift dash — window 級 + capture phase，比 Cocos 自己的 keyboard listener 先攔
        window.addEventListener('keydown', this._onDomKeyDown, true);
    }

    onDestroy() {
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this._onKeyDown, this);
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_UP, this._onKeyUp, this);
        window.removeEventListener('keydown', this._onDomKeyDown, true);
        this._keys.clear();
    }

    // 雙 fallback：e.code === 'ShiftLeft' 或 e.location === 1（DOM_KEY_LOCATION_LEFT）
    // — 任一成立就算左 Shift，因為某些 Cocos 內嵌瀏覽器 e.code 可能空字串。
    private _onDomKeyDown = (e: KeyboardEvent) => {
        if (e.repeat) return;
        if (e.keyCode !== 16) return;
        const isLeft = e.code === 'ShiftLeft' || e.location === 1;
        if (!isLeft) return;
        if (!this._loggedDash) {
            this._loggedDash = true;
            cc.log('[Player2Input] Left Shift dash fired — code=', e.code, 'location=', e.location);
        }
        this.node.emit('input:dash-down');
    };
    private _loggedDash = false;

    private _onKeyDown(e: cc.Event.EventKeyboard) {
        const isRepeat = this._keys.has(e.keyCode);
        this._keys.add(e.keyCode);
        if (isRepeat) return;

        if (this._isJumpKey(e.keyCode)) {
            this.node.emit('input:jump-down');
        }
        if (e.keyCode === cc.macro.KEY.e) {
            this.node.emit('input:skill-down');
        }
        this._refreshDir();
    }

    private _onKeyUp(e: cc.Event.EventKeyboard) {
        this._keys.delete(e.keyCode);
        this._refreshDir();
    }

    private _refreshDir() {
        const left = this._keys.has(cc.macro.KEY.a);
        const right = this._keys.has(cc.macro.KEY.d);
        const dir = right ? 1 : left ? -1 : 0;
        if (dir === this._dir) return;
        this._dir = dir;
        this.node.emit('input:move', { dir });
    }

    private _isJumpKey(k: number): boolean {
        return k === cc.macro.KEY.space || k === cc.macro.KEY.w;
    }
}
