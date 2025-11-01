import PropTypes from 'prop-types';
import './ui.css';

export default function Badge({ variant = 'solid', children }) {
  const classes = ['badge'];
  if (variant === 'outline') {
    classes.push('badge--outline');
  }
  return <span className={classes.join(' ')}>{children}</span>;
}

Badge.propTypes = {
  variant: PropTypes.oneOf(['solid', 'outline']),
  children: PropTypes.node,
};

