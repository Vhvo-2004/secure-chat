import PropTypes from 'prop-types';
import './ui.css';

export default function ScrollArea({ children, className = '', style }) {
  const classes = ['scroll-area', className].filter(Boolean).join(' ');
  return (
    <div className={classes} style={style}>
      {children}
    </div>
  );
}

ScrollArea.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  style: PropTypes.object,
};

