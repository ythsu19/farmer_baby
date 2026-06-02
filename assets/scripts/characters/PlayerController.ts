const { ccclass, property } = cc._decorator;

export enum PlayerState {
    IDLE  = 'idle',
    MOVE  = 'move',
    JUMP  = 'jump',
    FALL  = 'fall',
    DODGE = 'dodge',
    SHOOT = 'shoot',
    HURT  = 'hurt',
    DIE   = 'die',
}

@ccclass
export default class PlayerController extends cc.Component {

    @property({ displayName: '走路速度' })
    walkSpeed: number = 200;

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

    @property({ displayName: '最大血量' })
    maxHp: number = 100;

    @property({ displayName: '射擊冷卻（秒）' })
    shootCooldown: number = 0.5;

    @property({ displayName: '射擊動畫持續（秒）' })
    shootAnimDuration: number = 0.25;

    @property({ displayName: '無敵時間（秒）' })
    invincibleDuration: number = 1.0;

    @property({ displayName: '受傷動畫持續（秒）' })
    hurtAnimDuration: number = 0.35;

    @property(cc.Animation)
    anim: cc.Animation = null;

    // ── 公開唯讀 ──────────────────────────────
    get state()       { return this._state; }
    get isGrounded()  { return this._isGrounded; }
    get facingRight() { return this._facingRight; }
    get hp()          { return this._hp; }
    get isDead()      { return this._isDead; }

    // ── 內部狀態 ──────────────────────────────
    private _state: PlayerState = PlayerState.IDLE;
    private _keys: Set<number>  = new Set();

    private _vx              = 0;
    private _vy              = 0;
    private _isGrounded      = false;
    private _facingRight     = true;
    private _moveDir         = 0;

    private _jumpCount       = 0;
    private _coyoteTimer     = 0;
    private _jumpBufferTimer = 0;

    private _isDodging           = false;
    private _dodgeCooldownTimer  = 0;

    private _hp                 = 100;
    private _isDead             = false;
    private _isShooting         = false;
    private _shootCooldownTimer = 0;
    private _shootAnimTimer     = 0;
    private _isHurt             = false;
    private _invincibleTimer    = 0;

    private _mouseDownHandler: (e: MouseEvent) => void;

    // ──────────────────────────────────────────
    onLoad() {
        if (!this.anim) this.anim = this.getComponent(cc.Animation);
        this._hp = this.maxHp;

        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this._onKeyDown, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_UP,   this._onKeyUp,   this);

