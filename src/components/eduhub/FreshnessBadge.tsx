import React from 'react';

interface FreshnessBadgeProps {
  lastVerified?: string;
  freshnessScore?: number;
  className?: string;
}

function getDaysSince(lastVerified?: string) {
  if (!lastVerified) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(lastVerified).getTime()) / (24 * 60 * 60 * 1000)));
}

export const FreshnessBadge: React.FC<FreshnessBadgeProps> = ({
  lastVerified,
  freshnessScore,
  className = '',
}) => {
  const days = getDaysSince(lastVerified);

  const tone = (() => {
    if (freshnessScore !== undefined) {
      if (freshnessScore >= 80) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      if (freshnessScore >= 50) return 'bg-amber-50 text-amber-700 border-amber-200';
      return 'bg-red-50 text-red-700 border-red-200';
    }

    if (days === null) return 'bg-gray-50 text-gray-700 border-gray-200';
    if (days <= 3) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (days <= 14) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-red-50 text-red-700 border-red-200';
  })();

  const label = (() => {
    if (days === null) return 'Verification pending';
    if (days === 0) return 'Verified today';
    if (days === 1) return 'Verified 1 day ago';
    return `Verified ${days} days ago`;
  })();

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${tone} ${className}`}>
      {label}
    </span>
  );
};

export default FreshnessBadge;
