// PlayerHealth — HP、受傷無敵、死亡 event
//
// 用法（任何傷害來源都共用）：
//   const hp = playerNode.getComponent('PlayerHealth');
//   if (hp) hp.takeDamage(20, attackerNode);
//
// - 受傷後進入 invincibilityDuration 秒無敵；期間 takeDamage 一律被擋住
// - HP 歸零 → emit 'died'；後續 takeDamage 不再有反應
// - 無敵期間可選擇讓某個節點閃爍（透明度切換），給玩家視覺提示
//
// 事件（發在 this.node 上）：
//   hp-changed   { hp, maxHp, delta }   — 任何 HP 變動（含補血；delta 為正/負）
//   hurt         { damage, attacker }   — 實際扣到血的瞬間（無敵被擋的不發）
//   died                                 — HP 歸零瞬間，只發一次
//
// 對外介面：
//   takeDamage(damage, attacker?) → boolean  實際有扣到血 → true；被擋/死了 → false
//   heal(amount)
//   readonly hp, isDead

const { ccclass, property } = cc._decorator;

@ccclass
export default class PlayerHealth extends cc.Component {

    @property({ displayName: '最大 HP' })
    maxHp: number = 100;

    @property({ displayName: '受傷無敵時間 (s)', tooltip: '受傷後這段時間 takeDamage 一律被擋' })
    invincibilityDuration: number = 0.8;

    @property({ displayName: '受傷閃爍節點', type: cc.Node, tooltip: '無敵期間切換 opacity 做閃爍；留空 → 不閃' })
    flashNode: cc.Node = null;

    @property({ displayName: '閃爍頻率 (Hz)', tooltip: '每秒切換幾次明暗' })
    flashHz: number = 10;

    @property({ displayName: '閃爍變暗時的 opacity', range: [0, 255, 1] })
    flashDimOpacity: number = 80;

    @property({ displayName: '死亡時關閉移動/輸入/射擊', tooltip: '勾起 → 死亡後 Player/PlayerInput/PlayerCombat 都被 disable' })
    disableOnDeath: boolean = true;

    get hp(): number { return this._hp < 0 ? this.maxHp : this._hp; }
    get isDead(): boolean { return this._dead; }
    get isInvincible(): boolean { return this._invincibleTimer > 0; }

    private _hp: number = -1;
    private _invincibleTimer: number = 0;
    private _flashAccum: number = 0;
    private _flashOn: boolean = true;
    private _dead: boolean = false;

    onLoad() {
        this._hp = this.maxHp;
    }

    update(dt: number) {
        if (this._invincibleTimer > 0) {
            this._invincibleTimer = Math.max(0, this._invincibleTimer - dt);
            this._tickFlash(dt);
            if (this._invincibleTimer === 0) this._endFlash();
        }
    }

    /** 受傷介面 — 回傳 true 表示這次有實際扣到血 */
    takeDamage(damage: number, attacker?: cc.Node): boolean {
        if (this._dead) return false;
        if (this._invincibleTimer > 0) return false;
        if (damage <= 0) return false;

        const old = this._hp;
        this._hp = Math.max(0, this._hp - damage);
        const delta = this._hp - old;

        this._invincibleTimer = this.invincibilityDuration;
        this._flashAccum = 0;
        this._flashOn = true;

        this.node.emit('hurt', { damage, attacker: attacker || null });
        this.node.emit('hp-changed', { hp: this._hp, maxHp: this.maxHp, delta });

        if (this._hp <= 0) this._die();
        return true;
    }

    /** 補血介面 — 道具/治療呼叫 */
    heal(amount: number) {
        if (this._dead) return;
        if (amount <= 0) return;
        const old = this._hp;
        this._hp = Math.min(this.maxHp, this._hp + amount);
        const delta = this._hp - old;
        if (delta === 0) return;
        this.node.emit('hp-changed', { hp: this._hp, maxHp: this.maxHp, delta });
    }

    private _die() {
        if (this._dead) return;
        this._dead = true;
        this._endFlash();
        this.node.emit('died');

        if (this.disableOnDeath) {
            // 用字串避免 import 循環依賴，找不到也沒關係
            const names = ['Player', 'PlayerInput', 'PlayerCombat', 'WeaponAim'];
            for (let i = 0; i < names.length; i++) {
                const c = this.getComponent(names[i]) as cc.Component;
                if (c) c.enabled = false;
            }
        }
    }

    private _tickFlash(dt: number) {
        if (!this.flashNode) return;
        const halfPeriod = 1 / Math.max(1, this.flashHz * 2);
        this._flashAccum += dt;
        while (this._flashAccum >= halfPeriod) {
            this._flashAccum -= halfPeriod;
            this._flashOn = !this._flashOn;
            this.flashNode.opacity = this._flashOn ? 255 : this.flashDimOpacity;
        }
    }

    private _endFlash() {
        if (this.flashNode) this.flashNode.opacity = 255;
        this._flashOn = true;
    }
}
