const {ccclass, property} = cc._decorator;

@ccclass
export default class Monster extends cc.Component {

    // -----------------------------------------
    // 編輯器屬性綁定 (這些可以在 Cocos 編輯器中調整)
    // -----------------------------------------
    
    @property({ type: cc.Integer, tooltip: "怪物最大血量" })
    maxHp: number = 100;

    @property({ type: cc.Float, tooltip: "怪物移動速度" })
    speed: number = 150;

    // -----------------------------------------
    // 內部變數 (不需要在編輯器中顯示的狀態)
    // -----------------------------------------
    
    private currentHp: number = 0; // 當前血量

    // -----------------------------------------
    // 生命週期與邏輯
    // -----------------------------------------

    // onLoad 會在節點首次載入時執行，適合做初始化
    onLoad () {
        // 怪物生成時，將當前血量補滿
        this.currentHp = this.maxHp;
    }

    // update 每幀都會執行，用來處理連續的動作 (如移動)
    update (dt: number) {
        // 基礎移動：每幀往左邊走
        this.node.x -= this.speed * dt;

        // 防呆機制：如果怪物走太遠（離開畫面左邊界），就把它刪除，避免消耗記憶體
        if (this.node.x < -1500) {
            this.node.destroy();
        }
    }

    // -----------------------------------------
    // 互動函式 (給其他腳本呼叫的介面)
    // -----------------------------------------

    /**
     * 讓怪物受到傷害 (未來可以讓「子彈腳本」來呼叫這個函式)
     * @param damage 傷害數值
     */
    takeDamage (damage: number) {
        this.currentHp -= damage;
        cc.log(`怪物受到 ${damage} 點傷害，剩餘血量: ${this.currentHp}`);

        // 也可以在這裡加入「受傷閃爍」的美術效果

        if (this.currentHp <= 0) {
            this.die();
        }
    }

    /**
     * 怪物死亡處理
     */
    die () {
        cc.log("怪物死亡！");
        
        // 1. (未來擴充) 播放死亡動畫
        // 2. (未來擴充) 掉落金幣或道具
        // 3. (未來擴充) 通知 Manager 減少場上怪物計數
        
        // 銷毀怪物節點
        this.node.destroy();
    }
}