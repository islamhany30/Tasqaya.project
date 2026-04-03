export enum PaymentStatusEnum {
  PENDING        = 'Pending',         // لم يتم أي دفع بعد
  PARTIALLY_PAID = 'PartiallyPaid',   // تم دفع الـ 50% الأول فقط (deposit)
  PAID           = 'Paid',            // تم دفع المبلغ كامل (الـ 50% الثاني)
}