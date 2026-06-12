// Boss — 鐮刀 Boss 主元件（兩張圖：boss 本體含武器 + 帽子）
//
// farmer_baby 統一用 box2d（RigidBody + PhysicsBoxCollider），碰撞靠 onBeginContact。
//
// ── 圖片結構（只有兩張圖）──
//   boss 本體（含鐮刀武器）：一張 sprite，動作由 30+ 張逐幀圖用 BossAnimator 播放（非 cc.Animation）。
//   帽子：另一張 sprite，當作獨立受擊弱點。
//
// ── 節點結構（之後存成 prefab）──
//   boss                  ← 本元件、BossAnimator(逐幀貼圖)、cc.RigidBody(Kinematic)
//   ├─ body(Sprite)       ← boss 本體含武器的圖，逐幀動畫換它的 spriteFrame
//   ├─ hat(Sprite)        ← 帽子的圖（獨立弱點）
//   │   └─ 掛 BossHatWeakPoint.ts + PhysicsPolygonCollider(Sensor)，group=enemy
//   ├─ bodyHurtBox        ← 身體受擊箱：PhysicsPolygonCollider(Sensor)，group=enemy
//   │                         （掛 BossBodyHurtBox.ts，轉呼叫本元件 takeDamage）
//   └─ scytheHitBox1 / 2 / 3 ... ← 多個鐮刀攻擊箱，每個一種刀形：
//                             PhysicsPolygonCollider(Sensor)，各掛 ScytheHitBox.ts，預設 active=false。
//                             全部拖進本元件的 attackHitBoxes 陣列。
//
// ── 為什麼用「多個固定形狀的攻擊箱」而不是逐幀改 collider 形狀 ──
//   box2d 的 collider 的 points/size 不能被動畫逐幀驅動（動畫系統列不出這軌道，
//   物理引擎也不吃逐幀重建形狀）。所以揮砍不同階段刀形差很多時，
//   = 每個刀形做一個固定形狀的攻擊箱，動畫用 event「逐段切換開哪一個」。
//   每個攻擊箱的 node.position / scale / angle 仍可被動畫 keyframe（跟著刀移動/縮放/旋轉）。
//   切換方式：動畫 event 呼叫 enableHit，參數填要開的索引（0,1,2...）；收招幀 disableHit。
//
// ── 受擊分離（攻擊箱 vs 受擊箱）──
//   攻擊箱（scytheHitBox*）：boss 打玩家用，掛 ScytheHitBox.ts。
//   受擊箱（bodyHurtBox + hat）：玩家子彈打 boss 用，各自掛轉發元件呼叫本元件 takeDamage。
//   兩者是不同節點、不同 collider，互不干擾。

const { ccclass, property } = cc._decorator;

/** 一個招式：動畫名稱 + 招式持續時間（攻擊箱位置由該動畫自己 keyframe 驅動） */
@ccclass('BossMove')
class BossMove {
    @property({ tooltip: '這招的招式名稱，要跟 BossAnimator 的 moves 裡某個 name 一致，例如 boss_scythe' })
    animName: string = '';

    @property({ tooltip: '這招持續幾秒後換下一招（建議設成「圖張數 ÷ FPS」的秒數）' })
    duration: number = 1.4;

    @property({ tooltip: '（保留欄位，目前攻擊判定改由 BossAnimator 的 hitWindows 控制，此欄不影響）' })
    hasAttack: boolean = true;
}

@ccclass
export default class Boss extends cc.Component {

    @property({ tooltip: 'Boss 最大血量' })
    maxHealth: number = 30;

    @property({ tooltip: '攻擊箱揮中玩家造成的傷害（ScytheHitBox 沒自訂 damage 時用這個）' })
    attackDamage: number = 2;

