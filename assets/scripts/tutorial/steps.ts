// 教學步驟資料 — Phase 5
//
// 為什麼資料寫在 .ts 而不是 Inspector？
//   教學文字會反覆改寫；放 ts 用 git diff 看比 Inspector 拉欄位順太多。
//   Inspector 只用來把 step.arrowTargetId 對應到場景內節點（manager 用 dictionary 拉）。
//
// 完成條件分兩類：
//   source: 'player'  → 訂閱 player.node 上的事件（input:move / jumped / shot ...）
//   source: 'beacon'  → 等 cc.game emit 'tutorial:beacon' 且 payload.id === step.beaconId
//
// filter 是選用的 — 例如 input:move 要 dir != 0、jumped 要 double === true 才算

export interface TutorialStep {
    id: string;
    hintText: string;

    /** 完成條件來源 */
    source: 'player' | 'beacon';

    /** source='player' 時：訂閱的事件名 */
    eventName?: string;
    /** source='player' + 需累計觸發次數時用（預設 1） */
    requiredCount?: number;
    /** source='player' 時的 payload 過濾器；回 true 才算 */
    filter?: (payload: any) => boolean;

    /** source='beacon' 時：對應 TutorialBeacon.beaconId */
    beaconId?: string;

    /** Inspector 拉的「箭頭指向哪個節點」字典 key；留空 → 不指箭頭，只顯示文字 */
    arrowTargetId?: string;

    /** 完成後延遲多久切下一步（秒）；預設由 manager 給 */
    nextDelay?: number;
}

export const DEFAULT_TUTORIAL_STEPS: TutorialStep[] = [
    {
        id: 'move',
        hintText: '按 A / D 走動',
        source: 'player',
        eventName: 'input:move',
        requiredCount: 5,
        filter: (p) => p && p.dir !== 0,
    },
    {
        id: 'jump-spike-1',
        hintText: '按 Space 跳起來，跨過前方的尖刺',
        source: 'beacon',
        beaconId: 'spike-1',
        arrowTargetId: 'spike-1',
    },
    {
        id: 'double-jump-spike-2',
        hintText: '空中再按一次跳：雙跳跨更大的刺',
        source: 'beacon',
        beaconId: 'spike-2',
        arrowTargetId: 'spike-2',
    },
    {
        id: 'shoot',
        hintText: '用滑鼠瞄準、按住左鍵射擊',
        source: 'player',
        eventName: 'shot',
        requiredCount: 1,
    },
    {
        id: 'target-down',
        hintText: '打爆紅靶',
        source: 'beacon',
        beaconId: 'target',
        arrowTargetId: 'target',
    },
];
