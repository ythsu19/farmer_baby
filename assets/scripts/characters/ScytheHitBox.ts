// ScytheHitBox — Boss 攻擊判定箱（boss 打玩家用）
//
// 掛在 boss 底下的 scytheHitBox 子節點上。
// 該節點需有一個物理碰撞器（PhysicsPolygonCollider 多邊形 / 或 PhysicsBoxCollider，
// 都勾 Is Sensor），且平常 active = false，由 Boss 的動畫事件 enableHit / disableHit 開關。
// 鐮刀刀刃形狀不規則，建議用 PhysicsPolygonCollider 貼合刀形。
//
// ── 跟著鐮刀位置 / 大小 / 角度變動 ──
//   這個節點的 position 由揮砍動畫逐幀 keyframe，所以揮刀時攻擊箱跟著刀尖跑。
//   position 動畫本來就會即時反映到物理，但 ── 重點 ──
//   box2d 的 collider 形狀「不會」自動跟著節點的 scale / angle 改變更新，
//   所以若動畫還 keyframe 了 scytheHitBox 的 scale（變大小）或 angle（旋轉），
//   必須在每幀偵測到變化後呼叫 collider.apply() 強制物理重算形狀。
//   本元件的 syncColliderToTransform 開關（預設開）就是做這件事，
//   讓你可以在動畫裡直接 keyframe scytheHitBox 的 scale / rotation。
//
// 碰到 Player → 對 Player 的 PlayerHealth.takeDamage 扣血。
// 因為 sensor 重疊期間 onBeginContact 只觸發一次（進入時），
// 搭配動畫事件開關箱子，剛好「一次揮刀最多打一下」。
//
// 注意：這是「攻擊箱」，和身體/帽子的「受擊箱」是完全不同的節點與 collider。
//
// （不用 @requireComponent 限定碰撞器型別 → box / polygon 都能掛。）

const { ccclass, property } = cc._decorator;

@ccclass
export default class ScytheHitBox extends cc.Component {

    @property({ tooltip: '揮中玩家造成的傷害（留 0 則沿用 Boss.attackDamage）' })
    damage: number = 0;

    @property({
        tooltip: '動畫逐幀改了本節點的縮放/旋轉時，每幀強制 collider 重算形狀，' +
            '讓物理碰撞範圍跟著變大小/轉。只 keyframe position 的話可關掉省效能。'
    })
    syncColliderToTransform: boolean = true;

    private _boss: any = null;
    private _collider: cc.PhysicsCollider = null;
    /** 上一幀的 scale / angle，用來偵測變化才 apply（避免每幀無謂重算） */
    private _lastScaleX: number = NaN;
    private _lastScaleY: number = NaN;
    private _lastAngle: number = NaN;

    onLoad() {
        this._boss = this._findBoss();
        this._collider = this.getComponent(cc.PhysicsCollider);

        // 攻擊箱是「感測器」：只要偵測重疊扣血，不要實體推開玩家（不然玩家會被刀彈飛）。
        // 場景裡有時忘了勾 Sensor，這裡強制設好，避免漏設。
        if (this._collider) this._collider.sensor = true;

        // box2d 的 onBeginContact 只在「本節點的 RigidBody 有開 enabledContactListener」時才會
        // 派發到掛在本節點的元件上。攻擊箱的 RigidBody 預設沒開 → 這個 onBeginContact 收不到、
        // 玩家就不會扣血。這裡強制開起來。
        const rb = this.getComponent(cc.RigidBody);
        if (rb) rb.enabledContactListener = true;
    }

    // lateUpdate：在動畫系統更新完節點 transform「之後」才同步進物理，
    // 確保讀到的是這一幀動畫設定的最新 scale / angle。
    lateUpdate() {
        if (!this.syncColliderToTransform) return;
        if (!this._collider || !this.node.active) return;

        const sx = this.node.scaleX;
        const sy = this.node.scaleY;
        const ang = this.node.angle;

        // 只有 scale / angle 真的變了才重算，沒變就跳過（省效能）
        if (sx === this._lastScaleX && sy === this._lastScaleY && ang === this._lastAngle) return;

        this._lastScaleX = sx;
        this._lastScaleY = sy;
        this._lastAngle = ang;

        // 強制 box2d 依目前節點 transform 重建這個 collider 的形狀
        this._collider.apply();
    }

    onBeginContact(_contact: cc.PhysicsContact, _self: cc.PhysicsCollider, other: cc.PhysicsCollider) {
        const otherNode = other.node;
        if (otherNode.name !== 'Player' && otherNode.group !== 'player') return;

        const hp: any = otherNode.getComponent('PlayerHealth');
        if (!hp || typeof hp.takeDamage !== 'function') return;

        let dmg = this.damage;
        if (dmg <= 0 && this._boss) dmg = this._boss.scytheDamage;
        if (dmg <= 0) dmg = 1;

        const attacker = this._boss ? this._boss.node : this.node;
        hp.takeDamage(dmg, attacker);
    }

    private _findBoss(): any {
        let n = this.node.parent;
        while (n) {
            const b = n.getComponent('Boss');
            if (b) return b;
            n = n.parent;
        }
        return null;
    }
}
