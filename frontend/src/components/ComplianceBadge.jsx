import PropTypes from 'prop-types';

const statusClassNames = {
  Compliant: 'bg-emerald-100 text-emerald-800',
  'Non-Compliant': 'bg-amber-100 text-amber-800',
};

const sizeClassNames = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
};

export default function ComplianceBadge({ size = 'md', status }) {
  return (
    <span
      className={`inline-flex rounded-full font-semibold ${
        sizeClassNames[size] ?? sizeClassNames.md
      } ${statusClassNames[status] ?? 'bg-slate-200 text-slate-700'}`}
    >
      {status ?? 'Unknown'}
    </span>
  );
}

ComplianceBadge.propTypes = {
  size: PropTypes.oneOf(['sm', 'md']),
  status: PropTypes.string,
};

ComplianceBadge.defaultProps = {
  size: 'md',
  status: 'Unknown',
};
