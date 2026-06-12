// PlayerDash — P1 / P2 共用的衝刺元件
//
// 行為：
//   收 'input:dash-down' → 朝目前移動方向衝一小段；沒在移動就朝目前面向
//   衝刺中：水平 = dashSpeed × dir、垂直 = 0、gravity 暫時關掉 → 平直短衝
//   衝刺中每隔 ghostInterval 秒 spawn 一張半透明 ghost sprite → 殘影模糊感
//
// 跟 Player.ts 的搭配：
//   發 'dash:start' / 'dash:end' → Player.ts 看 _isDashing 跳過自己的水平加速 / 重力 / 跳躍
//   不然 Player.update 跟 PlayerDash.update 會搶 linearVelocity 寫入，
//   依 component update 順序輸出不穩。
//
// 為什麼 ghost 不用 shader / 不複製動畫？
//   專案沒材質系統 + 殘影只活 0.25s 看不出單格 vs 動畫差異 —
//   每張 ghost 直接抓「當下這一格 spriteFrame」就夠了。
//
// 依賴：
//   - 同節點上要有 cc.RigidBody（Player.ts @requireComponent 已保證）
//   - 殘影來源 cc.Sprite：預設找同節點；視覺掛在子節點時請拖該子節點的 cc.Sprite
//   - PlayerInput / Player2Input 發 'input:dash-down'
//   - Player.ts 發 'input:move' / 'facing-changed' 讓 dash 知道方向

const { ccclass, property } = cc._decorator;

@ccclass
export default class PlayerDash extends cc.Component {

    @property({ displayName: '衝刺速度 (px/s)' })
    dashSpeed: number = 900;

    @property({ displayName: '衝刺時長 (s)' })
    dashDuration: number = 0.18;

    @property({ displayName: '冷卻 (s)', tooltip: '從 dash 開始算' })
    cooldown: number = 0.6;

    @property({ displayName: '殘影間隔 (s)', tooltip: '越小殘影越密；0.02–0.04 拍起來最像模糊' })
    ghostInterval: number = 0.025;

    @property({ displayName: '殘影存活 (s)', tooltip: '單張 ghost 從生到消失的時間' })
    ghostLifetime: number = 0.25;

    @property({ displayName: '殘影初始不透明度 (0–255)' })
    ghostStartOpacity: number = 160;

    @property({ displayName: '殘影色調', type: cc.Color, tooltip: '殘影 sprite 會染這個顏色；白色 = 不染' })
    ghostTint: cc.Color = cc.color(140, 200, 255);

    @property({ displayName: '殘影 Sprite 來源', type: cc.Sprite, tooltip: '空 = 用同節點的 cc.Sprite；視覺在子節點時拖那顆過來' })
    ghostSpriteSource: cc.Sprite = null;

    // ── 公開唯讀 ──
    get isDashing(): boolean { return this._isDashing; }

    // ── 內部狀態 ──
    private _rb: cc.RigidBody = null;
    private _sprite: cc.Sprite = null;
    private _cooldownTimer = 0;
    private _dashTimer = 0;
    private _ghostTimer = 0;
    private _isDashing = false;
    private _dashDir: 1 | -1 = 1;
    private _savedGravityScale = 1;

    // 從 input:move / facing-changed 同步進來的方向資訊
    private _moveDir = 0;
    private _facingRight = true;

    onLoad() {
        this._rb = this.getComponent(cc.RigidBody);
        this._sprite = this.ghostSpriteSource || this.getComponent(cc.Sprite);

        this.node.on('input:dash-down', this._onDash, this);
        this.node.on('input:move', this._onMove, this);
        this.node.on('facing-changed', this._onFacing, this);
    }

    onDestroy() {
        this.node.off('input:dash-down', this._onDash, this);
        this.node.off('input:move', this._onMove, this);
        this.node.off('facing-changed', this._onFacing, this);
    }

    private _onMove(e: { dir: number }) {
        this._moveDir = e.dir;
    }

    private _onFacing(faceRight: boolean) {
        this._facingRight = faceRight;
    }

    private _onDash() {
        if (this._isDashing) return;
        if (this._cooldownTimer > 0) return;
        if (!this._rb) return;

        // 方向：優先目前移動方向；沒在動就朝目前面向
        const dir: 1 | -1 = this._moveDir !== 0
            ? (this._moveDir > 0 ? 1 : -1)
            : (this._facingRight ? 1 : -1);

        this._dashDir = dir;
        this._isDashing = true;
        this._dashTimer = this.dashDuration;
        this._cooldownTimer = this.cooldown;   // 從 dash 開始算冷卻
        this._ghostTimer = 0;

        // 暫存 gravityScale，dash 結束還原 —
        // Player.ts 的 _adjustFallGravity 會在下一幀重設，但這裡先把當下 dash 期間關掉
        this._savedGravityScale = this._rb.gravityScale;
        this._rb.gravityScale = 0;

        // 立刻塞速度 — 第一幀就有衝出去的視覺
        this._rb.linearVelocity = cc.v2(dir * this.dashSpeed, 0);

        this.node.emit('dash:start', { dir });
    }

    update(dt: number) {
        if (this._cooldownTimer > 0) {
            this._cooldownTimer = Math.max(0, this._cooldownTimer - dt);
        }
        if (!this._isDashing) return;

        // 每幀重塞 — 保證跟 Player._applyHorizontalVelocity 順序無關，PlayerDash 都贏
        this._rb.linearVelocity = cc.v2(this._dashDir * this.dashSpeed, 0);

        this._ghostTimer -= dt;
        if (this._ghostTimer <= 0) {
            this._spawnGhost();
            this._ghostTimer = this.ghostInterval;
        }

        this._dashTimer -= dt;
        if (this._dashTimer <= 0) {
            this._endDash();
        }
    }

    private _endDash() {
        this._isDashing = false;
        if (this._rb) {
            this._rb.gravityScale = this._savedGravityScale;
            // 不清水平速度 — 讓 Player._applyHorizontalVelocity 的 deceleration 自己收尾，
            // 衝刺結束會有一小段「滑行」手感
        }
        this.node.emit('dash:end');
    }

    private _spawnGhost() {
        if (!this._sprite || !this._sprite.spriteFrame) return;
        if (!this.node.parent) return;

        const ghost = new cc.Node('DashGhost');
        ghost.parent = this.node.parent;
        ghost.setPosition(this.node.position);
        ghost.setAnchorPoint(this.node.getAnchorPoint());
        ghost.setScale(this.node.scaleX, this.node.scaleY);
        ghost.angle = this.node.angle;
        // 殘影壓在玩家後面 — 不擋主體
        ghost.zIndex = this.node.zIndex - 1;

        const g = ghost.addComponent(cc.Sprite);
        g.sizeMode = this._sprite.sizeMode;
        g.spriteFrame = this._sprite.spriteFrame;
        ghost.setContentSize(this.node.getContentSize());

        ghost.color = this.ghostTint;
        ghost.opacity = this.ghostStartOpacity;

        cc.tween(ghost)
            .to(this.ghostLifetime, { opacity: 0 })
            .call(() => { if (ghost.isValid) ghost.destroy(); })
            .start();
    }
}
