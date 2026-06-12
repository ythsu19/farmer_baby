// RadioController — 跨場景「擁有制」商品按鍵效果元件
//
// 處理兩個商店道具的按鍵效果：
//   復古收音機-1：擁有後，任何場景按 9 → 播 radio1Clip 一次
//   奇怪寶藏    ：擁有後，任何場景按 0 → GameStore.addMoney(10)
//
// 兩種掛法都支援，啟動時自動判斷：
//   (a) 掛在「場景根節點」上 → cc.game.addPersistRootNode → 切場景也活著
//       建議用法：在 StartScene 建一顆根節點 RadioRoot，掛這支 → 跨所有場景生效
//   (b) 掛在 Canvas 底下 → 只在當前場景活著，切場景後失效
//       適合測試 / 單場景使用；要每個場景都生效就每個場景的 Canvas 都掛一份
//
// 為什麼用字面 keyCode 而不是 cc.macro.KEY['9']？
//   Cocos 2.4.8 的 cc.macro.KEY 對「主鍵盤上的數字 0–9」枚舉支援不穩 —
//   某些版本下 cc.macro.KEY['9'] 是 undefined，導致 e.keyCode === undefined 永遠 false。
//   直接寫 keyCode 字面（48 / 57 ...）最穩。
//   同時也接受 numpad 0 / 9（keyCode 96 / 105），玩家用哪一邊都觸發。
//
// 為什麼用 static _instance 擋第二份？
//   切場景時舊場景的 onDestroy 跟新場景的 onLoad 順序未必嚴格，
//   若同時有兩份 RadioController 註冊 KEY_DOWN，按一次 9 / 0 會觸發兩次 → 加錢翻倍 / 音效疊聲。

import { GameStore } from './GameStore';

// 主鍵盤上的數字鍵 keyCode（標準瀏覽器 KeyboardEvent.keyCode 對應）
const KEY_TOP_0 = 48;
const KEY_TOP_9 = 57;
// Numpad 數字鍵 keyCode（給用數字鍵盤的人也能觸發）
const KEY_NUMPAD_0 = 96;
const KEY_NUMPAD_9 = 105;

const { ccclass, property } = cc._decorator;

@ccclass
export default class RadioController extends cc.Component {

    @property({ type: cc.AudioClip, displayName: 'Radio-1 音樂 (按 9)', tooltip: '擁有「復古收音機-1」後按 9 播這首；空著按 9 不會發聲' })
    radio1Clip: cc.AudioClip = null!;

    @property({ displayName: 'Radio-1 音量 (0–1)', range: [0, 1, 0.05] })
    radio1Volume: number = 0.8;

    @property({ displayName: 'Radio-1 同時只播一份', tooltip: '勾起來：連按 9 會 stop 上一份再播新的；不勾：疊播' })
    radio1ExclusivePlay: boolean = true;

    @property({ displayName: '奇怪寶藏 每次加錢', tooltip: '擁有「奇怪寶藏」後按 0 加多少錢' })
    treasureMoneyPerPress: number = 10;

    @property({ displayName: 'Debug log', tooltip: '勾起來 onLoad 印一行，按 9/0 也會印當下擁有狀態，幫忙除錯' })
    debugLog: boolean = true;

    private static _instance: RadioController = null;
    private _radio1AudioId: number = -1;
    private _registered: boolean = false;

    onLoad() {
        // 已經有一份在跑 → 這份是新場景的重複，自我銷毀
        if (RadioController._instance && RadioController._instance !== this && RadioController._instance.node.isValid) {
            if (this.debugLog) {
                cc.log('[RadioController] 已有 instance 在跑，這份自我銷毀（這是預期行為，不是 bug）');
            }
            this.node.destroy();
            return;
        }
        RadioController._instance = this;

        // 嘗試 addPersistRootNode 讓元件跨場景活著 — 只有「場景根節點」才能 persist。
        // 掛在 Canvas 底下也能用，只是切場景就失效（需要每個場景各掛一份）。
        const scene = cc.director.getScene();
        if (this.node.parent === scene) {
            cc.game.addPersistRootNode(this.node);
            if (this.debugLog) {
                cc.log('[RadioController] 掛在場景根節點，已 addPersistRootNode → 跨場景常駐生效');
            }
        } else {
            if (this.debugLog) {
                cc.log('[RadioController] 不是場景根節點（parent =', this.node.parent ? this.node.parent.name : 'null',
                    '）→ 只在目前場景生效，切場景就失效。要跨場景請建一顆根節點掛這個元件');
            }
        }

        // 不管 persist 成功與否，鍵盤監聽都要註冊
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this._onKey, this);
        this._registered = true;

        if (this.debugLog) {
            cc.log('[RadioController] KEY_DOWN 監聽已註冊。當前擁有狀態：',
                '復古收音機-1 =', GameStore.hasItem('復古收音機-1'),
                ', 奇怪寶藏 =', GameStore.hasItem('奇怪寶藏'));
        }
    }

    onDestroy() {
        if (this._registered) {
            cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this._onKey, this);
            this._registered = false;
        }
        if (RadioController._instance === this) {
            RadioController._instance = null;
        }
    }

    private _onKey(e: cc.Event.EventKeyboard) {
        if (e.keyCode === KEY_TOP_9 || e.keyCode === KEY_NUMPAD_9) {
            this._tryPlayRadio1();
        } else if (e.keyCode === KEY_TOP_0 || e.keyCode === KEY_NUMPAD_0) {
            this._tryTreasureCoin();
        }
    }

    private _tryPlayRadio1() {
        if (!GameStore.hasItem('復古收音機-1')) {
            if (this.debugLog) cc.log('[RadioController] 按 9，但還沒買「復古收音機-1」→ 沒反應');
            return;
        }
        if (!this.radio1Clip) {
            cc.warn('[RadioController] radio1Clip 沒設定 — 把 mp3 拖到 Inspector 的「Radio-1 音樂」');
            return;
        }
        if (this.radio1ExclusivePlay && this._radio1AudioId !== -1) {
            cc.audioEngine.stop(this._radio1AudioId);
            this._radio1AudioId = -1;
        }
        this._radio1AudioId = cc.audioEngine.play(this.radio1Clip, false, this.radio1Volume);
        if (this.debugLog) cc.log('[RadioController] 播放 Radio-1，audioId =', this._radio1AudioId);
    }

    private _tryTreasureCoin() {
        if (!GameStore.hasItem('奇怪寶藏')) {
            if (this.debugLog) cc.log('[RadioController] 按 0，但還沒買「奇怪寶藏」→ 沒反應');
            return;
        }
        GameStore.addMoney(this.treasureMoneyPerPress);
        cc.log(`[奇怪寶藏] +$${this.treasureMoneyPerPress} → 餘額 $${GameStore.money}`);
    }
}
