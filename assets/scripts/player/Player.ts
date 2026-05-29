// LIN's Player — box2d 物理版（Phase 2）
//
// 詳細設計請看 LIN/player_design.md
// 設定步驟請看 LIN/collision_setup.md
//
// 依賴：節點上必須有 cc.RigidBody（@requireComponent 已保證）+ cc.PhysicsBoxCollider。
// 世界重力由 cc.director.getPhysicsManager().gravity 統一管，Player 不再自管重力。
//
// SECTION 標記為未來抽元件的邊界（PlayerInput、PlayerMovement、PlayerStateMachine）。

const { ccclass, property, requireComponent } = cc._decorator;

export enum PlayerState {
    IDLE = 'idle',
    WALK = 'walk',
    JUMP = 'jump',
    FALL = 'fall',
}

@ccclass
@requireComponent(cc.RigidBody)
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

    @property({ displayName: '下落重力倍率（手感）' })
    fallGravityMul: number = 1.6;

    @property({ displayName: '土狼時間 (s) — 離地後仍可跳' })
    coyoteTime: number = 0.1;

    @property({ displayName: '跳躍緩衝 (s) — 落地前按跳會記住' })
    jumpBuffer: number = 0.1;

    @property({ displayName: '允許雙跳' })
    enableDoubleJump: boolean = true;

    @property({ displayName: '落地法線 y 門檻', tooltip: '低於此值才算「在地上」（避免側撞被判定成落地）' })
    groundNormalThreshold: number = -0.5;

    // ── 公開唯讀 API ──────────────────────────────
    get state(): PlayerState { return this._state; }
    get facingRight(): boolean { return this._facingRight; }
    get velocity(): cc.Vec2 { return this._rb ? this._rb.linearVelocity : cc.v2(); }
    get isGrounded(): boolean { return this._isGrounded; }

    // ── 內部狀態 ──────────────────────────────────
    private _rb: cc.RigidBody = null;
    private _state: PlayerState = PlayerState.IDLE;
    private _moveDir = 0;
    private _facingRight = true;
    private _jumpsUsed = 0;
    private _coyoteTimer = 0;
    private _jumpBufferTimer = 0;
    private _keys: Set<number> = new Set();
    /** 目前接觸中的 collider → 接觸瞬間的法線 y */
    private _contacts: Map<cc.PhysicsCollider, number> = new Map();
    private _isGrounded = false;
    private _wasGrounded = false;

    // ──────────────────────────────────────────────
    //  SECTION 1：Lifecycle
    // ──────────────────────────────────────────────
    onLoad() {
        this._rb = this.getComponent(cc.RigidBody);
        this._rb.fixedRotation = true;
        this._rb.enabledContactListener = true;  // 不開的話 onBeginContact 不會觸發

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
        this._refreshGrounded();
        this._applyHorizontalVelocity(dt);
        this._adjustFallGravity();
        this._tryConsumeJumpBuffer();
        this._updateFacing();
        this._refreshState();
    }

    // ──────────────────────────────────────────────
    //  SECTION 2：Input — 將來抽 PlayerInput.ts
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
    //  SECTION 3：Movement (box2d) — 將來抽 PlayerMovement.ts
    // ──────────────────────────────────────────────
    private _tickTimers(dt: number) {
        this._coyoteTimer = Math.max(0, this._coyoteTimer - dt);
        this._jumpBufferTimer = Math.max(0, this._jumpBufferTimer - dt);
    }

    private _refreshGrounded() {
        this._wasGrounded = this._isGrounded;
        this._isGrounded = false;
        for (const ny of this._contacts.values()) {
            if (ny < this.groundNormalThreshold) { this._isGrounded = true; break; }
        }

        if (!this._wasGrounded && this._isGrounded) {
            this._jumpsUsed = 0;
            this._coyoteTimer = this.coyoteTime;
            this.node.emit('landed');
        } else if (this._wasGrounded && !this._isGrounded) {
            this._coyoteTimer = this.coyoteTime;
        }
    }

    private _applyHorizontalVelocity(dt: number) {
        const v = this._rb.linearVelocity;
        const target = this._moveDir * this.maxWalkSpeed;
        const rate = this._moveDir !== 0 ? this.acceleration : this.deceleration;
        v.x = this._approach(v.x, target, rate * dt);
        this._rb.linearVelocity = v;
    }

    private _adjustFallGravity() {
        this._rb.gravityScale = this._rb.linearVelocity.y < 0 ? this.fallGravityMul : 1;
    }

    private _tryConsumeJumpBuffer() {
        if (this._jumpBufferTimer <= 0) return;

        const canGroundJump = this._isGrounded || this._coyoteTimer > 0;
        const canDoubleJump = !canGroundJump && this.enableDoubleJump && this._jumpsUsed < 2;

        if (canGroundJump) {
            const v = this._rb.linearVelocity; v.y = this.jumpVelocity; this._rb.linearVelocity = v;
            this._jumpsUsed = 1;
            this._coyoteTimer = 0;
            this._jumpBufferTimer = 0;
            this.node.emit('jumped', { double: false });
        } else if (canDoubleJump) {
            const v = this._rb.linearVelocity; v.y = this.jumpVelocity; this._rb.linearVelocity = v;
            this._jumpsUsed = 2;
            this._jumpBufferTimer = 0;
            this.node.emit('jumped', { double: true });
        }
    }

    // ──────────────────────────────────────────────
    //  Box2d contact callbacks（落地判定用）
    //  Cocos 慣例：normal 從 selfCollider 指向 otherCollider
    //  →  normal.y < 0 ⇒ other 在 self 下方 ⇒ self 站在 other 上
    // ──────────────────────────────────────────────
    onBeginContact(contact: cc.PhysicsContact, _self: cc.PhysicsCollider, other: cc.PhysicsCollider) {
        const normal = contact.getWorldManifold().normal;
        this._contacts.set(other, normal.y);
    }

    onEndContact(_contact: cc.PhysicsContact, _self: cc.PhysicsCollider, other: cc.PhysicsCollider) {
        this._contacts.delete(other);
    }

    // ──────────────────────────────────────────────
    //  SECTION 4：Facing
    // ──────────────────────────────────────────────
    private _updateFacing() {
        const vx = this._rb.linearVelocity.x;
        if (Math.abs(vx) < 5) return;
        const shouldFaceRight = vx > 0;
        if (shouldFaceRight === this._facingRight) return;
        this._facingRight = shouldFaceRight;
        this.node.scaleX = shouldFaceRight ? Math.abs(this.node.scaleX) : -Math.abs(this.node.scaleX);
        this.node.emit('facing-changed', shouldFaceRight);
    }

    // ──────────────────────────────────────────────
    //  SECTION 5：State machine — 將來可抽 PlayerStateMachine.ts
    // ──────────────────────────────────────────────
    private _refreshState() {
        const v = this._rb.linearVelocity;
        let next: PlayerState;
        if (!this._isGrounded) {
            next = v.y > 0 ? PlayerState.JUMP : PlayerState.FALL;
        } else {
            next = Math.abs(v.x) > 5 ? PlayerState.WALK : PlayerState.IDLE;
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
