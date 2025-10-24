const createValidator = () => {
  const validator = () => null;
  validator.isRequired = validator;
  return validator;
};

const passthroughFactory = () => createValidator();

const noop = () => null;

const PropTypes = new Proxy(createValidator(), {
  apply: passthroughFactory,
  get(_target, prop) {
    if (prop === 'checkPropTypes' || prop === 'resetWarningCache') {
      return noop;
    }
    if (prop === 'PropTypes') {
      return PropTypes;
    }
    if (prop === 'oneOfType' || prop === 'arrayOf' || prop === 'shape' || prop === 'oneOf') {
      return () => createValidator();
    }
    return createValidator();
  },
});

export default PropTypes;
