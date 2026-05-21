const { ccclass, property } = cc._decorator;

export enum PlayerState {
    IDLE  = 'idle',
    MOVE  = 'move',
    RUN   = 'run',
    JUMP  = 'jump',
    FALL  = 'fall',
    DODGE = 'dodge',
}

@ccclass
export default class PlayerController extends cc.Component {

    @property({ displayName: '走路速度' })
    walkSpeed: number = 200;

    @property({ displayName: '奔跑速度' })
    runSpeed: number = 380;

    @property({ displayName: '跳躍力道' })
    jumpForce: number = 550;

    @property({ displayName: '最大跳躍次數（雙跳=2）', min: 1, max: 3 })
    maxJumpCount: number = 2;

    @property({ displayName: '重力' })
    gravity: number = 1600;

    @property({ displayName: '下落重力倍率' })
    fallGravityScale: number = 2.2;

    @property({ displayName: '土狼時間（秒）' })
    coyoteTime: number = 0.12;

    @property({ displayName: '跳躍緩衝（秒）' })
    jumpBufferTime: number = 0.1;

    @property({ displayName: '閃躲距離' })
    dodgeDistance: number = 180;

    @property({ displayName: '閃躲時間（秒）' })
    dodgeDuration: number = 0.2;

    @property({ displayName: '閃躲冷卻（秒）' })
    dodgeCooldown: number = 1.0;

    @property({ displayName: '地板 Y 座標' })
    groundY: number = -200;

    @property(cc.Animation)
    anim: cc.Animation = null;

    // ── 公開唯讀 ──────────────────────────────
    get state()       { return this._state; }
    get isGrounded()  { return this._isGrounded; }
    get facingRight() { return this._facingRight; }

    // ── 內部狀態 ──────────────────────────────
    private _state: PlayerState = PlayerState.IDLE;
    private _keys: Set<number>  = new Set();

    private _vx             = 0;
    private _vy             = 0;
    private _isGrounded     = false;
    private _facingRight    = true;
    private _moveDir        = 0;

    private _jumpCount      = 0;
    private _coyoteTimer    = 0;
    private _jumpBufferTimer = 0;

    private _isDodging          = false;
    private _dodgeCooldownTimer = 0;

    private _lastKeyTime: Map<number, number> = new Map();
    private readonly DOUBLE_TAP_MS = 300;

    // ──────────────────────────────────────────
    onLoad() {
        if (!this.anim) this.anim = this.getComponent(cc.Animation);

        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this._onKeyDown, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_UP,   this._onKeyUp,   this);

