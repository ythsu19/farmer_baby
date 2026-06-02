const {ccclass, property} = cc._decorator;

@ccclass
export default class EnemyController extends cc.Component {
    
    @property({ type: cc.Integer, tooltip: "移動速度" })
    moveSpeed: number = 50; 

    @property({ type: cc.Float, tooltip: "巡邏時間 (幾秒後自動回頭)" })
    patrolTime: number = 2.5; 

    private rb: cc.RigidBody = null;
    private anim: cc.Animation = null;
    private direction: number = -1; // -1 往左，1 往右
    private timer: number = 0;
    private isDead: boolean = false;
    private isHitting: boolean = false;

    onLoad () {
        // ⚠️ 保險機制：確保物理引擎有開啟，避免穿透地板
        cc.director.getPhysicsManager().enabled = true;

        this.rb = this.getComponent(cc.RigidBody);
        this.anim = this.getComponent(cc.Animation);
        
        if (this.anim) this.anim.play("idle");
    }

    update (dt) {
        if (this.isDead || this.isHitting || !this.rb) return;

        // 1. 計時自動轉向邏輯
        this.timer += dt;
        if (this.timer >= this.patrolTime) {
            this.turnAround();
        }

        // 2. 套用物理速度 (只改 X，保留 Y 軸重力)
        let v = this.rb.linearVelocity;
        v.x = this.moveSpeed * this.direction;
        this.rb.linearVelocity = v;

        // 3. 翻轉圖片 (利用絕對值，確保吃蘑菇變大後的比例不會跑掉)
        this.node.scaleX = this.direction > 0 ? -Math.abs(this.node.scaleX) : Math.abs(this.node.scaleX);
    }

    /**
     * 【新增】獨立的轉向邏輯，讓計時器與撞牆時都能共用
     */
    private turnAround() {
        this.direction *= -1;
        this.timer = 0; // 轉向後計時器歸零重新計算
    }

    // -----------------------------------------
    // 動作與狀態函式
    // -----------------------------------------
    
    public playHit() {
        if (this.isDead || this.isHitting) return;
        
        this.isHitting = true;
        
        if (this.anim) this.anim.play("attack"); 

        this.scheduleOnce(() => {
            this.isHitting = false;
            if (!this.isDead && this.anim) {
                this.anim.play("idle"); 
            }
        }, 0.5); 
    }

    public die() {
        if (this.isDead) return;
        this.isDead = true;

        if (this.anim) this.anim.play("dead");

        this.scheduleOnce(() => {
            // 拔除碰撞框，並把剛體改為靜態，避免死掉的屍體繼續往下掉
            let collider = this.getComponent(cc.PhysicsBoxCollider);
            if (collider) collider.destroy(); 
            
            if (this.rb) {
                this.rb.type = cc.RigidBodyType.Static; 
                this.rb.linearVelocity = cc.v2(0, 0);
            }
        }, 0);

        this.scheduleOnce(() => {
            if (this.anim) this.anim.play("ascend");
            
            cc.tween(this.node)
                .to(1.5, { y: this.node.y + 200, opacity: 0 }, { easing: 'sineOut' }) 
                .call(() => {
                    this.node.destroy();
                })
                .start();
        }, 0.5);
    }

    // -----------------------------------------
    // 物理碰撞事件
    // -----------------------------------------
    
    onBeginContact(contact, selfCollider, otherCollider) {
        
        // 1. 吃蘑菇邏輯
        if (otherCollider.node.name === "Mushroom") {
            // 如果你有全域管理器，這裡要解開註解
            // if (UIManager.instance) UIManager.instance.addScore(200);
            // if (AudioManager.instance) AudioManager.instance.playMushroom();

            this.scheduleOnce(() => {
                if (otherCollider.node.isValid) otherCollider.node.destroy();
                
                let signX = this.node.scaleX > 0 ? 1 : -1;
                this.node.scaleX = 1.5 * signX; 
                this.node.scaleY = 1.5;
                
                // 往上提拔避免陷進地板
                this.node.y += (selfCollider.node.height * 0.5 / 2) + 5;
            }, 0);
            
            return; // 處理完蘑菇就結束，不往下判斷撞牆
        }

        // 2. 【新增】撞到牆壁/障礙物提早轉向邏輯
        let normal = contact.getWorldManifold().normal;
        // 如果法向量的 X 軸絕對值大於 0.5，代表撞到側邊
        if (Math.abs(normal.x) > 0.5) {
            this.turnAround();
        }
    }
}