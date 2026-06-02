// Damageable — 通用 HP 接收器（測試用靶子 / 簡單敵人）
//
// 用法：
//   - 掛在 enemy 群組節點上
//   - 子彈 / 玩家攻擊呼叫 takeDamage 即扣血；HP 歸零 → emit 'died' → 自動 destroy 節點
//
// 設計刻意跟 PlayerHealth 對稱（一樣的事件詞彙、一樣的 takeDamage 簽名），
// 之後可換成更完整的 Monster.ts / EnemyBase.ts；介面不變。
//
// 事件（發在 this.node 上）：
//   hp-changed   { hp, maxHp, delta }
//   hurt         { damage, attacker }
//   died

const { ccclass, property } = cc._decorator;

@ccclass
export default class Damageable extends cc.Component {

    @property({ displayName: '最大 HP' })
    maxHp: number = 30;

    @property({ displayName: '受傷無敵時間 (s)', tooltip: '預設 0 — 連發子彈每顆都扣' })
    invincibilityDuration: number = 0;

    @property({ displayName: '死亡後延遲 destroy (s)', tooltip: '給死亡動畫/音效播放的時間；0 = 立刻 destroy' })
    destroyDelay: number = 0;

    get hp(): number { return this._hp; }
    get isDead(): boolean { return this._dead; }

    private _hp: number = 0;
    private _invincibleTimer: number = 0;
    private _dead: boolean = false;

    onLoad() {
        this._hp = this.maxHp;
    }

    update(dt: number) {
        if (this._invincibleTimer > 0) {
            this._invincibleTimer = Math.max(0, this._invincibleTimer - dt);
        }
    }

    takeDamage(damage: number, attacker?: cc.Node): boolean {
        if (this._dead) return false;
        if (this._invincibleTimer > 0) return false;
        if (damage <= 0) return false;

        const old = this._hp;
        this._hp = Math.max(0, this._hp - damage);
        const delta = this._hp - old;

        if (this.invincibilityDuration > 0) this._invincibleTimer = this.invincibilityDuration;

        this.node.emit('hurt', { damage, attacker: attacker || null });
        this.node.emit('hp-changed', { hp: this._hp, maxHp: this.maxHp, delta });

        if (this._hp <= 0) this._die();
        return true;
    }

    private _die() {
        if (this._dead) return;
        this._dead = true;
        this.node.emit('died');
        if (this.destroyDelay > 0) {
            this.scheduleOnce(() => { if (this.node) this.node.destroy(); }, this.destroyDelay);
        } else {
            this.node.destroy();
        }
    }
}
