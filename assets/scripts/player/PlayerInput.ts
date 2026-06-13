// PlayerInput — P1 專用：箭頭移動 / 跳 + 滑鼠（瞄準/射擊）
//
// 鍵位設計（只負責 P1，因為要跟 P2 同台共用一組鍵盤）：
//   ←→     水平移動
//   ↑      跳
//   滑鼠   瞄準 + 射擊
//   /      衝刺（dash）— 跟方向鍵同一個區域，右手食指自然落點
// 不吃 A/D/W/Space — 那些留給 Player2Input.ts (P2 的 WASD + Space/W 跳 + E 技能 + Left Shift dash)。
//
// 為什麼不用 Right Shift？
//   Windows 把 Right Shift 拿來當 sticky keys / 系統快捷鍵 hook 之一，
//   多次按下後 OS 會吃掉事件，window-level keydown 也收不到。
//   /（forward slash, keyCode 191）走 cc.systemEvent 正常收得到，不需 DOM 繞道。
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
//   aimWorldPos(): cc.Vec2  — 滑鼠最新「世界座標」（即時依 Main Camera 節點位置補正，鏡頭移動也正確）
//   hasAim(): boolean       — 滑鼠是否已經動過（沒動過 → 武器/瞄準應該用預設方向）
//
// 滑鼠事件直接掛 cc.game.canvas 的 DOM event，跳過 Cocos node 的世界座標 hit-test。
// 為什麼？Cocos 2.4 對 node.on(MOUSE_*) 會檢查滑鼠世界座標是否落在節點 bbox 內；
// Canvas 的世界 bbox 不會跟 camera 走，所以 camera 移到 world x=2000+ 之後
// 滑鼠對應的世界座標就會超出 Canvas bbox → Cocos 不再觸發 → 角色變成不能射擊。
//
// 詳細設計請看 LIN/player_design.md「事件詞彙」。

const { ccclass } = cc._decorator;

@ccclass
export default class PlayerInput extends cc.Component {

    private _keys: Set<number> = new Set();
    private _dir = 0;

    private _domCanvas: HTMLCanvasElement | null = null;
    private _aimScreen: cc.Vec2 = cc.v2(0, 0);
    private _aimWorld: cc.Vec2 = cc.v2(0, 0);
    private _hasAim: boolean = false;

    onLoad() {
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this._onKeyDown, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_UP, this._onKeyUp, this);

