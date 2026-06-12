const { ccclass, property } = cc._decorator;

@ccclass
export default class OnionBullet extends cc.Component {

    @property({ tooltip: '子彈/近戰碰撞框的飛行速度' })
    speed: number = 250;

    @property({ tooltip: '造成的傷害' })
    damage: number = 1;

    @property({ tooltip: '最長存活時間(秒)，時間到自動消失' })
    lifeTime: number = 2.0;

    private direction: number = 1; // 1向右, -1向左
    private rb: cc.RigidBody = null;

    /**
     * 初始化方向 (由怪物發射時呼叫)
     */
    public init(dir: number) {
        this.direction = dir;
        this.node.scaleX = this.direction * Math.abs(this.node.scaleX);
    }

    onLoad() {
        this.rb = this.getComponent(cc.RigidBody);

        this.scheduleOnce(() => {
            if (this.node.isValid) {
                this.node.destroy();
            }
        }, this.lifeTime);
    }

    update(dt: number) {
        if (!this.rb) return;

        // 維持等速水平移動
        this.rb.linearVelocity = cc.v2(this.direction * this.speed, 0);
    }

    onBeginContact(contact: cc.PhysicsContact, selfCollider: cc.PhysicsCollider, otherCollider: cc.PhysicsCollider) {
        const otherName = otherCollider.node.name;

        // ★ 修正 1：改為判斷 Player1 或 Player2
        if (otherName === 'wall' || otherCollider.tag === 1 || otherName === 'Player1' || otherName === 'Player2') {
            
            if (otherName === 'Player1' || otherName === 'Player2') {
                console.log(`攻擊擊中 ${otherName}！造成傷害：` + this.damage);
                // let player = otherCollider.node.getComponent('Player腳本名稱');
                // if (player) player.takeDamage(this.damage);
            }

            // ★ 修正 2：延遲一幀銷毀，防止物理引擎崩潰 (地板消失的元凶)
            this.scheduleOnce(() => {
                if (this.node.isValid) {
                    this.node.destroy();
                }
            }, 0);
        }
    }
}