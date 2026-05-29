// LIN's Player — first-principles design.
//
// 詳細設計思路與決策紀錄請看 LIN/player_design.md
//
// 目前單檔。已用「── SECTION ──」標好未來拆分元件的邊界：
//   SECTION 2 → 未來抽到 PlayerInput.ts
//   SECTION 3 → 未來抽到 PlayerMovement.ts
//   SECTION 5 → 未來抽到 PlayerStateMachine.ts（如果狀態變多）

const { ccclass, property } = cc._decorator;

export enum PlayerState {
    IDLE = 'idle',
    WALK = 'walk',
    JUMP = 'jump',
    FALL = 'fall',
}

@ccclass
export default class Player extends cc.Component {

    // ── @property 區（資料驅動） ──────────────────
    @property({ displayName: '最大走路速度 (px/s)' })
    maxWalkSpeed: number = 240;

    @property({ displayName: '加速度 (px/s²)' })
    acceleration: number = 1800;

    @property({ displayName: '減速度 (px/s²)' })
    deceleration: number = 1400;

    @property({ displayName: '跳躍初速 (px/s)' })
    jumpVelocity: number = 620;

    @property({ displayName: '重力 (px/s²)' })
    gravity: number = 1800;

    @property({ displayName: '下落重力倍率（手感）' })
    fallGravityMul: number = 1.6;

    @property({ displayName: '土狼時間 (s) — 離地後仍可跳' })
    coyoteTime: number = 0.1;

    @property({ displayName: '跳躍緩衝 (s) — 落地前按跳會記住' })
    jumpBuffer: number = 0.1;

    @property({ displayName: '允許雙跳' })
    enableDoubleJump: boolean = true;

    @property({ displayName: '暫用地板 Y (Phase 2 改 box2d)' })
    tempGroundY: number = -200;

    // ── 公開唯讀 API ──────────────────────────────
    get state(): PlayerState { return this._state; }
    get facingRight(): boolean { return this._facingRight; }
    get velocity(): cc.Vec2 { return cc.v2(this._vx, this._vy); }
    get isGrounded(): boolean { return this._isGrounded; }

    // ── 內部狀態 ──────────────────────────────────
    private _state: PlayerState = PlayerState.IDLE;
    private _vx = 0;
    private _vy = 0;
    private _moveDir = 0;
    private _isGrounded = false;
    private _wasGrounded = false;
    private _facingRight = true;
    private _jumpsUsed = 0;
    private _coyoteTimer = 0;
    private _jumpBufferTimer = 0;
    private _keys: Set<number> = new Set();

