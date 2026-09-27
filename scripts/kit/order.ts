/** Offline decision aid for the existing manual operations workflow; never sends or charges. */
export type Order = {
  id: string; contractVersion: string; release: string;
  quote: { totalJpy: number; runningCost: string; scope: string; cancellation: string; support: string; agreedAt: string | null };
  payment: { state: 'pending' | 'failed' | 'cancelled' | 'paid' | 'refunded'; reference: string | null; amountJpy: number | null; verifiedBy: string | null };
  materialsApproved: boolean; publicApproval: boolean; deliveredAt: string | null;
  ownerUpdateConfirmed: boolean;
};
export function readiness(order: Order) {
  const reasons: string[] = [];
  if (!order.contractVersion || !order.release || !order.quote.agreedAt || !order.quote.scope || !order.quote.runningCost || !order.quote.cancellation || !order.quote.support) reasons.push('条件合意未完了');
  if (!Number.isSafeInteger(order.quote.totalJpy) || order.quote.totalJpy <= 0) reasons.push('見積金額不正');
  if (order.payment.state !== 'paid' || !order.payment.reference || !order.payment.verifiedBy || order.payment.amountJpy !== order.quote.totalJpy) reasons.push('入金未照合');
  if (!order.materialsApproved) reasons.push('素材・掲載許可未確認');
  return { canProduce: reasons.length === 0, canDeliver: reasons.length === 0 && order.publicApproval, ownerConfirmed: order.ownerUpdateConfirmed && !!order.deliveredAt, reasons };
}
export function reconcile(order: Order, receipt: Order['payment']) {
  if (order.payment.reference && order.payment.reference !== receipt.reference) throw new Error('決済識別子不一致: 手動確認が必要');
  if (receipt.state === 'paid' && (receipt.amountJpy !== order.quote.totalJpy || !receipt.reference || !receipt.verifiedBy)) throw new Error('金額・決済事業者照合が不足');
  if (order.payment.state === 'refunded' && receipt.state !== 'refunded') throw new Error('返金済みの注文を遅延通知で再開できません');
  if (['paid', 'refunded'].includes(order.payment.state) && ['pending', 'failed', 'cancelled'].includes(receipt.state)) throw new Error('遅延通知で確定状態を戻せません');
  return { ...order, payment: { ...receipt } };
}
