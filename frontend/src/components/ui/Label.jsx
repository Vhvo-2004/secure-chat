import PropTypes from 'prop-types';
import './ui.css';

export default function Label({ htmlFor, children }) {
  return (
    <label className="label" htmlFor={htmlFor}>
      {children}
    </label>
  );
}

Label.propTypes = {
  htmlFor: PropTypes.string,
  children: PropTypes.node,
};

