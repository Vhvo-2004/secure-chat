import PropTypes from 'prop-types';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const RouterContext = createContext({
  path: '/',
  navigate: () => {},
});

const RouteParamsContext = createContext({});

const normalizePath = (inputPath) => {
  if (!inputPath) {
    return '/';
  }
  return inputPath.startsWith('/') ? inputPath : `/${inputPath}`;
};

const compilePattern = (pattern) => {
  if (pattern === '*') {
    return { regex: /^.*$/, keys: [] };
  }

  const keys = [];
  const escaped = pattern
    .replace(/([.+?^=!:${}()|[\]\\])/g, '\\$1')
    .replace(/\*/g, '.*');
  const regexSource = `^${escaped.replace(/:([^/]+)/g, (_, key) => {
    keys.push(key);
    return '([^/]+)';
  })}$`;

  return { regex: new RegExp(regexSource), keys };
};

const matchPath = (pattern, pathname) => {
  if (!pattern) {
    return null;
  }

  const { regex, keys } = compilePattern(pattern);
  const match = regex.exec(pathname);
  if (!match) {
    return null;
  }

  const params = keys.reduce((acc, key, index) => {
    acc[key] = decodeURIComponent(match[index + 1]);
    return acc;
  }, {});

  return { params };
};

export function BrowserRouter({ children }) {
  const [path, setPath] = useState(() => normalizePath(window.location.pathname));
  const currentPathRef = useRef(path);

  useEffect(() => {
    const handlePopState = () => {
      const next = normalizePath(window.location.pathname);
      currentPathRef.current = next;
      setPath(next);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((to, options = {}) => {
    const target = normalizePath(to);
    if (currentPathRef.current === target) {
      return;
    }

    if (options.replace) {
      window.history.replaceState(null, '', target);
    } else {
      window.history.pushState(null, '', target);
    }

    currentPathRef.current = target;
    setPath(target);
  }, []);

  const contextValue = useMemo(() => ({ path, navigate }), [path, navigate]);

  return <RouterContext.Provider value={contextValue}>{children}</RouterContext.Provider>;
}

BrowserRouter.propTypes = {
  children: PropTypes.node,
};

export function Routes({ children }) {
  const { path } = useContext(RouterContext);
  const childArray = React.Children.toArray(children);

  for (const child of childArray) {
    if (!React.isValidElement(child)) {
      continue;
    }

    const { path: routePath, element } = child.props;
    const match = matchPath(routePath, path);
    if (match) {
      return (
        <RouteParamsContext.Provider value={match.params}>
          {element ?? null}
        </RouteParamsContext.Provider>
      );
    }
  }

  return null;
}

Routes.propTypes = {
  children: PropTypes.node,
};

export function Route() {
  return null;
}

export function Navigate({ to, replace = false }) {
  const { navigate } = useContext(RouterContext);

  useEffect(() => {
    navigate(to, { replace });
  }, [navigate, replace, to]);

  return null;
}

Navigate.propTypes = {
  to: PropTypes.string.isRequired,
  replace: PropTypes.bool,
};

export function Link({ to, replace = false, children, ...rest }) {
  const { navigate } = useContext(RouterContext);

  const handleClick = useCallback(
    (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.altKey ||
        event.ctrlKey ||
        event.shiftKey
      ) {
        return;
      }

      event.preventDefault();
      navigate(to, { replace });
    },
    [navigate, replace, to],
  );

  return (
    <a href={to} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}

Link.propTypes = {
  to: PropTypes.string.isRequired,
  replace: PropTypes.bool,
  children: PropTypes.node,
};

export function useParams() {
  return useContext(RouteParamsContext);
}

export default {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
  useParams,
};
