import PropTypes from 'prop-types';
import './ui.css';

export default function Input({ className = '', ...props }) {
  const classes = ['input', className].filter(Boolean).join(' ');
  return <input className={classes} {...props} />;
}

Input.propTypes = {
  className: PropTypes.string,
};

