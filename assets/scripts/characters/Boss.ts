// Boss — 鐮刀 Boss 主元件（兩張圖：boss 本體含武器 + 帽子）
//
// farmer_baby 統一用 box2d（RigidBody + PhysicsBoxCollider），碰撞靠 onBeginContact。
//
// ── 圖片結構（只有兩張圖）──
//   boss 本體（含鐮刀武器）：一張 sprite，動作由 30+ 張逐幀串接的 cc.Animation 播放。
//   帽子：另一張 sprite，當作獨立受擊弱點。
//
// ── 節點結構（之後存成 prefab）──
//   boss                  ← 本元件、cc.Animation(逐幀)、cc.RigidBody(Kinematic)
//   ├─ body(Sprite)       ← boss 本體含武器的圖，逐幀動畫換它的 spriteFrame
//   ├─ hat(Sprite)        ← 帽子的圖（獨立弱點）
//   │   └─ 掛 BossHatWeakPoint.ts + PhysicsBoxCollider(Sensor)，group=enemy
//   ├─ bodyHurtBox        ← 身體受擊箱：PhysicsBoxCollider(Sensor)，group=enemy
//   │                         （掛 BossBodyHurtBox.ts，轉呼叫本元件 takeDamage）
//   └─ scytheHitBox       ← 鐮刀攻擊箱：PhysicsBoxCollider(Sensor)，掛 ScytheHitBox.ts
//                             預設 active=false。它的 node.position 由動畫逐幀 keyframe，
//                             讓攻擊箱「跟著鐮刀位置變動」。
//
// ── 為什麼攻擊箱用「同一個會移動的子節點」──
//   box2d 的 PhysicsBoxCollider 的 size/offset 不能被動畫逐幀驅動，
//   但「整個子節點的 node.position」可以被動畫 keyframe。
//   所以揮砍時，在動畫裡同時 keyframe scytheHitBox 的 position（跟著刀尖跑）
//   + 用 animation event 在判定幀 enableHit / 收招幀 disableHit。
//
// ── 受擊分離（攻擊箱 vs 受擊箱）──
//   攻擊箱（scytheHitBox）：boss 打玩家用，掛 ScytheHitBox.ts。
//   受擊箱（bodyHurtBox + hat）：玩家子彈打 boss 用，各自掛轉發元件呼叫本元件 takeDamage。
//   兩者是不同節點、不同 collider，互不干擾。

const { ccclass, property } = cc._decorator;

/** 一個招式：動畫名稱 + 招式持續時間（攻擊箱位置由該動畫自己 keyframe 驅動） */
@ccclass('BossMove')
class BossMove {
    @property({ tooltip: '這招要播的動畫 clip 名稱，例如 boss_scythe / boss_idle' })
    animName: string = '';

    @property({ tooltip: '這招持續幾秒後換下一招（建議設成該動畫長度）' })
    duration: number = 1.4;

    @property({ tooltip: '這招是否有攻擊判定（false → 不開攻擊箱，例如純待機/移動招）' })
    hasAttack: boolean = true;
}

@ccclass
export default class Boss extends cc.Component {

    @property({ tooltip: 'Boss 最大血量' })
    maxHealth: number = 30;

    @property({ tooltip: '攻擊箱揮中玩家造成的傷害（ScytheHitBox 沒自訂 damage 時用這個）' })
    attackDamage: number = 2;

    @property({
        type: cc.Node,
        tooltip: '攻擊判定箱子節點（scytheHitBox），其 position 由動畫逐幀驅動以跟著鐮刀'
    })
    attackHitBox: cc.Node = null;

    @property({
        type: cc.Node,
        tooltip: '帽子弱點節點（hat），打中扣 hatDamageMultiplier 倍傷害'
    })
    hatNode: cc.Node = null;

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
    private _anim: cc.Animation = null;
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
        this._anim = this.getComponent(cc.Animation);

        // 保險：一開始把攻擊箱關閉
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

        if (this._anim && move.animName) {
            this._anim.play(move.animName);
        }

        // 這招結束後換下一招
        this.scheduleOnce(() => {
            if (this._isDead) return;
            this.disableHit();             // 收尾保險
            if (this.moveGap > 0) {
                this.scheduleOnce(() => this._nextMove(), this.moveGap);
            } else {
                this._nextMove();
            }
        }, move.duration);
    }

    // ───────── 動畫事件：判定開始幀 / 結束幀呼叫 ─────────
    // 動畫負責：1) keyframe scytheHitBox 的 position 讓它跟著鐮刀；
    //          2) 在判定開始幀加 event 呼叫 enableHit、結束幀呼叫 disableHit。

    /** 在招式動畫的「判定開始幀」加 animation event 呼叫 */
    public enableHit() {
        if (this._isDead) return;
        if (!this._currentMoveHasAttack) return;     // 這招沒攻擊判定 → 不開
        if (this.attackHitBox) this.attackHitBox.active = true;
    }

    /** 在招式動畫的「判定結束幀」加 animation event 呼叫 */
    public disableHit() {
        if (this.attackHitBox) this.attackHitBox.active = false;
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

        if (this._anim && this.deathAnimName) {
            this._anim.play(this.deathAnimName);
        }

        this.scheduleOnce(() => {
            if (this.node && this.node.isValid) this.node.destroy();
        }, this.destroyDelay);
    }
}