        this._mouseDownHandler = (e: MouseEvent) => {
            if (!this.isValid) return;
            if (e.button === 0) this._tryShoot();
        };
        cc.game.canvas.addEventListener('mousedown', this._mouseDownHandler);
    }

    onDestroy() {
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this._onKeyDown, this);
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_UP,   this._onKeyUp,   this);
        cc.game.canvas.removeEventListener('mousedown', this._mouseDownHandler);
    }

    update(dt: number) {
        if (this._isDead) return;

        this._dodgeCooldownTimer = Math.max(0, this._dodgeCooldownTimer - dt);
        this._jumpBufferTimer    = Math.max(0, this._jumpBufferTimer    - dt);
        this._shootCooldownTimer = Math.max(0, this._shootCooldownTimer - dt);
        if (!this._isGrounded)   this._coyoteTimer = Math.max(0, this._coyoteTimer - dt);

        if (this._invincibleTimer > 0) this._invincibleTimer = Math.max(0, this._invincibleTimer - dt);

        if (this._isShooting) {
            this._shootAnimTimer -= dt;
            if (this._shootAnimTimer <= 0) this._isShooting = false;
        }

        if (!this._isDodging && !this._isHurt) {
            this._handleMove(dt);
            this._handleJump();
        } else if (this._isHurt) {
            this._vx = 0;
        }

        this._handleGravity(dt);
        this._applyPosition(dt);
        this._refreshState();
        this._updateFacing();
    }

    // ──────────────────────────────────────────
    //  公開 API
    // ──────────────────────────────────────────
    takeDamage(amount: number) {
        if (this._isDead || this._invincibleTimer > 0) return;
        this._hp = Math.max(0, this._hp - amount);
        this.node.emit('hp-changed', this._hp);
        if (this._hp <= 0) this._triggerDie();
        else               this._triggerHurt();
    }

    // ──────────────────────────────────────────
    //  輸入
    // ──────────────────────────────────────────
    private _onKeyDown(e: cc.Event.EventKeyboard) {
        const key = e.keyCode;
        this._keys.add(key);

        if (key === cc.macro.KEY.space) this._jumpBufferTimer = this.jumpBufferTime;
        if (key === cc.macro.KEY.shift) {
            const dir = this._moveDir !== 0 ? this._moveDir : (this._facingRight ? 1 : -1);
            this._startDodge(dir);
        }
        if (key === cc.macro.KEY.z) this._tryShoot();
        if (key === cc.macro.KEY.q) this.node.emit('skill');
        if (key === 49)             this.node.emit('use-item', 1);
        if (key === 50)             this.node.emit('use-item', 2);
    }

    private _onKeyUp(e: cc.Event.EventKeyboard) {
        this._keys.delete(e.keyCode);
    }

    // ──────────────────────────────────────────
    //  移動
    // ──────────────────────────────────────────
    private _handleMove(dt: number) {
        const left  = this._keys.has(cc.macro.KEY.a) || this._keys.has(cc.macro.KEY.left);
        const right = this._keys.has(cc.macro.KEY.d) || this._keys.has(cc.macro.KEY.right);
        this._moveDir = right ? 1 : left ? -1 : 0;
        this._vx      = this._moveDir * this.walkSpeed;
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
        const fastFall = this._keys.has(cc.macro.KEY.s) || this._keys.has(cc.macro.KEY.down);
        const scale    = (this._vy < 0 || fastFall) ? this.fallGravityScale : 1;
        this._vy -= this.gravity * scale * dt;
    }

    // ──────────────────────────────────────────
    //  套用座標
    // ──────────────────────────────────────────
    private _applyPosition(dt: number) {
        this.node.x += this._vx * dt;
        this.node.y += this._vy * dt;

        if (this.node.y <= this.groundY) {
            this.node.y       = this.groundY;
            this._vy          = 0;
            this._isGrounded  = true;
            this._jumpCount   = 0;
            this._coyoteTimer = this.coyoteTime;
        }
    }

    // ──────────────────────────────────────────
    //  射擊
    // ──────────────────────────────────────────
    private _tryShoot() {
        if (this._isDead || this._isHurt || this._shootCooldownTimer > 0) return;
        this._isShooting         = true;
        this._shootCooldownTimer = this.shootCooldown;
        this._shootAnimTimer     = this.shootAnimDuration;
        this._setState(PlayerState.SHOOT);
        this.node.emit('shoot', { facingRight: this._facingRight });
    }

    // ──────────────────────────────────────────
    //  受傷 / 死亡
    // ──────────────────────────────────────────
    private _triggerHurt() {
        this._isHurt          = true;
        this._invincibleTimer = this.invincibleDuration;
        this._setState(PlayerState.HURT);
        this.scheduleOnce(() => {
            this._isHurt = false;
            this._refreshState();
        }, this.hurtAnimDuration);
    }

    private _triggerDie() {
        this._isDead = true;
        this._vx     = 0;
        this._vy     = 0;
        this._setState(PlayerState.DIE);
        this.node.emit('player-died');
    }

    // ──────────────────────────────────────────
    //  閃躲
    // ──────────────────────────────────────────
    private _startDodge(dir: number) {
        if (this._isDodging || this._dodgeCooldownTimer > 0) return;
        this._isDodging          = true;
        this._dodgeCooldownTimer = this.dodgeCooldown;
        this._vx                 = 0;
        this._setState(PlayerState.DODGE);
        cc.tween(this.node)
            .by(this.dodgeDuration, { x: dir * this.dodgeDistance }, { easing: 'sineOut' })
            .call(() => { this._isDodging = false; this._refreshState(); })
            .start();
    }

    // ──────────────────────────────────────────
    //  State & Anim
    // ──────────────────────────────────────────
    private _refreshState() {
        if (this._isDead || this._isHurt || this._isDodging) return;
        let next: PlayerState;
        if      (this._isShooting)  next = PlayerState.SHOOT;
        else if (this._vy > 50)     next = PlayerState.JUMP;
        else if (this._vy < -50)    next = PlayerState.FALL;
        else if (this._moveDir !== 0) next = PlayerState.MOVE;
        else                        next = PlayerState.IDLE;
        this._setState(next);
    }

    private _setState(s: PlayerState) {
        if (this._state === s) return;
        this._state = s;
        if (!this.anim) return;
        if (this.anim.getClips().some(c => c.name === this._state)) {
            this.anim.play(this._state);
        }
    }

    private _updateFacing() {
        if (this._isHurt || this._isDead) return;
        if      (this._moveDir > 0) { this._facingRight = true;  this.node.scaleX =  Math.abs(this.node.scaleX); }
        else if (this._moveDir < 0) { this._facingRight = false; this.node.scaleX = -Math.abs(this.node.scaleX); }
    }
}