    @property({
        type: [cc.Node],
        tooltip: '多個攻擊判定箱（不同階段刀形各一個，例如 scytheHitBox1/2/3）。\n' +
            '動畫用 event 的整數參數呼叫 enableHit(index) 切換要開第幾個；\n' +
            '同時只會有一個是開的。position 仍可由動畫逐幀驅動跟著刀。'
    })
    attackHitBoxes: cc.Node[] = [];

    @property({
        type: cc.Node,
        tooltip: '帽子弱點節點（hat），打中扣 hatDamageMultiplier 倍傷害'
    })
    hatNode: cc.Node = null;

    @property({
        type: [cc.Node],
        tooltip: '所有受擊箱節點（bodyHurtBox + hat）。某些招式（例如跳躍）期間會整批關閉 → boss 無敵打不到。'
    })
    hurtBoxes: cc.Node[] = [];

    @property({
        tooltip: '打中帽子（弱點）的傷害倍率，例如 2 = 雙倍傷害'
    })
    hatDamageMultiplier: number = 2;

    @property({
        type: [BossMove],
        tooltip: '招式序列，按順序輪流出招。每招設動畫名稱與持續時間。'
    })
    attackSequence: BossMove[] = [];

    @property({ tooltip: '出招之間的間隔 (秒)，0 = 連續出招' })
    moveGap: number = 0.3;

    @property({ tooltip: '受擊後無敵時間 (秒)，0 = 每顆子彈都扣' })
    invincibilityDuration: number = 0;

    @property({ tooltip: '死亡後延遲 destroy (秒)，留時間給死亡動畫播放' })
    destroyDelay: number = 1.0;

    @property({ tooltip: '死亡動畫 clip 名稱（留空 → 不播）' })
    deathAnimName: string = '';


    private _currentHealth: number = 0;
    private _animator: any = null;   // BossAnimator（逐幀貼圖）
    private _isDead: boolean = false;
    private _invincibleTimer: number = 0;

    private _moveIndex: number = -1;
    /** 目前這招是否該有攻擊判定（給動畫事件判斷要不要真的開攻擊箱） */
    private _currentMoveHasAttack: boolean = false;

    /** ScytheHitBox 讀這個值當預設傷害 */
    get scytheDamage(): number { return this.attackDamage; }

    onLoad() {
        cc.director.getPhysicsManager().enabled = true;
        this._currentHealth = this.maxHealth;
        this._animator = this.getComponent('BossAnimator');

        // 保險：一開始把所有攻擊箱關閉
        this.disableHit();
    }

    start() {
        this._nextMove();
    }

    update(dt: number) {
        if (this._invincibleTimer > 0) {
            this._invincibleTimer = Math.max(0, this._invincibleTimer - dt);
        }
    }

    // ───────── 招式循環：按順序輪流出招 ─────────
    private _nextMove() {
        if (this._isDead) return;
        if (this.attackSequence.length === 0) return;

        this._moveIndex = (this._moveIndex + 1) % this.attackSequence.length;
        const move = this.attackSequence[this._moveIndex];
        this._currentMoveHasAttack = move.hasAttack;

        // 換招時先把攻擊箱關掉（保險）
        this.disableHit();

        // 播放這招的逐幀動畫（BossAnimator 會依「第幾張圖」自動開關 hitbox）
        if (this._animator && move.animName) {
            this._animator.playMove(move.animName);
        }

        // 這招結束後換下一招
        this.scheduleOnce(() => {
            if (this._isDead) return;
            this.disableHit();             // 收尾保險
            if (this.moveGap > 0) {
                // 停頓期間切回待機圖（不要停在揮砍最後一張）
                if (this._animator && typeof this._animator.idle === 'function') {
                    this._animator.idle();
                }
                this.scheduleOnce(() => this._nextMove(), this.moveGap);
            } else {
                this._nextMove();
            }
        }, move.duration);
    }

