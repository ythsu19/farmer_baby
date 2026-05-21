const {ccclass, property} = cc._decorator;

@ccclass
export default class MonsterManager extends cc.Component {

    // -----------------------------------------
    // 編輯器屬性綁定
    // -----------------------------------------
    @property({ type: [cc.Prefab], tooltip: "放所有要測試的怪物 Prefab 陣列" })
    monsterPrefabs: cc.Prefab[] = [];

    @property({ type: cc.Node, tooltip: "怪物生成的起始位置節點" })
    spawnPoint: cc.Node = null;

    @property({ type: cc.Float, tooltip: "自動生成的時間間隔(秒)" })
    spawnInterval: number = 3.0;

    @property({ type: cc.Boolean, tooltip: "是否開啟定時自動生成" })
    autoSpawn: boolean = true;

    // -----------------------------------------
    // 內部變數
    // -----------------------------------------
    // 用來記錄目前在場上的所有怪物節點，方便一鍵清空
    private activeMonsters: cc.Node[] = []; 

    // -----------------------------------------
    // 生命週期與監聽
    // -----------------------------------------
    onLoad () {
        // 開啟鍵盤監聽事件（測試用）
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
    }

    start () {
        // 如果有勾選自動生成，才啟動計時器
        if (this.autoSpawn) {
            this.schedule(this.spawnRandomMonster, this.spawnInterval);
        }
    }

    onDestroy () {
        // 養成好習慣，節點銷毀時關閉監聽，避免記憶體洩漏
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
    }

    // -----------------------------------------
    // 測試專用：鍵盤事件處理
    // -----------------------------------------
    private onKeyDown(event: cc.Event.EventKeyboard) {
        switch(event.keyCode) {
            case cc.macro.KEY.s:
                // 按下鍵盤 'S' 鍵：手動生成一隻隨機怪物
                cc.log("【測試】按下 S，手動生成怪物");
                this.spawnRandomMonster();
                break;
                
            case cc.macro.KEY.c:
                // 按下鍵盤 'C' 鍵：清空場上所有測試怪物
                cc.log("【測試】按下 C，清空場上所有怪物");
                this.clearAllMonsters();
                break;
        }
    }

    // -----------------------------------------
    // 核心邏輯：生成與管理
    // -----------------------------------------

    /**
     * 隨機選擇一個 Prefab 並生成
     */
    spawnRandomMonster() {
        if (this.monsterPrefabs.length === 0) {
            cc.warn("MonsterPrefabs 陣列是空的，請先在 Inspector 拖入 Prefab！");
            return;
        }

        // 隨機抽一個怪物 Prefab
        let randomIndex = Math.floor(Math.random() * this.monsterPrefabs.length);
        let selectedPrefab = this.monsterPrefabs[randomIndex];

        if (selectedPrefab) {
            // 1. 實例化怪物
            let monsterNode = cc.instantiate(selectedPrefab);

            // 2. 丟進 Canvas 世界中（這邊丟在 Manager 所在的節點下）
            this.node.addChild(monsterNode);

            // 3. 設定初始位置
            if (this.spawnPoint) {
                monsterNode.setPosition(this.spawnPoint.position);
            } else {
                monsterNode.setPosition(cc.v2(600, 0)); // 防呆預設值
            }

            // 4. 紀錄到陣列中，以便之後追蹤與清空
            this.activeMonsters.push(monsterNode);
        }
    }

    /**
     * 清空場上所有怪物的控制函式
     */
    clearAllMonsters() {
        for (let i = 0; i < this.activeMonsters.length; i++) {
            let monster = this.activeMonsters[i];
            if (cc.isValid(monster)) {
                monster.destroy(); // 銷毀有效節點
            }
        }
        // 清空陣列
        this.activeMonsters = [];
    }
}