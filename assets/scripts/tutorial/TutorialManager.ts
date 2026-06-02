// TutorialManager — 教學流程 step machine
//
// 用途：
//   1. 依照 steps.ts 順序顯示提示
//   2. 訂閱 player 事件 / 全域 beacon 事件，到條件就推下一步
//   3. 全部跑完 → emit 'tutorial:completed'（先不自動切場景，等 Game.fire 真的做好再串）
//
// 預期擺放：
//   Canvas 下放空節點 `TutorialManager`，掛此元件。
//   Inspector 拉：
//     - playerNode  → 場景的 Player 節點（訂閱 input:move / jumped / shot）
//     - hint        → TutorialHint.prefab 的實例節點
//     - arrowTargetNodes / arrowTargetIds → 同長度兩陣列，當 step.arrowTargetId 命中時拉對應節點
//
// 為什麼 arrowTargetNodes / arrowTargetIds 用兩個平行陣列而不是物件？
//   Cocos Creator 2.x Inspector 不支援字典；兩個 array 是最沒摩擦的拉法。
//
// 事件詞彙：
//   tutorial:step-started   { stepIndex, step }
//   tutorial:step-completed { stepIndex, step }
//   tutorial:completed      —
//
// 設計取捨：
//   - step 切換用 scheduleOnce 給 0.8s 看 ✓，不用 tween 鏈，比較好除錯
//   - source='player' 統一在 _bindCurrentStep / _unbindCurrentStep 訂閱+解訂閱，避免事件殘留
//   - source='beacon' 用 cc.game.on 全域聽，filter 比對 id；不關心 beacon 在哪個節點

import { DEFAULT_TUTORIAL_STEPS, TutorialStep } from './steps';

const { ccclass, property } = cc._decorator;

@ccclass
export default class TutorialManager extends cc.Component {

    @property({ type: cc.Node, displayName: 'Player 節點' })
    playerNode: cc.Node = null;

    @property({ type: cc.Node, displayName: 'TutorialHint 節點', tooltip: '掛 TutorialHint.ts 的 prefab 實例' })
    hint: cc.Node = null;

    @property({ type: [cc.String], displayName: '箭頭目標 ID 清單', tooltip: '跟下面節點陣列一一對應，當 step.arrowTargetId 命中其中一個就用對應節點當箭頭目標' })
    arrowTargetIds: string[] = [];

    @property({ type: [cc.Node], displayName: '箭頭目標節點清單' })
    arrowTargetNodes: cc.Node[] = [];

    @property({ displayName: '完成後切換延遲 (s)' })
    nextStepDelay: number = 0.8;

    @property({ displayName: '啟動延遲 (s)', tooltip: '場景進來後等一下再顯示第一步，給玩家適應一下' })
    startDelay: number = 0.5;

    private _steps: TutorialStep[] = DEFAULT_TUTORIAL_STEPS;
    private _currentIndex: number = -1;
    private _progressCount: number = 0;
    private _completed: boolean = false;

    /** 目前 step 在 player 上綁的 callback；要在 _unbindCurrentStep 用 off 拿掉 */
    private _playerHandler: ((payload: any) => void) | null = null;
    /** 目前 step 監聽的 player 事件名（給 off 用） */
    private _playerHandlerEvent: string = '';

    onLoad() {
        cc.game.on('tutorial:beacon', this._onBeacon, this);
    }

    start() {
        if (!this.playerNode) cc.warn('[TutorialManager] playerNode 沒拉，player 事件那幾步不會過');
        if (!this.hint) cc.warn('[TutorialManager] hint 沒拉，提示不會顯示');
        this.scheduleOnce(() => this._gotoStep(0), this.startDelay);
    }

    onDestroy() {
        cc.game.off('tutorial:beacon', this._onBeacon, this);
        this._unbindCurrentStep();
    }

    // ── 進度推進 ──────────────────────────────────────

    private _gotoStep(index: number) {
        this._unbindCurrentStep();
        this._currentIndex = index;
        this._progressCount = 0;

        if (index >= this._steps.length) {
            this._completeAll();
            return;
        }

        const step = this._steps[index];
        this._showHint(step);
        this._bindCurrentStep(step);
        this.node.emit('tutorial:step-started', { stepIndex: index, step });
    }

    private _markStepDone() {
        if (this._completed) return;
        const index = this._currentIndex;
        const step = this._steps[index];

        this._unbindCurrentStep();
        if (this.hint) {
            const hintCmp: any = this.hint.getComponent('TutorialHint');
            if (hintCmp && typeof hintCmp.markCompleted === 'function') hintCmp.markCompleted();
        }
        this.node.emit('tutorial:step-completed', { stepIndex: index, step });

        const delay = (step.nextDelay != null) ? step.nextDelay : this.nextStepDelay;
        this.scheduleOnce(() => this._gotoStep(index + 1), delay);
    }

    private _completeAll() {
        this._completed = true;
        if (this.hint) {
            const hintCmp: any = this.hint.getComponent('TutorialHint');
            if (hintCmp && typeof hintCmp.hide === 'function') hintCmp.hide();
        }
        this.node.emit('tutorial:completed');
        cc.log('[TutorialManager] tutorial completed');
    }

    // ── Hint UI ──────────────────────────────────────

    private _showHint(step: TutorialStep) {
        if (!this.hint) return;
        const hintCmp: any = this.hint.getComponent('TutorialHint');
        if (!hintCmp || typeof hintCmp.show !== 'function') return;

        const target = this._resolveArrowTarget(step.arrowTargetId);
        hintCmp.show(step.hintText, target);
    }

    private _resolveArrowTarget(id?: string): cc.Node | null {
        if (!id) return null;
        for (let i = 0; i < this.arrowTargetIds.length; i++) {
            if (this.arrowTargetIds[i] === id) {
                const n = this.arrowTargetNodes[i];
                return (n && n.isValid) ? n : null;
            }
        }
        return null;
    }

    // ── 訂閱與解訂閱 ─────────────────────────────────

    private _bindCurrentStep(step: TutorialStep) {
        if (step.source === 'player') {
            if (!step.eventName || !this.playerNode) return;
            const required = step.requiredCount || 1;
            const filter = step.filter;
            const handler = (payload: any) => {
                if (filter && !filter(payload)) return;
                this._progressCount++;
                if (this._progressCount >= required) this._markStepDone();
            };
            this.playerNode.on(step.eventName, handler, this);
            this._playerHandler = handler;
            this._playerHandlerEvent = step.eventName;
        }
        // source === 'beacon' 在 _onBeacon 內依 _currentIndex 比對，不用額外訂閱
    }

    private _unbindCurrentStep() {
        if (this._playerHandler && this._playerHandlerEvent && this.playerNode) {
            this.playerNode.off(this._playerHandlerEvent, this._playerHandler, this);
        }
        this._playerHandler = null;
        this._playerHandlerEvent = '';
    }

    private _onBeacon(payload: { id: string; node?: cc.Node }) {
        if (this._completed) return;
        if (this._currentIndex < 0 || this._currentIndex >= this._steps.length) return;
        const step = this._steps[this._currentIndex];
        if (step.source !== 'beacon') return;
        if (step.beaconId !== payload.id) return;
        this._markStepDone();
    }
}
