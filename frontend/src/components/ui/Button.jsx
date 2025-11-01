import PropTypes from 'prop-types';
import './ui.css';

const variantClass = {
  default: 'button',
  secondary: 'button button--secondary',
  outline: 'button button--outline',
  ghost: 'button button--ghost',
  destructive: 'button button--destructive',
};

const sizeClass = {
  default: '',
  icon: 'button--icon',
};

export default function Button({ variant = 'default', size = 'default', className = '', children, ...props }) {
  const base = variantClass[variant] || variantClass.default;
  const sizeStyles = sizeClass[size] || '';
  const classes = [base, sizeStyles, className].filter(Boolean).join(' ');

  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  );
}

Button.propTypes = {
  variant: PropTypes.oneOf(['default', 'secondary', 'outline', 'ghost', 'destructive']),
  size: PropTypes.oneOf(['default', 'icon']),
  className: PropTypes.string,
  children: PropTypes.node.isRequired,
};

