// LIN's Player — box2d 物理版（Phase 3：PlayerInput 已抽出）
//
// 詳細設計請看 LIN/player_design.md
// 設定步驟請看 LIN/collision_setup.md
//
// 依賴：
//   - 節點上必須有 cc.RigidBody（@requireComponent 已保證）+ cc.PhysicsBoxCollider
//   - 同節點建議掛 PlayerInput（負責發 input:* event）；若無，Player 不會自己讀鍵盤，
//     方便之後換成 AI 或觸控 — 只要發相同 event 即可。
//
// 世界重力由 cc.director.getPhysicsManager().gravity 統一管，Player 不再自管重力。
//
// SECTION 標記為未來抽元件的邊界（PlayerMovement、PlayerStateMachine）。

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

    @property({ displayName: '下落重力倍率（手感）', tooltip: '1=上升下降對稱；>1 下落較快；<1 下落較慢/飄' })
    fallGravityMul: number = 1.1;

    @property({ displayName: '土狼時間 (s) — 離地後仍可跳' })
    coyoteTime: number = 0.1;

    @property({ displayName: '跳躍緩衝 (s) — 落地前按跳會記住' })
    jumpBuffer: number = 0.1;

    @property({ displayName: '允許雙跳' })
    enableDoubleJump: boolean = true;

    @property({ displayName: '垂直接觸法線門檻', tooltip: '|normal.y| 大於此值才算垂直接觸（用接觸點位置區分地面 / 天花板）' })
    groundNormalThreshold: number = 0.5;

    @property({ displayName: 'Debug：畫物理形狀', tooltip: '臨時除錯用，看完關掉。會畫「全部」collider；只想看單一 hitbox 請改用該節點上的 HitBoxDebugDraw 元件' })
    debugDrawPhysics: boolean = false;

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
    /** 目前接觸中的 collider → 是否為「腳下接觸」（地面） */
    private _contacts: Map<cc.PhysicsCollider, boolean> = new Map();
    private _isGrounded = false;
    private _wasGrounded = false;

    // ──────────────────────────────────────────────
    //  SECTION 1：Lifecycle
    // ──────────────────────────────────────────────
    onLoad() {
        const pm = cc.director.getPhysicsManager();
        pm.enabled = true;
        pm.gravity = cc.v2(0, -1800);
        if (this.debugDrawPhysics) {
            const D = cc.PhysicsManager.DrawBits;
            pm.debugDrawFlags = D.e_shapeBit | D.e_aabbBit;
        }

        this._rb = this.getComponent(cc.RigidBody);
        this._rb.fixedRotation = true;
        this._rb.enabledContactListener = true;  // 不開的話 onBeginContact 不會觸發

        // 訂閱 PlayerInput 在同節點上發的事件。沒掛 PlayerInput 也不會錯，只是不會動。
        this.node.on('input:move', this._onInputMove, this);
        this.node.on('input:jump-down', this._onInputJump, this);
        // 面向由 WeaponAim 決定（跟著滑鼠），Player 只是被動接收同步內部狀態
        this.node.on('facing-changed', this._onFacingChanged, this);
    }

    onDestroy() {
        this.node.off('input:move', this._onInputMove, this);
        this.node.off('input:jump-down', this._onInputJump, this);
        this.node.off('facing-changed', this._onFacingChanged, this);
    }

    update(dt: number) {
        this._tickTimers(dt);
        this._refreshGrounded();
        this._applyHorizontalVelocity(dt);
        this._tryConsumeJumpBuffer();   // 先處理跳躍把 v.y 變正
        this._adjustFallGravity();      // 再依新 v.y 決定 gravityScale，跳起來那一幀就不會被舊的下落重力刮
        this._refreshState();
    }

    // ──────────────────────────────────────────────
    //  SECTION 2：Input event handlers
    //  鍵盤翻譯邏輯已移到 PlayerInput.ts，這裡只接 event。
    // ──────────────────────────────────────────────
    private _onInputMove(e: { dir: number }) {
        this._moveDir = e.dir;
    }

    private _onInputJump() {
        this._jumpBufferTimer = this.jumpBuffer;
    }

    /** WeaponAim 依滑鼠位置決定面向；Player 同步內部狀態，讓 facingRight getter 仍可用 */
    private _onFacingChanged(faceRight: boolean) {
        this._facingRight = faceRight;
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
        let grounded = false;
        this._contacts.forEach((isGround) => { if (isGround) grounded = true; });
        this._isGrounded = grounded;

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
    //  Box2d contact callbacks（落地判定）
    //  之前只看 normal.y 不夠穩 — A/B 順序會讓正負號翻轉。
    //  改成「法線夠垂直 + 接觸點在 player 下方」雙重確認。
    // ──────────────────────────────────────────────
    onBeginContact(contact: cc.PhysicsContact, _self: cc.PhysicsCollider, other: cc.PhysicsCollider) {
        this._contacts.set(other, this._isGroundContact(contact));
    }

    onEndContact(_contact: cc.PhysicsContact, _self: cc.PhysicsCollider, other: cc.PhysicsCollider) {
        this._contacts.delete(other);
    }

    private _isGroundContact(contact: cc.PhysicsContact): boolean {
        const wm = contact.getWorldManifold();
        if (Math.abs(wm.normal.y) < this.groundNormalThreshold) return false;  // 側撞牆
        if (!wm.points || wm.points.length === 0) return false;

        const myWorld = this.node.parent
            ? this.node.parent.convertToWorldSpaceAR(this.node.position)
            : cc.v2(this.node.x, this.node.y);
        let sumY = 0;
        for (let i = 0; i < wm.points.length; i++) sumY += wm.points[i].y;
        const avgY = sumY / wm.points.length;
        return avgY < myWorld.y;  // 接觸點在自己下方 = 地面
    }

    // ──────────────────────────────────────────────
    //  SECTION 4：Facing
    //  改用滑鼠瞄準後，面向由 WeaponAim 決定並 emit 'facing-changed'。
    //  Player.ts 不再用速度判面向，只在 _onFacingChanged 同步內部狀態給 facingRight getter。
    // ──────────────────────────────────────────────

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
