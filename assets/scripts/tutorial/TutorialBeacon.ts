// TutorialBeacon — 教學流程的「通知器」
//
// 用途：
//   把場景內某個物件（落地點、靶子、目標旗）的事件，轉成 TutorialManager 看得到的訊號。
//
// 觸發方式（@property mode 切換）：
//   - 'contact'   ：onBeginContact 收到 group=player 的 contact 就觸發（用在跳躍落地點 / 旗子）
//   - 'host-died' ：訂閱同節點上的 'died' 事件（用在靶子 — 配 Damageable，HP 0 → emit died → 我觸發）
//
// 觸發後動作：
//   往 cc.game 上 emit 'tutorial:beacon'，載荷 { id }。
//   全域 emit 是刻意選擇 — TutorialManager 不需要知道 beacon 散在哪個節點。
//
// 設計取捨：
//   - 不直接呼叫 TutorialManager → 解耦；移除 manager 也不會讓場景壞掉
//   - 一個 beacon 對應一個 step（用 id 區分）→ Inspector 拉就好，不寫死
//   - 'host-died' 模式不靠 contact → 靶子被 destroy 前能正確觸發
//   - 觸發過一次就停（_fired flag）→ 同一步不會被重複觸發干擾 manager

const { ccclass, property } = cc._decorator;

export type BeaconMode = 'contact' | 'host-died';

@ccclass
export default class TutorialBeacon extends cc.Component {

    @property({ displayName: 'Beacon ID', tooltip: '對應 steps.ts 內 step.beaconId' })
    beaconId: string = '';

    @property({
        displayName: '觸發模式',
        tooltip: 'contact = 玩家撞到就觸發；host-died = 同節點 emit died 時觸發（配 Damageable 靶子）',
    })
    mode: string = 'contact';

    @property({ displayName: '只觸發一次', tooltip: '勾起 → 觸發一次就鎖；用在 checkpoint / 靶子；不勾 → 每次 contact 都發' })
    oneShot: boolean = true;

    private _fired: boolean = false;

    onLoad() {
        if (this.mode === 'host-died') {
            // 訂閱同節點的 died 事件（PlayerHealth / Damageable / 將來的 Monster 都會 emit）
            this.node.on('died', this._onHostDied, this);
        }
    }

    onDestroy() {
        this.node.off('died', this._onHostDied, this);
    }

    /**
     * box2d 物理：要在 prefab 的 cc.RigidBody 勾 Enabled Contact Listener 才會觸發。
     */
    onBeginContact(_c: cc.PhysicsContact, _self: cc.PhysicsCollider, other: cc.PhysicsCollider) {
        if (this.mode !== 'contact') return;
        if (this._fired && this.oneShot) return;
        if (other.node.group !== 'player') return;
        this._fire();
    }

    private _onHostDied() {
        if (this.mode !== 'host-died') return;
        if (this._fired && this.oneShot) return;
        this._fire();
    }

    private _fire() {
        this._fired = true;
        if (!this.beaconId) {
            cc.warn('[TutorialBeacon] beaconId 沒設，全域 emit 還是會發但 manager 收不到');
        }
        cc.game.emit('tutorial:beacon', { id: this.beaconId, node: this.node });
    }
}
