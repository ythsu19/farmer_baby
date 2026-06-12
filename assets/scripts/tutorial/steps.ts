// 教學步驟資料 — Phase 5
//
// 為什麼資料寫在 .ts 而不是 Inspector？
//   教學文字會反覆改寫；放 ts 用 git diff 看比 Inspector 拉欄位順太多。
//   Inspector 只用來把 step.arrowTargetId 對應到場景內節點（manager 用平行陣列拉）。
//
// 完成條件分兩類：
//   source: 'player'  → 訂閱 player.node 上的事件（input:move / jumped / shot ...）
//   source: 'beacon'  → 等 cc.game emit 'tutorial:beacon' 且 payload.id === step.beaconId
//
// filter 是選用的 — 例如 input:move 要 dir != 0、jumped 要 double === true 才算
//
// 目前版本：全部 5 步用 beacon contact 觸發（玩家走過 Checkpoint Node 才推下一步）
// → 設計者控節奏最直覺；要改成事件觸發只需改一行 source / eventName / beaconId

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
        id: 'walk',
        hintText: '按 A / D 走動，往前進',
        source: 'beacon',
        beaconId: 'walk',
        arrowTargetId: 'walk',
    },
    {
        id: 'jump',
        hintText: '按 Space / W 跳起來，跳過前方障礙物',
        source: 'beacon',
        beaconId: 'jump',
        arrowTargetId: 'jump',
    },
    {
        id: 'double-jump',
        hintText: '連續按兩次跳躍 → 雙跳：試著跨越超高障礙物',
        source: 'beacon',
        beaconId: 'double-jump',
        arrowTargetId: 'double-jump',
    },
    {
        id: 'spike',
        hintText: '前方有尖刺，小心不要碰到 — 會受傷！',
        source: 'beacon',
        beaconId: 'spike',
        arrowTargetId: 'spike',
    },
    {
        id: 'shoot',
        hintText: '按下滑鼠左鍵射擊，把擋路的怪射掉',
        source: 'beacon',
        beaconId: 'shoot',
        arrowTargetId: 'shoot',
    },
];