        cc.game.canvas.addEventListener('mousedown', (e: MouseEvent) => {
            if (e.button === 0) this._jumpBufferTimer = this.jumpBufferTime;
        });
    }

    onDestroy() {
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this._onKeyDown, this);
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_UP,   this._onKeyUp,   this);
    }

    update(dt: number) {
        this._dodgeCooldownTimer = Math.max(0, this._dodgeCooldownTimer - dt);
        this._jumpBufferTimer    = Math.max(0, this._jumpBufferTimer    - dt);
        if (!this._isGrounded)   this._coyoteTimer = Math.max(0, this._coyoteTimer - dt);

        if (!this._isDodging) {
            this._handleMove(dt);
            this._handleJump();
        }

        this._handleGravity(dt);
        this._applyPosition(dt);
        this._refreshState();
        this._playAnim();
        this._updateFacing();
    }

    // ──────────────────────────────────────────
    //  輸入
    // ──────────────────────────────────────────
    private _onKeyDown(e: cc.Event.EventKeyboard) {
        const key = e.keyCode;
        this._keys.add(key);

        if (key === cc.macro.KEY.space) {
            this._jumpBufferTimer = this.jumpBufferTime;
        }

        // 雙擊偵測 → 閃躲
        const now = Date.now();
        if (key === cc.macro.KEY.a    || key === cc.macro.KEY.left ||
            key === cc.macro.KEY.d    || key === cc.macro.KEY.right) {
            const last = this._lastKeyTime.get(key) ?? 0;
            if (now - last < this.DOUBLE_TAP_MS) {
                const dir = (key === cc.macro.KEY.d || key === cc.macro.KEY.right) ? 1 : -1;
                this._startDodge(dir);
            }
            this._lastKeyTime.set(key, now);
        }
    }

    private _onKeyUp(e: cc.Event.EventKeyboard) {
        this._keys.delete(e.keyCode);
    }

    // ──────────────────────────────────────────
    //  移動
    // ──────────────────────────────────────────
    private _handleMove(dt: number) {
        const left   = this._keys.has(cc.macro.KEY.a)     || this._keys.has(cc.macro.KEY.left);
        const right  = this._keys.has(cc.macro.KEY.d)     || this._keys.has(cc.macro.KEY.right);
        const sprint = this._keys.has(cc.macro.KEY.shift);

        this._moveDir = right ? 1 : left ? -1 : 0;
        const speed   = sprint ? this.runSpeed : this.walkSpeed;
        this._vx      = this._moveDir * speed;
    }

    // ──────────────────────────────────────────
    //  跳躍
    // ──────────────────────────────────────────
    private _handleJump() {
        if (this._jumpBufferTimer <= 0) return;

        const canFirst  = (this._isGrounded || this._coyoteTimer > 0) && this._jumpCount === 0;
        const canDouble = !this._isGrounded && this._jumpCount > 0 && this._jumpCount < this.maxJumpCount;

        if (canFirst || canDouble) {
            this._vy              = this.jumpForce;
            this._jumpCount++;
            this._coyoteTimer     = 0;
            this._jumpBufferTimer = 0;
            this._isGrounded      = false;
        }
    }

    // ──────────────────────────────────────────
    //  重力
    // ──────────────────────────────────────────
    private _handleGravity(dt: number) {
        if (this._isGrounded) return;
        const g = this._vy < 0
            ? this.gravity * this.fallGravityScale
            : this.gravity;
        this._vy -= g * dt;
    }

    // ──────────────────────────────────────────
    //  套用座標
    // ──────────────────────────────────────────
    private _applyPosition(dt: number) {
        this.node.x += this._vx * dt;
        this.node.y += this._vy * dt;

        // 落地偵測（以 groundY 為地板）
        if (this.node.y <= this.groundY) {
            this.node.y      = this.groundY;
            this._vy         = 0;
            this._isGrounded = true;
            this._jumpCount  = 0;
            this._coyoteTimer = this.coyoteTime;
        }
    }

    // ──────────────────────────────────────────
    //  閃躲
    // ──────────────────────────────────────────
    private _startDodge(dir: number) {
        if (this._isDodging || this._dodgeCooldownTimer > 0) return;

        this._isDodging         = true;
        this._dodgeCooldownTimer = this.dodgeCooldown;
        this._vx                = 0;
        this._setState(PlayerState.DODGE);
        this._playAnim();

        cc.tween(this.node)
            .by(this.dodgeDuration, { x: dir * this.dodgeDistance }, { easing: 'sineOut' })
            .call(() => {
                this._isDodging = false;
                this._refreshState();
            })
            .start();
    }

    // ──────────────────────────────────────────
    //  State & Anim
    // ──────────────────────────────────────────
    private _refreshState() {
        if (this._isDodging) return;

        let next: PlayerState;
        if      (this._vy > 50)        next = PlayerState.JUMP;
        else if (this._vy < -50)       next = PlayerState.FALL;
        else if (this._moveDir !== 0) {
            next = this._keys.has(cc.macro.KEY.shift) ? PlayerState.RUN : PlayerState.MOVE;
        } else {
            next = PlayerState.IDLE;
        }
        this._setState(next);
    }

    private _setState(s: PlayerState) {
        if (this._state === s) return;
        this._state = s;
    }

    private _playAnim() {
        if (!this.anim) return;
        if (this.anim.getClips().some(c => c.name === this._state)) {
            this.anim.play(this._state);
        }
    }

    private _updateFacing() {
        if      (this._moveDir > 0) { this._facingRight = true;  this.node.scaleX =  Math.abs(this.node.scaleX); }
        else if (this._moveDir < 0) { this._facingRight = false; this.node.scaleX = -Math.abs(this.node.scaleX); }
    }
}