        // 滑鼠：直接掛 DOM event，不走 Cocos node listener。
        // 為什麼不用 cc.find('Canvas').on(MOUSE_*)？
        //   Cocos 2.4 對 mouse event 做「世界座標 hit-test」— 滑鼠要在節點世界 bbox 內才觸發。
        //   Canvas 的世界 bbox 固定在 (0,0)–(designW, designH) 附近，不會跟 camera 走。
        //   一旦 camera 跟著 player 走到 world x=2000+，滑鼠對應的世界位置就超出 Canvas bbox，
        //   Cocos 不再觸發 Canvas 上的 MOUSE_*。
        //   直接掛 DOM event 沒這個 hit-test 問題，camera 怎麼移都正確。
        const dom: HTMLCanvasElement | null = (cc.game as any).canvas || null;
        if (dom) {
            this._domCanvas = dom;
            dom.addEventListener('mousedown', this._onDomMouseDown);
            dom.addEventListener('mouseup', this._onDomMouseUp);
            dom.addEventListener('mousemove', this._onDomMouseMove);
        } else {
            cc.warn('[PlayerInput] cc.game.canvas 不存在，滑鼠輸入不會運作');
        }

    }

    onDestroy() {
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this._onKeyDown, this);
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_UP, this._onKeyUp, this);

        if (this._domCanvas) {
            this._domCanvas.removeEventListener('mousedown', this._onDomMouseDown);
            this._domCanvas.removeEventListener('mouseup', this._onDomMouseUp);
            this._domCanvas.removeEventListener('mousemove', this._onDomMouseMove);
            this._domCanvas = null;
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
        if (e.keyCode === cc.macro.KEY.forwardslash) {
            this.node.emit('input:dash-down');
        }
        this._refreshDir();
    }

    private _onKeyUp(e: cc.Event.EventKeyboard) {
        this._keys.delete(e.keyCode);
        this._refreshDir();
    }

    private _refreshDir() {
        // P1 只吃方向鍵；A/D 留給 Player2Input.ts
        const left = this._keys.has(cc.macro.KEY.left);
        const right = this._keys.has(cc.macro.KEY.right);
        const dir = right ? 1 : left ? -1 : 0;
        if (dir === this._dir) return;
        this._dir = dir;
        this.node.emit('input:move', { dir });
    }

    private _isJumpKey(k: number): boolean {
        // P1 只用 ↑ 跳；Space / W 留給 Player2Input.ts，避免同台雙人按 Space 兩個一起跳
        return k === cc.macro.KEY.up;
    }

    // ── 滑鼠（直接掛 DOM event，跳過 Cocos node hit-test） ──────────────
    //
    // 用 arrow function 保留 this 綁定 — DOM addEventListener 不會自動綁 this。
    // MouseEvent.button: 0=左鍵、1=中鍵、2=右鍵

    private _onDomMouseDown = (e: MouseEvent) => {
        this._updateAimFromDom(e);
        if (e.button === 0) this.node.emit('input:attack-down');
    };

    private _onDomMouseUp = (e: MouseEvent) => {
        this._updateAimFromDom(e);
        if (e.button === 0) this.node.emit('input:attack-up');
    };

    private _onDomMouseMove = (e: MouseEvent) => {
        this._updateAimFromDom(e);
    };

    private _updateAimFromDom(e: MouseEvent) {
        const dom = this._domCanvas;
        if (!dom) return;
        const rect = dom.getBoundingClientRect();

        // 滑鼠在 DOM canvas 上的 CSS pixel 位置（相對 canvas 左上角、左上原點）
        const cssX = e.clientX - rect.left;
        const cssY = e.clientY - rect.top;

        // ── 為什麼不能用 (px / rect.width) * design.width？ ──
        //   getScreenToWorldPoint() 期待的輸入是「frame 實際像素座標」
        //   （= cc.view 的 viewport 座標系，已含 devicePixelRatio 與 fit 黑邊偏移），
        //   不是 design resolution 座標。兩者只有在「視窗剛好 == design size 且 DPR=1」
        //   時才相等 → 本機看起來正常，但 deploy 到網頁（視窗比例不同 / 高 DPI 螢幕 /
        //   SHOW_ALL 黑邊）就會點擊偏移。
        //
        //   正解：CSS pixel → frame pixel = 乘上 frameSize / rect 的比例，
        //   再 y 翻轉成左下原點。frameSize 已經是 cc.view 認知的實際 buffer 尺寸。
        const frame = cc.view.getFrameSize();
        const sx = frame.width / rect.width;
        const sy = frame.height / rect.height;

        this._aimScreen.x = cssX * sx;
        this._aimScreen.y = frame.height - cssY * sy; // DOM y 向下 → OpenGL y 向上
        this._hasAim = true;
    }

    private _recomputeAimWorld() {
        // 直接用 Cocos 官方 API `cc.Camera.main.getScreenToWorldPoint`：
        //   → 它用「實際渲染畫面的 view matrix」反向換算 screen → world
        //   → 保證跟畫面看到的座標一致，camera 怎麼動都正確
        //
        // 為什麼之前手算 (cameraWorld + screen − viewCenter) 不夠 robust？
        //   數學上等價，但前提是「拿到的 cameraNode = 實際渲染的 cc.Camera」。
        //   場景結構複雜（多個 cc.Camera / CameraFollow 掛錯節點 / parent 偏移）時，
        //   這個前提會破。讓 Cocos 自己回答「滑鼠 pixel 對應到世界哪裡」最穩。

        const cam = (cc.Camera as any).main as cc.Camera;
        if (cam && typeof (cam as any).getScreenToWorldPoint === 'function') {
            const out = cc.v3();
            (cam as any).getScreenToWorldPoint(cc.v3(this._aimScreen.x, this._aimScreen.y, 0), out);
            this._aimWorld.x = out.x;
            this._aimWorld.y = out.y;
            return;
        }

        // 沒 cc.Camera.main → 退化：螢幕當世界
        this._aimWorld.x = this._aimScreen.x;
        this._aimWorld.y = this._aimScreen.y;
    }

}
