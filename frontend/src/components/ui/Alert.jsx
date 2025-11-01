import PropTypes from 'prop-types';
import './ui.css';

export default function Alert({ variant = 'neutral', children }) {
  const classes = ['alert'];
  if (variant === 'error') {
    classes.push('alert--error');
  }
  if (variant === 'success') {
    classes.push('alert--success');
  }
  return <div className={classes.join(' ')}>{children}</div>;
}

Alert.propTypes = {
  variant: PropTypes.oneOf(['neutral', 'error', 'success']),
  children: PropTypes.node,
};

