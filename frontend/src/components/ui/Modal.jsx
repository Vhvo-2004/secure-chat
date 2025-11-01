import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';
import Button from './Button.jsx';
import './ui.css';

export default function Modal({ open, onClose, title, description, children, footer }) {
  if (!open) return null;

  return createPortal(
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal__header">
          <h3 className="modal__title">{title}</h3>
          {description ? <p className="modal__description">{description}</p> : null}
        </div>
        <div className="modal__content">{children}</div>
        <div className="modal__footer">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          {footer}
        </div>
      </div>
    </div>,
    document.body,
  );
}

Modal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  children: PropTypes.node,
  footer: PropTypes.node.isRequired,
};

