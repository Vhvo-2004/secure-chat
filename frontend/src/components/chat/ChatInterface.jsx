import { useState } from 'react';
import GroupList from './GroupList.jsx';
import ChatArea from './ChatArea.jsx';
import CryptoPanel from './CryptoPanel.jsx';

export default function ChatInterface() {
  const [selectedGroup, setSelectedGroup] = useState(null);

  return (
    <div className="chat-content">
      <GroupList selectedGroupId={selectedGroup?.id ?? null} onSelectGroup={setSelectedGroup} />
      <ChatArea group={selectedGroup} />
      <CryptoPanel />
    </div>
  );
}

