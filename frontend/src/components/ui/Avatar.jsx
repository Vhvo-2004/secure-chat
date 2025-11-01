import PropTypes from 'prop-types';
import './ui.css';

export default function Avatar({ label }) {
  return <span className="avatar">{label}</span>;
}

Avatar.propTypes = {
  label: PropTypes.string.isRequired,
};

