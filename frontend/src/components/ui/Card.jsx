import PropTypes from 'prop-types';
import './ui.css';

export function Card({ children, className = '' }) {
  return <section className={`card ${className}`.trim()}>{children}</section>;
}

Card.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

export function CardHeader({ children }) {
  return <header className="card__header">{children}</header>;
}

CardHeader.propTypes = {
  children: PropTypes.node,
};

export function CardTitle({ children }) {
  return <h2 className="card__title">{children}</h2>;
}

CardTitle.propTypes = {
  children: PropTypes.node,
};

export function CardDescription({ children }) {
  return <p className="card__description">{children}</p>;
}

CardDescription.propTypes = {
  children: PropTypes.node,
};

export function CardContent({ children }) {
  return <div className="card__content">{children}</div>;
}

CardContent.propTypes = {
  children: PropTypes.node,
};

