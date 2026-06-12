const { ccclass, property } = cc._decorator;

@ccclass
export default class MonsterManager extends cc.Component {

    // ★ 使用 __preload 可以確保它比所有節點的 onLoad 更早執行
    __preload() {
        // 在場景生成的最一開始，就立刻把物理引擎打開
        cc.director.getPhysicsManager().enabled = true;
        
        // (可選) 顯示物理碰撞框，方便除錯。正式發布前記得關掉或註解掉！
        cc.director.getPhysicsManager().debugDrawFlags = 1; 
    }
    
    onLoad() {
        // 其他場景初始化的邏輯可以寫這
    }
}