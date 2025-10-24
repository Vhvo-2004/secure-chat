import { createContext, useContext } from 'react';
import PropTypes from 'prop-types';
import { useSecureChat } from '../hooks/useSecureChat';

const SecureChatContext = createContext(null);

export function SecureChatProvider({ children }) {
  const value = useSecureChat();
  return <SecureChatContext.Provider value={value}>{children}</SecureChatContext.Provider>;
}

SecureChatProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function useSecureChatContext() {
  const context = useContext(SecureChatContext);
  if (!context) {
    throw new Error('useSecureChatContext must be used within a SecureChatProvider');
  }
  return context;
}
