export const formatRWF = (amount, { maximumFractionDigits = 0 } = {}) =>
  parseFloat(amount || 0).toLocaleString('en-RW', { maximumFractionDigits });

export const formatMoney = formatRWF;

export const formatDate = (value, options = {}) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-RW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  });
};

export const formatDateTime = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-RW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
