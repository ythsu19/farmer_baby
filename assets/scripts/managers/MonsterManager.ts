const { ccclass, property } = cc._decorator;

@ccclass
export default class MonsterManager extends cc.Component {

    // ★ 新增 1：宣告一個用來放音樂的變數
    @property({ type: cc.AudioClip, tooltip: '場景的背景音樂' })
    bgmClip: cc.AudioClip = null;

    @property({ tooltip: '背景音樂音量 (0.0 ~ 1.0)' })
    bgmVolume: number = 0.5;

    // ★ 使用 __preload 可以確保它比所有節點的 onLoad 更早執行
    __preload() {
        // 1. 在場景生成的最一開始，就立刻把物理引擎打開
        cc.director.getPhysicsManager().enabled = true;
        
        // 2. 關閉物理引擎的除錯框 (將 1 改為 0)
        cc.director.getPhysicsManager().debugDrawFlags = 0; 

        // 3. 關閉一般碰撞系統的「粉紅色醜框框」
        cc.director.getCollisionManager().enabledDebugDraw = false; 
    }
    
    onLoad() {
        // 其他場景初始化的邏輯可以寫這
    }

    start() {
        // ★ 新增 2：在場景準備好後，開始播放音樂
        this.playBGM();
    }

    // ★ 新增 3：播放音樂的專屬函式
    private playBGM() {
        if (this.bgmClip) {
            // cc.audioEngine.playMusic 的第二個參數 true 代表「循環播放」
            cc.audioEngine.playMusic(this.bgmClip, true);
            
            // 設定音量
            cc.audioEngine.setMusicVolume(this.bgmVolume);
        } else {
            console.warn("MonsterManager 尚未綁定背景音樂檔案！");
        }
    }

    // (未來擴充預留) 如果需要做靜音按鈕，可以呼叫這兩個：
    // cc.audioEngine.pauseMusic(); 
    // cc.audioEngine.resumeMusic();
}