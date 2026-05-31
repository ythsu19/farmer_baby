// PlayerInput — 把鍵盤輸入翻譯成 Player 本地事件
//
// 設計上 PlayerInput 不知道角色會做什麼，只負責「使用者按了什麼」。
// 之後改觸控 / 手把 / AI 控制，做出一個發相同事件的元件來換掉即可，Player.ts 完全不用動。
//
// 事件（發在 this.node 上）：
//   input:move      { dir: -1|0|1 }  — 水平方向意圖改變時觸發（edge-driven）
//   input:jump-down                  — 按下跳鍵那一瞬間（已濾掉 OS auto-repeat）
//
// 詳細設計請看 LIN/player_design.md「事件詞彙」。

const { ccclass } = cc._decorator;

@ccclass
export default class PlayerInput extends cc.Component {

    private _keys: Set<number> = new Set();
    private _dir = 0;

    onLoad() {
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this._onKeyDown, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_UP, this._onKeyUp, this);
    }

    onDestroy() {
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this._onKeyDown, this);
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_UP, this._onKeyUp, this);
        this._keys.clear();
    }

    private _onKeyDown(e: cc.Event.EventKeyboard) {
        // OS auto-repeat 會持續發 KEY_DOWN，只認真正的新按下，避免跳躍被連續觸發成雙跳。
        const isRepeat = this._keys.has(e.keyCode);
        this._keys.add(e.keyCode);
        if (isRepeat) return;

        if (this._isJumpKey(e.keyCode)) {
            this.node.emit('input:jump-down');
        }
        this._refreshDir();
    }

    private _onKeyUp(e: cc.Event.EventKeyboard) {
        this._keys.delete(e.keyCode);
        this._refreshDir();
    }

    private _refreshDir() {
        const left = this._keys.has(cc.macro.KEY.a) || this._keys.has(cc.macro.KEY.left);
        const right = this._keys.has(cc.macro.KEY.d) || this._keys.has(cc.macro.KEY.right);
        const dir = right ? 1 : left ? -1 : 0;
        if (dir === this._dir) return;
        this._dir = dir;
        this.node.emit('input:move', { dir });
    }

    private _isJumpKey(k: number): boolean {
        return k === cc.macro.KEY.space || k === cc.macro.KEY.w || k === cc.macro.KEY.up;
    }
}
