// ★ 修復 1：把原本第一行的 import Monster from './Monster'; 刪除！徹底避開 null 崩潰

const { ccclass, property } = cc._decorator;

@ccclass
export default class MonsterManager extends cc.Component {

    @property({ type: cc.AudioClip, tooltip: '場景的背景音樂' })
    bgmClip: cc.AudioClip = null;

    @property({ tooltip: '背景音樂音量 (0.0 ~ 1.0)' })
    bgmVolume: number = 0.5;

    private isGameOver: boolean = false; 
    private hasGameStarted: boolean = false; 

    __preload() {
        cc.director.getPhysicsManager().enabled = true;
        cc.director.getPhysicsManager().debugDrawFlags = 0; 
        cc.director.getCollisionManager().enabledDebugDraw = false; 
    }
    
    start() {
        this.playBGM();

        // 延遲 1 秒後才開啟勝負判定，讓場景有時間載入
        this.scheduleOnce(() => {
            this.hasGameStarted = true;
        }, 1.0);
    }

    update(dt: number) {
        if (!this.hasGameStarted || this.isGameOver) return;
        this.checkGameResult();
    }

    private checkGameResult() {
        // 1. 檢查輸的條件
        let p1 = cc.find('Player1') || cc.find('Canvas/Player1');
        let p2 = cc.find('Player2') || cc.find('Canvas/Player2');

        let isP1Dead = !p1 || !p1.isValid;
        let isP2Dead = !p2 || !p2.isValid;

        if (isP1Dead && isP2Dead) {
            this.isGameOver = true;
            console.log("兩個玩家都死掉了！跳轉至 LostScene");
            
            cc.audioEngine.stopMusic();
            cc.director.loadScene('LostScene');
            return; 
        }

        let scene = cc.director.getScene();
        if (!scene) return;

        // ★ 修復 2：把 Monster 加上引號變成字串 "Monster"
        // 這樣 Cocos 會直接去場景裡找叫做這個名字的腳本，不用管 import 有沒有成功
        let activeMonsters = scene.getComponentsInChildren("Monster");

        // 如果活著的怪物數量歸零，就勝利！
        if (activeMonsters.length === 0) {
            this.isGameOver = true;
            console.log("怪物清空！玩家獲勝！跳轉至 FirstWinScene");

            cc.audioEngine.stopMusic();
            cc.director.loadScene('FirstWinScene');
        }
    }

    private playBGM() {
        if (this.bgmClip) {
            cc.audioEngine.playMusic(this.bgmClip, true);
            cc.audioEngine.setMusicVolume(this.bgmVolume);
        } else {
            console.warn("MonsterManager 尚未綁定背景音樂檔案！");
        }
    }
}