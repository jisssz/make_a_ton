/**
 * Algorithmic Churn Risk & Customer Health Matrix for SubSync
 * Evaluates payment reliability, subscription commitments, and business profile.
 */

export function calculateCustomerHealth(customer, invoices = [], subscriptions = []) {
  let score = 50; // baseline

  // 1. Payment Health (Max 40 points)
  const custInvoices = invoices.filter((i) => i.customerId === customer.id);
  const overdueInvs = custInvoices.filter((i) => i.overdue || (['CONFIRMED', 'PARTIAL'].includes(i.state) && i.daysOverdue > 0));
  const outstanding = customer.outstanding ?? custInvoices.filter((i) => ['CONFIRMED', 'PARTIAL'].includes(i.state)).reduce((a, i) => a + (i.balance || 0), 0);

  let paymentPoints = 35;
  if (custInvoices.length > 0) {
    if (overdueInvs.length === 0) {
      paymentPoints = 40;
    } else {
      const maxDays = Math.max(...overdueInvs.map((i) => i.daysOverdue || 0));
      if (maxDays > 30) paymentPoints = 5;
      else if (maxDays > 14) paymentPoints = 15;
      else paymentPoints = 25;
    }
  }

  // 2. Subscription Tenor & Health (Max 35 points)
  const custSubs = subscriptions.filter((s) => s.customerId === customer.id);
  const activeSubs = custSubs.filter((s) => s.state === 'ACTIVE');
  const pausedSubs = custSubs.filter((s) => s.state === 'PAUSED');

  let subPoints = 10;
  if (activeSubs.length >= 2) subPoints = 35;
  else if (activeSubs.length === 1) subPoints = 25;
  else if (customer.activeSubs >= 2) subPoints = 35;
  else if (customer.activeSubs === 1) subPoints = 25;

  if (pausedSubs.length > 0) subPoints = Math.max(0, subPoints - 15);

  // 3. Profile & Tier Maturity (Max 25 points)
  let tierPoints = 5;
  if (customer.gstin && customer.gstin.length === 15) tierPoints += 10;
  const mrr = customer.mrr || activeSubs.reduce((a, s) => a + (s.mrr || 0), 0);
  if (mrr >= 1000000) tierPoints += 10; // >= ₹10,000/mo
  else if (mrr >= 300000) tierPoints += 5;

  score = Math.min(100, Math.max(10, paymentPoints + subPoints + tierPoints));

  let tier = 'Stable';
  let tone = 'amber';
  let riskLevel = 'Moderate Churn Risk (15–25%)';
  let badgeClass = 'bg-[#FFF6E0] text-[#7a5200] border-[#FFE299]';
  let recommendation = 'Account is in regular cadence. Monitor for upcoming renewals.';

  if (score >= 80) {
    tier = 'Healthy';
    tone = 'green';
    riskLevel = 'Low Risk (< 5%)';
    badgeClass = 'bg-[#EBF7EE] text-[#1E4620] border-[#C6F0D8]';
    recommendation = 'Prime advocate account with high retention. Ideal candidate for annual contract commitment or seat upsell.';
  } else if (score < 60) {
    tier = 'At Risk';
    tone = 'red';
    riskLevel = 'High Churn Alert (> 65%)';
    badgeClass = 'bg-[#FDF2F2] text-[#991B1B] border-[#F8B4B4]';
    if (overdueInvs.length > 0) {
      recommendation = `Account has ${overdueInvs.length} overdue invoice(s). Immediate automated dunning or UPI collection follow-up recommended.`;
    } else if (pausedSubs.length > 0) {
      recommendation = 'Subscription is paused. Send targeted re-activation discount proposal before full contract lapse.';
    } else {
      recommendation = 'Low engagement detected. Customer success check-in advised.';
    }
  }

  return {
    score,
    tier,
    tone,
    riskLevel,
    badgeClass,
    recommendation,
    breakdown: {
      payment: paymentPoints,
      subscriptions: subPoints,
      tier: tierPoints,
    },
  };
}