    // ──────────────────────────────────────────────
    //  SECTION 1：Lifecycle
    // ──────────────────────────────────────────────
    onLoad() {
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this._onKeyDown, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_UP, this._onKeyUp, this);
    }

    onDestroy() {
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this._onKeyDown, this);
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_UP, this._onKeyUp, this);
    }

    update(dt: number) {
        this._tickTimers(dt);
        this._readMoveDir();
        this._integrateHorizontal(dt);
        this._integrateVertical(dt);
        this._tryConsumeJumpBuffer();
        this._applyPosition(dt);
        this._resolveGroundAndEmitLanding();
        this._updateFacing();
        this._refreshState();
    }

    // ──────────────────────────────────────────────
    //  SECTION 2：Input — 將來抽到 PlayerInput.ts
    //  邊界：只負責讀按鍵狀態，產出 _moveDir + _jumpBufferTimer
    // ──────────────────────────────────────────────
    private _onKeyDown(e: cc.Event.EventKeyboard) {
        this._keys.add(e.keyCode);
        if (this._isJumpKey(e.keyCode)) {
            this._jumpBufferTimer = this.jumpBuffer;
        }
    }

    private _onKeyUp(e: cc.Event.EventKeyboard) {
        this._keys.delete(e.keyCode);
    }

    private _isJumpKey(k: number): boolean {
        return k === cc.macro.KEY.space || k === cc.macro.KEY.w || k === cc.macro.KEY.up;
    }

    private _readMoveDir() {
        const left = this._keys.has(cc.macro.KEY.a) || this._keys.has(cc.macro.KEY.left);
        const right = this._keys.has(cc.macro.KEY.d) || this._keys.has(cc.macro.KEY.right);
        this._moveDir = right ? 1 : left ? -1 : 0;
    }

    // ──────────────────────────────────────────────
    //  SECTION 3：Movement — 將來抽到 PlayerMovement.ts
    //  邊界：吃 _moveDir + _jumpBufferTimer + 物理常數，
    //         寫 _vx / _vy / _isGrounded / node 位置。
    // ──────────────────────────────────────────────
    private _tickTimers(dt: number) {
        this._coyoteTimer = Math.max(0, this._coyoteTimer - dt);
        this._jumpBufferTimer = Math.max(0, this._jumpBufferTimer - dt);
    }

    private _integrateHorizontal(dt: number) {
        const target = this._moveDir * this.maxWalkSpeed;
        const rate = this._moveDir !== 0 ? this.acceleration : this.deceleration;
        this._vx = this._approach(this._vx, target, rate * dt);
    }

    private _integrateVertical(dt: number) {
        if (this._isGrounded && this._vy <= 0) {
            this._vy = 0;
            return;
        }
        const mul = this._vy < 0 ? this.fallGravityMul : 1;
        this._vy -= this.gravity * mul * dt;
    }

    private _tryConsumeJumpBuffer() {
        if (this._jumpBufferTimer <= 0) return;

        const canGroundJump = this._isGrounded || this._coyoteTimer > 0;
        const canDoubleJump = !canGroundJump && this.enableDoubleJump && this._jumpsUsed < 2;

        if (canGroundJump) {
            this._vy = this.jumpVelocity;
            this._isGrounded = false;
            this._jumpsUsed = 1;
            this._coyoteTimer = 0;
            this._jumpBufferTimer = 0;
            this.node.emit('jumped', { double: false });
        } else if (canDoubleJump) {
            this._vy = this.jumpVelocity;
            this._jumpsUsed = 2;
            this._jumpBufferTimer = 0;
            this.node.emit('jumped', { double: true });
        }
    }

    private _applyPosition(dt: number) {
        this.node.x += this._vx * dt;
        this.node.y += this._vy * dt;
    }

    private _resolveGroundAndEmitLanding() {
        // TODO Phase 2: 改 onBeginContact + 法線 y 方向判定
        this._wasGrounded = this._isGrounded;

        if (this.node.y <= this.tempGroundY) {
            this.node.y = this.tempGroundY;
            this._isGrounded = true;
            if (!this._wasGrounded) {
                this._jumpsUsed = 0;
                this._coyoteTimer = this.coyoteTime;
                this.node.emit('landed');
            }
        } else {
            if (this._wasGrounded) {
                this._isGrounded = false;
                this._coyoteTimer = this.coyoteTime;
            }
        }
    }

    // ──────────────────────────────────────────────
    //  SECTION 4：Facing — 用 velocity 判斷比較自然
    // ──────────────────────────────────────────────
    private _updateFacing() {
        if (Math.abs(this._vx) < 5) return;
        const shouldFaceRight = this._vx > 0;
        if (shouldFaceRight === this._facingRight) return;
        this._facingRight = shouldFaceRight;
        this.node.scaleX = shouldFaceRight ? Math.abs(this.node.scaleX) : -Math.abs(this.node.scaleX);
        this.node.emit('facing-changed', shouldFaceRight);
    }

    // ──────────────────────────────────────────────
    //  SECTION 5：State machine — 將來可抽 PlayerStateMachine.ts
    // ──────────────────────────────────────────────
    private _refreshState() {
        let next: PlayerState;
        if (!this._isGrounded) {
            next = this._vy > 0 ? PlayerState.JUMP : PlayerState.FALL;
        } else {
            next = Math.abs(this._vx) > 5 ? PlayerState.WALK : PlayerState.IDLE;
        }
        if (next === this._state) return;
        const prev = this._state;
        this._state = next;
        this.node.emit('state-changed', { from: prev, to: next });
    }

    // ──────────────────────────────────────────────
    //  SECTION 6：Utils
    // ──────────────────────────────────────────────
    private _approach(current: number, target: number, step: number): number {
        if (current < target) return Math.min(current + step, target);
        if (current > target) return Math.max(current - step, target);
        return current;
    }
}
