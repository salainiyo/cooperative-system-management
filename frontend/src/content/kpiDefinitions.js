/**
 * Plain-language explanations for every dashboard KPI.
 * `formula` is optional and shown as a second line.
 */
export const KPI_DEFINITIONS = {
  total_members: {
    title: 'Total Members',
    body: 'The number of people officially registered in the cooperative. Each member has a savings account and may qualify for loans.',
  },
  vault_balance: {
    title: 'Vault Balance (Total Savings)',
    body: 'All money members have saved with the cooperative, minus anything they have withdrawn. This is the pool the cooperative lends from.',
  },
  loans_issued: {
    title: 'Loans Issued',
    body: 'The total number of loans ever approved, and the total amount of cash disbursed to members through those loans.',
  },
  principal_collected: {
    title: 'Principal Collected',
    body: 'The portion of loan repayments that returned the original money lent out (excluding interest and penalties).',
  },
  interest_collected: {
    title: 'Interest Collected',
    body: 'Realised profit earned from loan interest that members have actually paid in cash so far.',
  },
  outstanding_principal: {
    title: 'Outstanding Principal',
    body: 'Money still owed by borrowers: total lent out minus everything repaid toward principal. This is the cooperative’s current lending exposure.',
  },
  projected_late_fees: {
    title: 'Projected Late Fees',
    body: 'Penalties expected on overdue installments (the configured late-fee rate per month late). This is projected income — it has not been received in cash yet.',
  },
  net_profit: {
    title: 'Net Profit',
    body: 'Interest collected plus late fees — the cooperative’s earned income from lending activity.',
  },
  cash_in_vault: {
    title: 'Cash in Vault',
    body: 'Savings pool minus money currently out on loan. The cash the cooperative could pay out immediately if every member withdrew.',
  },
  liquidity_ratio: {
    title: 'Liquidity Ratio',
    body: 'Cash in vault ÷ total savings, as a percentage. Shows how much of member savings is held as ready cash versus deployed on loans. Below 20% may be risky if many members want their money at once.',
  },
  total_disbursed: {
    title: 'Total Disbursed',
    body: 'All loan cash given to members over the cooperative’s lifetime.',
  },
  total_recovered: {
    title: 'Total Recovered',
    body: 'All loan principal members have paid back so far.',
  },
  recovery_rate: {
    title: 'Recovery Rate',
    body: 'Total principal collected ÷ total principal disbursed, as a percentage. Higher is better — it measures how effectively loans are being repaid.',
  },
};

export const TREND_EXPLANATION =
  'Change over the last 30 days compared with the previous 30 days.';
