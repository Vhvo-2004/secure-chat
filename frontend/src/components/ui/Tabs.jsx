import PropTypes from 'prop-types';
import { useState } from 'react';
import './ui.css';

export default function Tabs({ defaultValue, tabs }) {
  const [active, setActive] = useState(defaultValue);
  const current = tabs.find((tab) => tab.value === active) || tabs[0];

  return (
    <div className="tabs">
      <div className="tabs__list">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`tabs__trigger ${tab.value === active ? 'tabs__trigger--active' : ''}`.trim()}
            onClick={() => setActive(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div>{current?.content}</div>
    </div>
  );
}

Tabs.propTypes = {
  defaultValue: PropTypes.string.isRequired,
  tabs: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.node.isRequired,
      content: PropTypes.node.isRequired,
    }),
  ).isRequired,
};

