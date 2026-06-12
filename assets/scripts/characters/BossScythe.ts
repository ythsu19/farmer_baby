// ⚠️ 此檔已廢棄（deprecated）。
//
// 鐮刀 Boss 已改名重做，請改用 Boss.ts（class Boss）。
// 本檔刻意「不註冊任何 cc 類別」，避免與 Boss.ts 裡的 BossMove / Boss 類別
// 發生 "A Class already exists with the same __cid__" 衝突。
//
// 之所以留一個空殼而不是刪掉：此檔在編輯器環境下會被反覆重新生成，
// 直接刪會再回來；改成空殼後即使重生也不會造成衝突。
//
// 可安全刪除的時機：確認 Boss.ts 正常運作、且不再被任何場景/prefab 參照後，
// 在 Cocos 的 Assets 面板右鍵刪除本檔（會連同 .meta 一起清掉）。

export {};