    // ───────── 攻擊箱開關：由 BossAnimator 依「播到第幾張圖」自動呼叫 ─────────
    // 多形狀切換做法：揮砍不同階段刀形差很多 → 每個階段一個形狀的攻擊箱。
    // 在 BossAnimator 的每個招式設「攻擊判定區間（hitWindows）」：
    //   某段圖（startFrame~endFrame）→ 開第幾個攻擊箱（hitBoxIndex）。
    // BossAnimator 播到那段就呼叫 enableHit(index)，離開就 disableHit。
    // 同時只會有一個攻擊箱是開的。

    /**
     * 開啟第 index 個攻擊箱（其餘全關）。由 BossAnimator 依幀區間呼叫。
     * @param index 要開第幾個攻擊箱（對應 attackHitBoxes 的索引）
     */
    public enableHit(index?: number) {
        if (this._isDead) return;

        const i = (index === undefined || index === null) ? 0 : (parseInt(index as any, 10) || 0);

        // 先全關，保證同時只有一個攻擊箱開著（避免上一個刀形殘留）
        this._setAllHitBoxes(false);

        if (i >= 0 && i < this.attackHitBoxes.length) {
            const hb = this.attackHitBoxes[i];
            if (hb) hb.active = true;
        }
    }

    /** 關掉全部攻擊箱。由 BossAnimator 在離開判定區間 / 換招時呼叫 */
    public disableHit() {
        this._setAllHitBoxes(false);
    }

    private _setAllHitBoxes(on: boolean) {
        for (let k = 0; k < this.attackHitBoxes.length; k++) {
            const hb = this.attackHitBoxes[k];
            if (hb) hb.active = on;
        }
    }

    /**
     * 開關全部受擊箱（bodyHurtBox + hat）。關掉 → boss 打不到（無敵）。
     * 由 BossAnimator 依招式的 disableHurtBoxes 設定呼叫（例如跳躍時關掉）。
     */
    public setHurtBoxesActive(on: boolean) {
        for (let k = 0; k < this.hurtBoxes.length; k++) {
            const hb = this.hurtBoxes[k];
            if (hb) hb.active = on;
        }
    }

    // ───────── 身體 / 帽子受擊：被子彈打到時轉呼叫這個 ─────────
    // BossBodyHurtBox（身體）與 BossHatWeakPoint（帽子）的 onBeginContact 會呼叫
    // applyDamage，帽子帶 hatDamageMultiplier 倍率。

    /** 通用受傷入口。fromHat=true → 套用帽子弱點倍率 */
    public applyDamage(damage: number, attacker?: cc.Node, fromHat: boolean = false): boolean {
        if (fromHat) damage = Math.round(damage * this.hatDamageMultiplier);
        return this.takeDamage(damage, attacker);
    }

    /** 子彈直接撞到根節點時也能用（Bullet.ts 會找 takeDamage 介面） */
    public takeDamage(damage: number, attacker?: cc.Node): boolean {
        if (this._isDead) return false;
        if (this._invincibleTimer > 0) return false;
        if (damage <= 0) return false;

        this._currentHealth = Math.max(0, this._currentHealth - damage);
        console.log(`Boss 受傷 ${damage}，剩餘血量 ${this._currentHealth}`);

        if (this.invincibilityDuration > 0) this._invincibleTimer = this.invincibilityDuration;

        this.node.emit('hurt', { damage, attacker: attacker || null });
        this.node.emit('hp-changed', { hp: this._currentHealth, maxHp: this.maxHealth, delta: -damage });

        if (this._currentHealth <= 0) this._die();
        return true;
    }

    private _die() {
        if (this._isDead) return;
        this._isDead = true;

        this.unscheduleAllCallbacks();   // 停掉招式循環
        this.disableHit();

        this.node.emit('died');

        if (this._animator && this.deathAnimName) {
            this._animator.playMove(this.deathAnimName);
        }

        this.scheduleOnce(() => {
            if (this.node && this.node.isValid) this.node.destroy();
        }, this.destroyDelay);
    }
}
