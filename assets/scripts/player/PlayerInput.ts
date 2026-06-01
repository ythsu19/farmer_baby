// PlayerInput — 鍵盤（移動/跳） + 滑鼠（瞄準/射擊）
//
// 設計上 PlayerInput 不知道角色會做什麼，只負責「使用者按了什麼 / 滑鼠在哪」。
// 改觸控 / 手把 / AI 只要做出另一個發相同事件 / 提供 aimWorldPos() 的元件來換掉。
//
// 事件（發在 this.node 上）：
//   input:move          { dir: -1|0|1 }  — 水平方向意圖改變時觸發（edge-driven）
//   input:jump-down                      — 按下跳鍵那一瞬間（已濾掉 OS auto-repeat）
//   input:attack-down                    — 按下滑鼠左鍵那一瞬間
//   input:attack-up                      — 放開滑鼠左鍵那一瞬間
//
// 公開讀取：
//   aimWorldPos(): cc.Vec2  — 滑鼠最新「世界座標」（會即時用主相機把 screen→world 換算）
//   hasAim(): boolean       — 滑鼠是否已經動過（沒動過 → 武器/瞄準應該用預設方向）
//
// 滑鼠事件監聽在 cc.find('Canvas') 上 — Cocos 2.4 沒有 systemEvent 的滑鼠全域事件，
// 但 Canvas 節點會收到所有沒被上層擋掉的滑鼠事件。
//
// 詳細設計請看 LIN/player_design.md「事件詞彙」。

const { ccclass } = cc._decorator;

@ccclass
export default class PlayerInput extends cc.Component {

    private _keys: Set<number> = new Set();
    private _dir = 0;

    private _mouseTarget: cc.Node = null;
    private _aimScreen: cc.Vec2 = cc.v2(0, 0);
    private _aimWorld: cc.Vec2 = cc.v2(0, 0);
    private _hasAim: boolean = false;

    onLoad() {
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this._onKeyDown, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_UP, this._onKeyUp, this);

        // 滑鼠：掛在 Canvas 節點（沒有 Canvas 就靜默放棄滑鼠輸入）
        const canvas = cc.find('Canvas');
        if (canvas) {
            this._mouseTarget = canvas;
            canvas.on(cc.Node.EventType.MOUSE_DOWN, this._onMouseDown, this);
            canvas.on(cc.Node.EventType.MOUSE_UP, this._onMouseUp, this);
            canvas.on(cc.Node.EventType.MOUSE_MOVE, this._onMouseMove, this);
        } else {
            cc.warn('[PlayerInput] 找不到 Canvas，滑鼠輸入不會運作');
        }
    }

    onDestroy() {
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this._onKeyDown, this);
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_UP, this._onKeyUp, this);

        if (this._mouseTarget) {
            this._mouseTarget.off(cc.Node.EventType.MOUSE_DOWN, this._onMouseDown, this);
            this._mouseTarget.off(cc.Node.EventType.MOUSE_UP, this._onMouseUp, this);
            this._mouseTarget.off(cc.Node.EventType.MOUSE_MOVE, this._onMouseMove, this);
            this._mouseTarget = null;
        }
        this._keys.clear();
    }

    /** 公開 API：取得滑鼠最新世界座標（即時換算，鏡頭跟隨也正確） */
    aimWorldPos(): cc.Vec2 {
        this._recomputeAimWorld();
        return this._aimWorld;
    }

    /** 滑鼠是否已有過位置（避免遊戲開始第一瞬間瞎瞄） */
    hasAim(): boolean {
        return this._hasAim;
    }

    // ── 鍵盤 ──────────────────────────────────────────
    private _onKeyDown(e: cc.Event.EventKeyboard) {
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

    // ── 滑鼠 ──────────────────────────────────────────
    private _onMouseDown(e: cc.Event.EventMouse) {
        this._updateAimFromEvent(e);
        if (e.getButton() === cc.Event.EventMouse.BUTTON_LEFT) {
            this.node.emit('input:attack-down');
        }
    }

    private _onMouseUp(e: cc.Event.EventMouse) {
        this._updateAimFromEvent(e);
        if (e.getButton() === cc.Event.EventMouse.BUTTON_LEFT) {
            this.node.emit('input:attack-up');
        }
    }

    private _onMouseMove(e: cc.Event.EventMouse) {
        this._updateAimFromEvent(e);
    }

    private _updateAimFromEvent(e: cc.Event.EventMouse) {
        const loc = e.getLocation();
        this._aimScreen.x = loc.x;
        this._aimScreen.y = loc.y;
        this._hasAim = true;
    }

    private _recomputeAimWorld() {
        // 有主相機 → 用 getScreenToWorldPoint；沒有 → screen 直接當 world（Canvas 不偏移時等價）
        const cam = (cc.Camera as any).main as cc.Camera;
        if (cam && typeof (cam as any).getScreenToWorldPoint === 'function') {
            const out = cc.v3();
            (cam as any).getScreenToWorldPoint(cc.v3(this._aimScreen.x, this._aimScreen.y, 0), out);
            this._aimWorld.x = out.x;
            this._aimWorld.y = out.y;
        } else {
            this._aimWorld.x = this._aimScreen.x;
            this._aimWorld.y = this._aimScreen.y;
        }
    }
}
