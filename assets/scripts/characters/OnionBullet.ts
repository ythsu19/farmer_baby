const { ccclass, property } = cc._decorator;

@ccclass
export default class OnionBullet extends cc.Component {

    @property({ tooltip: '子彈飛行速度' })
    speed: number = 250;

    @property({ tooltip: '子彈造成的傷害' })
    damage: number = 1;

    @property({ tooltip: '子彈最長存活時間(秒)，時間到自動消失' })
    lifeTime: number = 2.0;

    private direction: number = 1; // 1向右, -1向左
    private rb: cc.RigidBody = null;

    /**
     * 初始化子彈方向 (由怪物發射時呼叫)
     */
    public init(dir: number) {
        this.direction = dir;
        
        // 根據發射方向翻轉子彈貼圖
        this.node.scaleX = this.direction * Math.abs(this.node.scaleX);
    }

    onLoad() {
        this.rb = this.getComponent(cc.RigidBody);

        // 設定生命週期，時間到自動銷毀，避免子彈飛出地圖永遠佔用記憶體
        this.scheduleOnce(() => {
            if (this.node.isValid) {
                this.node.destroy();
            }
        }, this.lifeTime);
    }

    update(dt: number) {
        if (!this.rb) return;

        // 讓子彈維持等速水平飛行
        this.rb.linearVelocity = cc.v2(this.direction * this.speed, 0);
    }

    onBeginContact(contact: cc.PhysicsContact, selfCollider: cc.PhysicsCollider, otherCollider: cc.PhysicsCollider) {
        const otherName = otherCollider.node.name;
        const isPlayer = otherName === 'Player1' || otherName === 'Player2';

        // 碰到牆壁、隱形邊界或玩家，子彈就銷毀
        if (otherName === 'wall' || otherCollider.tag === 1 || isPlayer) {
            if (isPlayer) {
                // 透過 PlayerHealth.takeDamage 扣血 — 內建無敵時間 + 'hp-changed' event 廣播給 PlayerHUD
                const ph = otherCollider.node.getComponent('PlayerHealth') as any;
                if (ph) ph.takeDamage(this.damage, this.node);
            }
            this.node.destroy();
        }
    }
}