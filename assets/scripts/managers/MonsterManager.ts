const { ccclass, property } = cc._decorator;

@ccclass
export default class MonsterManager extends cc.Component {

    public static instance: MonsterManager = null;

    @property({ type: cc.AudioClip, tooltip: '場景的背景音樂' })
    bgmClip: cc.AudioClip = null;

    @property({ tooltip: '背景音樂音量' })
    bgmVolume: number = 0.5;

    @property({ type: cc.Prefab, tooltip: '要生成/回收的怪物 Prefab' })
    monsterPrefab: cc.Prefab = null;

    @property({ tooltip: '總共要生成幾波怪物' })
    totalWaves: number = 1;

    @property({ tooltip: '每一波生成幾隻怪物' })
    monstersPerWave: number = 2;

    @property({ tooltip: '舊波次死光後，距離下一波刷新的緩衝時間 (秒)' })
    waveInterval: number = 3.0;

    @property({ tooltip: '怪物的生成點 X 座標' })
    spawnPointX: number = 300; 

    @property({ tooltip: '怪物的生成點 Y 座標' })
    spawnPointY: number = -100;

    private monsterPool: cc.NodePool = null;
    private isGameOver: boolean = false; 
    private hasGameStarted: boolean = false; 
    private currentWave: number = 0;
    private isWaitingForNextWave: boolean = false;

    // 用來標記是否已經成功綁定玩家的死亡事件，防止重複綁定
    private isP1Subscribed: boolean = false;
    private isP2Subscribed: boolean = false;

    __preload() {
        MonsterManager.instance = this;
        cc.director.getPhysicsManager().enabled = true;
        cc.director.getPhysicsManager().debugDrawFlags = 0; 
        cc.director.getCollisionManager().enabledDebugDraw = false; 
        
        this.monsterPool = new cc.NodePool();
        
        if (this.monsterPrefab) {
            for (let i = 0; i < (this.totalWaves * this.monstersPerWave); i++) {
                let monster = cc.instantiate(this.monsterPrefab);
                this.monsterPool.put(monster); 
            }
        }
    }
    
    start() {
        this.playBGM();

        // 嘗試在最開始綁定玩家事件
        this.bindPlayerEvents();

        this.scheduleOnce(() => {
            this.hasGameStarted = true;
            this.spawnNextWave(); 
        }, 1.0);
    }

    update(dt: number) {
        if (this.isGameOver) return;

        // ★ 放個雙重保險：萬一遊戲剛開時玩家節點還沒載入完，在 update 裡持續嘗試監聽，直到成功為止
        if (!this.isP1Subscribed || !this.isP2Subscribed) {
            this.bindPlayerEvents();
        }

        if (!this.hasGameStarted) return;
        this.checkMonsterResult(); // 現在 update 專心檢查怪物即可，高效又乾淨
    }

    // ★ 全新：直接監聽 PlayerHealth 射出的 'died' 事件
    private bindPlayerEvents() {
        let p1 = cc.find('Player1') || cc.find('Canvas/Player1');
        let p2 = cc.find('Player2') || cc.find('Canvas/Player2');

        if (p1 && !this.isP1Subscribed) {
            p1.on('died', this.handlePlayerLoss, this);
            this.isP1Subscribed = true;
            console.log("✅ MonsterManager 成功監聽 Player1 的死亡事件廣播");
        }

        if (p2 && !this.isP2Subscribed) {
            p2.on('died', this.handlePlayerLoss, this);
            this.isP2Subscribed = true;
            console.log("✅ MonsterManager 成功監聽 Player2 的死亡事件廣播");
        }
    }

    // ★ 當任何一個玩家死掉、觸發 'died' 事件時，會自動彈到這裡
    private handlePlayerLoss() {
        if (this.isGameOver) return; // 防止重複觸發
        this.isGameOver = true;
        
        console.log("💀 收到玩家發送的 'died' 事件通知！任一角色血量歸零，判定輸掉遊戲");
        cc.audioEngine.stopMusic();
        cc.director.loadScene('LostScene');
    }

    private spawnNextWave() {
        this.currentWave++;
        console.log(`🌊 第 ${this.currentWave} 波怪物來襲！(共 ${this.totalWaves} 波)`);

        for (let i = 0; i < this.monstersPerWave; i++) {
            let offsetX = (Math.random() - 0.5) * 60; 
            this.spawnMonster(this.spawnPointX + offsetX, this.spawnPointY);
        }
    }

    public spawnMonster(x: number, y: number) {
        let monsterNode: cc.Node = null;
        if (this.monsterPool.size() > 0) {
            monsterNode = this.monsterPool.get();
        } else {
            monsterNode = cc.instantiate(this.monsterPrefab);
        }
        monsterNode.parent = this.node; 
        monsterNode.setPosition(x, y);

        let monsterScript = monsterNode.getComponent("Monster") as any; 
        if (monsterScript && typeof monsterScript.initFromPool === 'function') {
            monsterScript.initFromPool(x); 
        }
    }

    public recycleMonster(monsterNode: cc.Node) {
        this.monsterPool.put(monsterNode); 
        console.log(`♻️ 怪物回收！目前池中備用數量: ${this.monsterPool.size()}`);
    }

    // 只專心檢查怪物全滅與勝利
    private checkMonsterResult() {
        if (this.isWaitingForNextWave) return;

        let scene = cc.director.getScene();
        if (!scene) return;

        let activeMonsters = scene.getComponentsInChildren("Monster");

        if (activeMonsters.length === 0) {
            if (this.currentWave < this.totalWaves) {
                this.isWaitingForNextWave = true;
                console.log(`場上怪物已清空！ ${this.waveInterval} 秒後自動刷新下一波...`);
                
                this.scheduleOnce(() => {
                    this.spawnNextWave();
                    this.isWaitingForNextWave = false; 
                }, this.waveInterval);
            } 
            else if (this.currentWave >= this.totalWaves) {
                this.isGameOver = true;
                console.log("🎉 所有波次怪物清空！玩家獲勝！跳轉至 FirstWinScene");
                cc.audioEngine.stopMusic();
                cc.director.loadScene('FirstWinScene');
            }
        }
    }

    private playBGM() {
        if (this.bgmClip) {
            cc.audioEngine.playMusic(this.bgmClip, true);
            cc.audioEngine.setMusicVolume(this.bgmVolume);
        }
    }
}