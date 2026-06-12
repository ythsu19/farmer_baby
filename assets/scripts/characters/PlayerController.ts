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

    @property({
        type: [cc.Node],
        displayName: '單向平台節點（掛 Platform.ts）',
        tooltip: '可從上面踩的平台。把掛了 Platform.ts 的節點拖進來；留空 → 自動抓場景裡所有 Platform。'
    })
    platforms: cc.Node[] = [];

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

    /** 平台元件快取（避免每幀 getComponent） */
    private _platformList: any[] = [];

    // ──────────────────────────────────────────
    onLoad() {
        if (!this.anim) this.anim = this.getComponent(cc.Animation);
        this._hp = this.maxHp;

        this._collectPlatforms();

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

    /** 收集場上的 Platform 元件：Inspector 有拖就用拖的，沒拖就自動抓整個場景的 Platform */
    private _collectPlatforms() {
        this._platformList = [];
        if (this.platforms && this.platforms.length > 0) {
            for (const n of this.platforms) {
                if (!n) continue;
                const p = n.getComponent('Platform');
                if (p) this._platformList.push(p);
            }
            return;
        }
        // 沒拖 → 自動抓整個場景（不用 cc.find，符合專案規範）
        const scene = cc.director.getScene();
        if (scene) this._platformList = scene.getComponentsInChildren('Platform');
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

        this._checkLeftSupport();   // 站在平台上但走出邊緣 → 解除 grounded 讓重力接管
        this._handleGravity(dt);
        this._applyPosition(dt);
        this._refreshState();
        this._updateFacing();
    }

    /**
     * 若目前 grounded，檢查腳下是否還有支撐（地面線或某塊平台）。
     * 走出平台邊緣 → 解除 grounded，開始進入 coyote time 後下落。
     */
    private _checkLeftSupport() {
        if (!this._isGrounded) return;
        // 站在最底地面線上 → 永遠有支撐
        if (this.node.y <= this.groundY + 1) return;
        // 否則必須站在某塊平台頂面上（x 在範圍內、y 貼著頂面）
        for (const p of this._platformList) {
            if (!p || !p.node || !p.node.isValid) continue;
            if (p.isXInRange(this.node.x) && Math.abs(this.node.y - p.getTopWorldY()) <= 2) {
                return;   // 還站在這塊平台上
            }
        }
        // 沒有任何支撐 → 離開地面（保留 coyote time，手感才不會突兀）
        this._isGrounded  = false;
        this._coyoteTimer = this.coyoteTime;
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
        const prevY = this.node.y;          // 移動前的 Y（單向平台要靠它判斷「是否穿越頂面」）
        this.node.x += this._vx * dt;
        this.node.y += this._vy * dt;

        // 1) 先看單向平台：只有「正在下落」且「這一幀從平台頂面上方掉到下方」才踩上去。
        //    從下往上跳（_vy > 0）一律不擋 → 可穿過平台底部。
        const landY = this._checkPlatformLanding(prevY);
        if (landY !== null) {
            this.node.y       = landY;
            this._vy          = 0;
            this._isGrounded  = true;
            this._jumpCount   = 0;
            this._coyoteTimer = this.coyoteTime;
            return;
        }

        // 2) 再看地面線（最底層的地板，永遠擋）
        if (this.node.y <= this.groundY) {
            this.node.y       = this.groundY;
            this._vy          = 0;
            this._isGrounded  = true;
            this._jumpCount   = 0;
            this._coyoteTimer = this.coyoteTime;
        }
    }

    /**
     * 單向平台落地判定。回傳要停的 Y；沒踩到任何平台回傳 null。
     * 條件：玩家正在下落（_vy <= 0）、x 在平台範圍內、且這一幀從平台頂面「上方」掉到「下方或剛好」。
     * @param prevY 這一幀移動前的玩家 Y
     */
    private _checkPlatformLanding(prevY: number): number | null {
        if (this._vy > 0) return null;          // 往上跳：不擋，可穿過
        const curY = this.node.y;
        let best: number | null = null;
        for (const p of this._platformList) {
            if (!p || !p.node || !p.node.isValid) continue;
            if (!p.isXInRange(this.node.x)) continue;
            const top = p.getTopWorldY();
            // 移動前在頂面上方（含相等容差），移動後到了頂面或更低 → 這一幀穿越頂面 → 踩上
            if (prevY >= top - 1 && curY <= top) {
                // 多個平台都符合時，取最高的那個（先落在最上層）
                if (best === null || top > best) best = top;
            }
        }
        return best;
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
