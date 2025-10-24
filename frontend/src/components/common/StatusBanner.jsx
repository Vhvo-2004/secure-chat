import PropTypes from 'prop-types';

export default function StatusBanner({ message }) {
  if (!message) return null;
  return <div className="status">{message}</div>;
}

StatusBanner.propTypes = {
  message: PropTypes.string,
};
